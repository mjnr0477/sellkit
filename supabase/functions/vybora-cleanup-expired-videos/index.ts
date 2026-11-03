import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), {
      status: 405, headers: { "Content-Type": "application/json", "Allow": "POST" },
    });
  }

  const token = req.headers.get("x-cleanup-token");
  const { data: authorized, error: authError } = await supabase.rpc(
    "vybora_validate_cleanup_token", { p_token: token },
  );
  if (authError || authorized !== true) {
    return new Response(JSON.stringify({ error: "Unauthorized cleanup request" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  // Only database-expired VYBORA posts can be removed; repeated runs are throttled.
  const { data: claimed, error: claimError } = await supabase.rpc("vybora_claim_cleanup_run");
  if (claimError) {
    console.error("Cleanup throttle check failed", claimError.message);
    return new Response(JSON.stringify({ error: "Cleanup temporarily unavailable" }), {
      status: 503, headers: { "Content-Type": "application/json" },
    });
  }
  if (!claimed) {
    return new Response(JSON.stringify({ ok: true, skipped: "throttled" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  // A host refreshes heartbeat every 30 seconds. Thirty minutes allows mobile/background
  // throttling and older app versions while ensuring abandoned rooms are eventually reclaimed.
  const staleBefore = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: liveCleanup, error: liveCleanupError } = await supabase.rpc(
    "vybora_cleanup_stale_live_sessions", { p_stale_before: staleBefore },
  );
  if (liveCleanupError) {
    console.error("Stale live-room cleanup failed", liveCleanupError.message);
    return new Response(JSON.stringify({ error: "Live-room cleanup failed" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  const { data: expired, error: selectError } = await supabase
    .from("vybora_posts")
    .select("id,media_path")
    .not("expires_at", "is", null)
    .lte("expires_at", new Date().toISOString())
    .limit(100);

  if (selectError) {
    console.error("Could not list expired VYBORA posts", selectError.message);
    return new Response(JSON.stringify({ error: "Could not list expired videos" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  const paths = [...new Set((expired ?? []).map((p) => p.media_path).filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  ))];
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from("vybora-media").remove(paths);
    if (storageError) {
      console.error("Storage removal failed; keeping expired rows for retry", storageError.message);
      return new Response(JSON.stringify({ error: "Storage cleanup failed; will retry" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }
  }

  const ids = (expired ?? []).map((p) => p.id);
  if (ids.length) {
    const { error: deleteError } = await supabase.from("vybora_posts").delete().in("id", ids);
    if (deleteError) {
      console.error("Expired post row cleanup failed", deleteError.message);
      return new Response(JSON.stringify({ error: "Expired rows could not be deleted" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, deletedPosts: ids.length, removedFiles: paths.length, endedLiveSessions: Number(liveCleanup?.endedSessions || 0), removedLiveParticipants: Number(liveCleanup?.removedParticipants || 0), removedLiveSignals: Number(liveCleanup?.removedSignals || 0) }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});