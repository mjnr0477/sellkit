const http = require("http");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 10000);
const TTL_MS = 5 * 60 * 1000;
const MAX_SOURCES = 5000;
const sources = new Map();
const rate = new Map();

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "cache-control": "no-store"
  });
  res.end(body);
}
function cleanText(v, max = 80) {
  return typeof v === "string" ? v.trim().replace(/[<>\u0000-\u001f]/g, "").slice(0, max) : "";
}
function validCoord(v, min, max) {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}
function distanceKm(aLat, aLon, bLat, bLon) {
  const r = Math.PI / 180;
  const dLat = (bLat-aLat)*r, dLon = (bLon-aLon)*r;
  const x = Math.sin(dLat/2)**2 + Math.cos(aLat*r)*Math.cos(bLat*r)*Math.sin(dLon/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => { data += chunk; if (data.length > 8192) { reject(new Error("body too large")); req.destroy(); } });
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch { reject(new Error("invalid JSON")); } });
    req.on("error", reject);
  });
}
function prune() {
  const now = Date.now();
  for (const [id, s] of sources) if (now - s.lastSeen > TTL_MS) sources.delete(id);
  if (sources.size > MAX_SOURCES) {
    const oldest = [...sources.values()].sort((a,b)=>a.lastSeen-b.lastSeen);
    for (const s of oldest.slice(0, sources.size-MAX_SOURCES)) sources.delete(s.id);
  }
}
function rateOk(req) {
  const key = req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const state = rate.get(key) || { start: now, count: 0 };
  if (now - state.start > 60000) { state.start = now; state.count = 0; }
  state.count++;
  rate.set(key, state);
  if (rate.size > 2000) rate.clear();
  return state.count <= 60;
}
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (!rateOk(req)) return json(res, 429, { error: "rate limit exceeded; try again later" });
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/health" && req.method === "GET") {
    prune();
    return json(res, 200, { service: "Ambient Wave source registry", status: "ok", activeSources: sources.size, ttlSeconds: TTL_MS/1000, note: "Only recently reporting registered sources are listed; internet availability is source-reported, not independently guaranteed." });
  }
  if (url.pathname === "/v1/sources" && req.method === "GET") {
    prune();
    const lat = Number(url.searchParams.get("lat"));
    const lon = Number(url.searchParams.get("lon"));
    const radius = Math.min(1000, Math.max(1, Number(url.searchParams.get("radiusKm") || 1000)));
    if (!validCoord(lat,-90,90) || !validCoord(lon,-180,180)) return json(res,400,{error:"valid lat and lon are required"});
    const list = [...sources.values()].map(s => ({...s, distanceKm: Math.round(distanceKm(lat,lon,s.latitude,s.longitude)*10)/10}))
      .filter(s => s.distanceKm <= radius)
      .sort((a,b)=>a.distanceKm-b.distanceKm)
      .map(s => ({ id:s.id, name:s.name, provider:s.provider, latitude:s.latitude, longitude:s.longitude, distanceKm:s.distanceKm, routeType:s.routeType, status:s.internetReachable ? "source-reported reachable" : "reachability unverified", internetReachable:s.internetReachable, probeAt:s.probeAt, lastSeen:new Date(s.lastSeen).toISOString(), connectable:false, connectionNote:"Registry discovery only; this service does not create a data tunnel or grant access to the source." }));
    return json(res,200,{radiusKm:radius, count:list.length, sources:list, generatedAt:new Date().toISOString(), note:"A source is listed only after it registers and reports within the last five minutes. Reachability is reported by that source and is not independently verified by this registry."});
  }
  if (url.pathname === "/v1/sources/register" && req.method === "POST") {
    let b; try { b = await readBody(req); } catch(e) { return json(res,400,{error:e.message}); }
    const name = cleanText(b.name,80), provider = cleanText(b.provider,80), routeType = cleanText(b.routeType,32);
    if (!name) return json(res,400,{error:"source name is required"});
    if (!validCoord(b.latitude,-90,90) || !validCoord(b.longitude,-180,180)) return json(res,400,{error:"valid latitude and longitude are required"});
    if (!["cellular","wifi","ethernet","bluetooth-tether","other"].includes(routeType)) return json(res,400,{error:"unsupported routeType"});
    const reachable = b.internetReachable === true;
    const id = crypto.randomUUID();
    const now = Date.now();
    const source = { id, name, provider, routeType, latitude:b.latitude, longitude:b.longitude, internetReachable:reachable, probeAt:reachable ? new Date(now).toISOString() : null, lastSeen:now };
    sources.set(id,source);
    prune();
    return json(res,201,{id, source, expiresAfterSeconds:TTL_MS/1000, note:"This registration is self-reported. Re-register periodically to remain discoverable. It does not expose a connection or relay traffic."});
  }
  if (url.pathname.startsWith("/v1/sources/") && req.method === "POST") {
    const id = url.pathname.split("/")[3];
    let b; try { b = await readBody(req); } catch(e) { return json(res,400,{error:e.message}); }
    const s = sources.get(id);
    if (!s) return json(res,404,{error:"source not found or expired"});
    if (typeof b.internetReachable === "boolean") {
      s.internetReachable = b.internetReachable;
      s.probeAt = new Date().toISOString();
    }
    s.lastSeen = Date.now();
    return json(res,200,{id:s.id,lastSeen:new Date(s.lastSeen).toISOString(),internetReachable:s.internetReachable});
  }
  return json(res,404,{error:"not found", endpoints:["GET /health","GET /v1/sources?lat=0&lon=0&radiusKm=1000","POST /v1/sources/register","POST /v1/sources/{id}"]});
});
server.listen(PORT, "0.0.0.0", () => console.log("Ambient Wave source registry listening on " + PORT));
