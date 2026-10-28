const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(new URL('../index.html', 'file://' + __filename), 'utf8');

test('VYBORA page is mobile-ready and uses immersive vertical snapping', () => {
  assert.match(html, /name="viewport"[^>]*width=device-width/);
  assert.match(html, /scroll-snap-type:y mandatory/);
  assert.match(html, /class="feed" id="feed"/);
  assert.match(html, /@media\(max-width:850px\)/);
});

test('guest browsing remains available without account creation', () => {
  assert.match(html, /async function loadFeed\(\)/);
  assert.match(html, /render\(posts\.length\?posts:demo\)/);
  assert.match(html, /vybora_external_videos/);
  assert.match(html, /Your universe, in motion/);
  assert.match(html, /You can keep watching without one/);
});

test('account-only interactions prompt guests to authenticate', () => {
  assert.match(html, /if\(!user\)\{authPrompt\('Create an account to like videos\.'/);
  assert.match(html, /if\(!user\)\{authPrompt\('Create an account to comment on videos\.'/);
  assert.match(html, /if\(!user\)\{closeModal\('createBackdrop'\);authPrompt\('Sign in or create an account to publish videos\.'/);
  assert.match(html, /if\(!user\)\{authPrompt\('Create an account to follow creators\.'/);
});

test('frontend uses public publishable credentials only', () => {
  assert.match(html, /sb_publishable_[A-Za-z0-9_-]+/);
  assert.match(html, /emailRedirectTo:'https:\/\/vybora-social-live\.onrender\.com\/'/);
  assert.match(html, /redirectTo:'https:\/\/vybora-social-live\.onrender\.com\/'/);
  assert.doesNotMatch(html, /location\.origin\+location\.pathname/);
  assert.doesNotMatch(html, /service_role|sb_secret_/);
});

test('video upload uses VYBORA storage and database records', () => {
  assert.match(html, /sb\.storage\.from\('vybora-media'\)\.upload/);
  assert.match(html, /sb\.from\('vybora_posts'\)\.insert/);
  assert.match(html, /media_path:path/);
  assert.match(html, /expires_at:new Date\(Date\.now\(\)\+24\*60\*60\*1000\)/);
  assert.match(html, /file\.size>10\*1024\*1024/);
  assert.match(html, /vybora_record_video_view/);
  assert.match(html, /views_count/);
  assert.match(html, /sb\.from\('vybora_comments'\)\.insert/);
  assert.match(html, /sb\.from\('vybora_reactions'\)/);
  assert.match(html, /vybora_post_stats/);
  assert.match(html, /sb\.from\('vybora_follows'\)/);
});

test('comments, saved videos, and profile editing have working UI handlers', () => {
  assert.match(html, /id="commentsBackdrop"/);
  assert.match(html, /async function showComments\(post\)/);
  assert.match(html, /sb\.from\('vybora_comments'\)\.insert/);
  assert.match(html, /sb\.from\('vybora_bookmarks'\)\.insert/);
  assert.match(html, /sb\.from\('vybora_bookmarks'\)\.delete/);
  assert.match(html, /id="profileForm"/);
  assert.match(html, /id="savedBackdrop"/);
  assert.match(html, /async function openSavedVideos\(\)/);
  assert.match(html, /if\(tab==='Watch'\)\{posts=allPosts;render\(allPosts.length\?allPosts:demo\);return\}/);
  assert.match(html, /const list=allPosts\.filter\(p=>p\.following\)/);
  assert.match(html, /sb\.from\('vybora_profiles'\)\.upsert/);
  assert.match(html, /id="forgotPassword"/);
  assert.match(html, /resetPasswordForEmail/);
  assert.match(html, /PASSWORD_RECOVERY/);
  assert.match(html, /updateUser\(\{password\}\)/);
  assert.doesNotMatch(html, /Profile editing is the next feature/);
});

test('curated videos keep creator attribution without source badges', () => {
  assert.doesNotMatch(html, /VYBORA PICKS/);
  assert.doesNotMatch(html, /COMMUNITY SHARE/);
  assert.doesNotMatch(html, /Watch video ↗/);
  assert.doesNotMatch(html, /esc\(p\.source_name\|\|'ONLINE'\)/);
  assert.match(html, /p\.username\|\|p\.name\|\|'VYBORA creator'/);
});
test('Live tab is in-app first and embeds only verified active authorized streams', () => {
  assert.match(html, /data-tab="Live"/);
  assert.match(html, /function renderLiveEvents\(\)/);
  assert.match(html, /class="live-hub"/);
  assert.match(html, /data-open-live="join"/);
  assert.match(html, /data-open-live="start"/);
  assert.match(html, /data-live-rooms/);
  assert.match(html, /data-join-vybora-live/);
  assert.match(html, /vybora_live_sessions/);
  assert.match(html, /\.eq\('status','live'\)/);
  assert.match(html, /last_verified_at&&now-Date\.parse\(e\.last_verified_at\)<60\*60\*1000/);
  assert.match(html, /class="official-live-player"/);
  assert.doesNotMatch(html, /Watch on official service ↗/);
  assert.doesNotMatch(html, /href="https:\/\/www\.fifa\.com\/en\/watch"/);
  assert.doesNotMatch(html, /href="https:\/\/www\.uefa\.tv\//);
});

test('inline application JavaScript parses without syntax errors', () => {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(source => source.trim());
  assert.ok(scripts.length > 0, 'expected inline application script');
  for (const source of scripts) new vm.Script(source);
});

test('feed uses touch-friendly smooth scrolling and avoids forced stop on every card', () => {
  assert.match(html, /scroll-behavior:smooth;-webkit-overflow-scrolling:touch;touch-action:pan-y/);
  assert.match(html, /\.video-card\{[^}]*scroll-snap-stop:normal/);
});

test('curated video feed requests up to 100 entries and validates trusted HTTPS embeds', () => {
  assert.match(html, /vybora_external_videos'[\s\S]*?\.range\(0,99\)/);
  assert.match(html, /externalRows=.*new URL\(v\.embed_url\)/);
});

test('uploaded community videos are limited to short clips', () => {
  assert.match(html, /async function getVideoDuration\(file\)/);
  assert.match(html, /duration>60/);
  assert.match(html, /short videos must be 60 seconds or less/i);
});


test('Data Saver prevents automatic video and embed loading until the viewer requests it', () => {
  assert.match(html, /id="dataSaverBtn" aria-pressed="false"/);
  assert.match(html, /vybora:data-saver:v1/);
  assert.match(html, /dataSaver\?'':'autoplay '/);
  assert.match(html, /index===0&&!dataSaver\?'auto':'none'/);
  assert.match(html, /dataSaver&&isExternal&&!isDirectExternal/);
  assert.match(html, /data-action="load-external"/);
  assert.match(html, /if\(!dataSaver&&entry\.isIntersecting/);
  assert.match(html, /if\(!dataSaver\)\{const playback=v\.play\(\)/);
  assert.match(html, /action==='load-external'/);
});

test('video feed avoids downloading every clip at once and does not fake variety with duplicate demo clips', () => {
  assert.match(html, /index===0&&!dataSaver\?'auto':'none'/);
  assert.match(html, /v\.preload='auto';v\.load\(\)/);
  assert.equal((html.match(/id:'demo-/g) || []).length, 1);
});

test('Watch feed paginates endlessly as the user nears the bottom', () => {
  assert.match(html, /async function loadMoreFeed\(\)/);
  assert.match(html, /\.range\(feedPostOffset,feedPostOffset\+49\)/);
  assert.match(html, /feed\.addEventListener\('scroll'/);
  assert.match(html, /feed\.insertAdjacentHTML\('beforeend'/);
  assert.match(html, /feedHasMore/);
});

test('video search checks public posts and curated titles, descriptions and creators', () => {
  assert.match(html, /async function searchVideos\(query\)/);
  assert.match(html, /\.ilike\('body',pattern\)/);
  assert.match(html, /\.ilike\('title',pattern\)/);
  assert.match(html, /\.ilike\('description',pattern\)/);
  assert.match(html, /\.ilike\('creator',pattern\)/);
  assert.match(html, /searchInput'\)\.addEventListener\('keydown'/);
  assert.match(html, /data-search-suggest="Music"/);
});

test('curated video UI does not show provider-source banners or external watch links', () => {
  assert.doesNotMatch(html, /WATCH FROM THE ORIGINAL SOURCE/);
  assert.doesNotMatch(html, /Watch video ↗/);
  assert.match(html, /handle:'@vybora'/);
  assert.match(html, /username:v\.creator\|\|'VYBORA Picks'/);
});

test('curated feed accepts direct streams from the official Blender video host', () => {
  assert.match(html, /'video\.blender\.org'/);
});

test('open-video seed migration adds distinct official videos idempotently', () => {
  const seed = fs.readFileSync(new URL('../supabase/migrations/20261026203000_seed_open_video_catalog.sql', 'file://' + __filename), 'utf8');
  assert.match(seed, /where not exists/i);
  assert.match(seed, /WING IT!/);
  assert.match(seed, /Caminandes 2: Gran Dillama/);
  assert.match(seed, /Sprite Fright/);
  assert.match(seed, /Sintel/);
  assert.match(seed, /Glass Half/);
  assert.equal((seed.match(/\('(?:[^']|'')+', '(?:[^']|'')+', '(?:[^']|'')+'/g) || []).length, 14);
});


test('official live-event feed only labels recently verified events as live and keeps HTTPS provider links', () => {
  assert.match(html, /async function loadOfficialEvents\(\)/);
  assert.match(html, /vybora_live_events/);
  assert.match(html, /now-Date\.parse\(e\.last_verified_at\)<6\*60\*60\*1000/);
  assert.match(html, /LIVE STATUS UNVERIFIED/);
  assert.match(html, /new URL\(u\)/);
  assert.match(html, /Watch on official service/);
  assert.match(html, /official-live-player/);
});

test('live-event registry migration restricts public clients to reading active events', () => {
  const migration = fs.readFileSync(new URL('../supabase/migrations/20261026213000_vybora_live_event_registry.sql', 'file://' + __filename), 'utf8');
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /for select to anon, authenticated/i);
  assert.match(migration, /active = true/i);
  assert.match(migration, /status in \('upcoming','live','ended','cancelled'\)/);
  assert.match(migration, /embed_url is null or embed_url ~ '\^https:\/\//i);
});


test('Watch feed discovers recent open-licensed archive videos without API keys or media uploads', () => {
  assert.match(html, /async function loadOpenArchiveVideos\(page=1\)/);
  assert.match(html, /mediatype:movies AND licenseurl:\*/);
  assert.match(html, /isReusableArchiveLicense/);
  assert.match(html, /creativecommons/);
  assert.match(html, /licenses/);
  assert.match(html, /publicdomain/);
  assert.match(html, /publicdomain/);
  assert.match(html, /https:\/\/archive\.org\/metadata\//);
  assert.match(html, /https:\/\/archive\.org\/download\//);
  assert.match(html, /archiveLicense:licenseUrl/);
  assert.match(html, /async function loadMoreArchiveOnly\(\)/);
  assert.match(html, /loadMoreArchiveOnly\(\)/);
  assert.match(html, /archivePage\+1/);
  assert.match(html, /feedHasMore=feedHasMore\|\|archiveHasMore/);
  assert.match(html, /if\(!sb\)\{try\{posts=await loadOpenArchiveVideos\(1\)/);
  assert.match(html, /Community feed is temporarily unavailable\. Showing open-licensed videos/);
  assert.match(html, /archive-credit/);
  assert.match(html, /Internet Archive is a public discovery source: VYBORA keeps only transient metadata in memory/);
  assert.match(html, /Video bytes stay hosted by the archive; no imported video is written to Supabase/);
  assert.match(html, /Reuse terms/);
  assert.doesNotMatch(html, /archive\.org[\s\S]{0,1500}sb\.storage\.from\('vybora-media'\)\.upload/);
});

test('Discover feed mixes Internet Archive and Wikimedia Commons without importing media into Supabase', () => {
  assert.match(html, /async function loadWikimediaVideos\(page=1\)/);
  assert.match(html, /https:\/\/commons\.wikimedia\.org\/w\/api\.php/);
  assert.match(html, /gsrsearch:'filetype:video'/);
  assert.match(html, /iiprop:'url\|mime\|size\|extmetadata'/);
  assert.match(html, /meta\.LicenseUrl/);
  assert.match(html, /meta\.LicenseShortName/);
  assert.match(html, /commonsHasMore/);
  assert.match(html, /commonsPage=page/);
  assert.match(html, /return \[\.\.\.entries\.filter\(Boolean\),\.\.\.commonsPromise,\.\.\.openversePromise,\.\.\.nasaPromise\]/);
  assert.match(html, /handle:'@openfeed'/);
  assert.doesNotMatch(html, /commons\.wikimedia\.org[\s\S]{0,1800}sb\.storage\.from\('vybora-media'\)\.upload/);
});

test('Discover adds Openverse and NASA sources with clean-content filtering and no media imports', () => {
  assert.match(html, /async function loadOpenverseVideos\(page=1\)/);
  assert.match(html, /https:\/\/api\.openverse\.org\/v1\/videos\//);
  assert.match(html, /license:'by,by-sa,cc0,pdm'/);
  assert.match(html, /unstable__sort_by:'indexed_on',unstable__sort_dir:'desc'/, 'prefer newly indexed open-license videos');
  assert.match(html, /mature:'false'/);
  assert.match(html, /async function loadNasaVideos\(page=1\)/);
  assert.match(html, /https:\/\/images-api\.nasa\.gov\/search/);
  assert.match(html, /https:\/\/images-api\.nasa\.gov\/asset\//);
  assert.match(html, /function isCleanVideoMetadata/);
  assert.match(html, /\.\.\.openversePromise,\.\.\.nasaPromise/);
  assert.match(html, /openverseHasMore/);
  assert.match(html, /nasaHasMore/);
  assert.doesNotMatch(html, /api\.openverse\.org[\s\S]{0,2200}sb\.storage\.from\('vybora-media'\)\.upload/);
  assert.doesNotMatch(html, /images-api\.nasa\.gov[\s\S]{0,2200}sb\.storage\.from\('vybora-media'\)\.upload/);
});

test('feed cards remove platform-source badges while preserving mature-content warnings', () => {
  assert.doesNotMatch(html, /COMMUNITY SHARE/);
  assert.doesNotMatch(html, /VYBORA PICKS/);
  assert.match(html, /p\.mature_content\?'<div class="muted-badge">18\+ · MATURE<\/div>'/);
});


test('scrolling videos autoplay muted and pause offscreen to protect playback performance', () => {
  assert.match(html, /<video src="'\+esc\(media\)\+'" '\+\(dataSaver\?'':'autoplay '\)\+'muted playsinline loop/);
  assert.match(html, /if\(v\)\{v\.muted=true;if\(!dataSaver\)\{const playback=v\.play\(\)/);
  assert.match(html, /finishWatchSession\(card\);if\(v\)v\.pause\(\)/);
});

test('official live embeds request muted autoplay and keep source branding out of the viewing card', () => {
  assert.match(html, /u\.searchParams\.set\('autoplay','1'\)/);
  assert.match(html, /u\.searchParams\.set\('mute','1'\)/);
  assert.match(html, /allow="autoplay; encrypted-media; picture-in-picture; fullscreen"/);
  assert.doesNotMatch(html, /esc\(e\.source_name\|\|'Official broadcaster'\)/);
  assert.match(html, /Watch on official service/);
});


test('database advisor hardening keeps VYBORA internal state private and indexes viewer history', () => {
  const migration = fs.readFileSync(new URL('../supabase/migrations/20261027104000_vybora_database_advisor_hardening.sql', 'file://' + __filename), 'utf8');
  assert.match(migration, /on public\.vybora_cleanup_state[\s\S]*?using \(false\)[\s\S]*?with check \(false\)/i);
  assert.match(migration, /create index if not exists vybora_video_views_viewer_created_idx/i);
  assert.match(migration, /on public\.vybora_video_views \(viewer_id, created_at desc\)/i);
  assert.doesNotMatch(migration, /dream_wifi/i);
});


test('VYBORA registers a visible offline/online status and service worker', () => {
  assert.match(html, /id="vyboraNetworkStatus"/);
  assert.match(html, /addEventListener\('offline'/);
  assert.match(html, /addEventListener\('online'/);
  assert.match(html, /navigator\.serviceWorker\.register\('\/service-worker\.js'\)/);
});

test('offline worker caches only the public app shell and never caches API mutations', () => {
  const worker = fs.readFileSync(new URL('../service-worker.js', 'file://' + __filename), 'utf8');
  assert.match(worker, /const SHELL = \['\/', '\/index\.html', '\/social-features\.js'\]/);
  assert.match(worker, /request\.method !== 'GET'/);
  assert.match(worker, /request\.mode === 'navigate'/);
  assert.match(worker, /url\.pathname === '\/social-features\.js'/);
  assert.match(worker, /Never cache authenticated API responses or private user data/);
  assert.doesNotMatch(worker, /supabase\.co\/rest\/v1/);
});


test('feed ranking prioritizes followed creators and combines freshness with engagement', () => {
  assert.match(html, /function rankFeedItems\(items\)/);
  assert.match(html, /const affinity=p\.following\?4\.5:0/);
  assert.match(html, /const freshness=Math\.max\(0,2\.5-Math\.log2\(ageHours\+1\)\*0\.45\)/);
  assert.match(html, /const likes=Math\.log2\(Number\(p\.likes\|\|0\)\+1\)\*0\.22/);
  assert.match(html, /posts=rankFeedItems\(\[\.\.\.remote,\.\.\.featured,\.\.\.archive\]\)/);
});

test('current intent boosts matching topics in the current session without persisting a separate profile', () => {
  assert.match(html, /let currentIntentTokens=\[\]/);
  assert.match(html, /function setCurrentIntent\(value\)/);
  assert.match(html, /function intentScore\(post\)/);
  assert.match(html, /const intent=intentScore\(p\)/);
  assert.match(html, /savedSignal\+personal\+intent/);
  assert.match(html, /setCurrentIntent\(q\)/);
  assert.match(html, /setCurrentIntent\(b\.dataset\.topic\)/);
});

test('watch-time personalization is local, bounded, and integrated into feed ranking', () => {
  assert.match(html, /const WATCH_INTEREST_KEY='vybora:watch-interests:v1'/);
  assert.match(html, /function recordWatchInterest\(card,seconds\)/);
  assert.match(html, /if\(!card\|\|seconds<4\)return/);
  assert.match(html, /localStorage\.setItem\(WATCH_INTEREST_KEY,JSON\.stringify\(profile\)\)/);
  assert.match(html, /const personal=interestScore\(p,interests\)/);
  assert.match(html, /affinity\+freshness\+quality\+savedSignal\+personal/);
  assert.match(html, /data-title=/);
  assert.match(html, /finishWatchSession\(card\)/);
  assert.match(html, /function render\(list=posts\)\{feed\.querySelectorAll\('\.video-card'\)\.forEach\(finishWatchSession\)/);
  assert.match(html, /window\.addEventListener\('pagehide'/);
  assert.doesNotMatch(html, /fetch\([^)]*watch-interests|sb\.from\(['"]vybora_watch_interests/);
});


test('content reports prevent duplicate submissions, validate state, recover from network errors, and reset after success', () => {
  const social = fs.readFileSync(new URL('../social-features.js', 'file://' + __filename), 'utf8');
  assert.match(social, /reportSubmitting=false/);
  assert.match(social, /if\(reportSubmitting\)return/);
  assert.match(social, /button\.disabled=true/);
  assert.match(social, /details\.slice\(0,1000\)/);
  assert.match(social, /catch\(error\)\{console\.warn\('VYBORA report submission failed:'/);
  assert.match(social, /reportPost=null;form\?\.reset\(\);close\('reportBackdrop'\)/);
  assert.match(social, /finally\{reportSubmitting=false/);
});
