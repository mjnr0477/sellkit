const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(new URL('../index.html', 'file://' + __filename), 'utf8');
const designCss = fs.readFileSync(new URL('../design-refresh.css', 'file://' + __filename), 'utf8');
const muteMigration = fs.readFileSync(new URL('../supabase/migrations/20261102072105_vybora_creator_mutes.sql', 'file://' + __filename), 'utf8');
const blockMigration = fs.readFileSync(new URL('../supabase/migrations/20261102073022_vybora_account_blocking.sql', 'file://' + __filename), 'utf8');
const socialSource = fs.readFileSync(new URL('../social-features.js', 'file://' + __filename), 'utf8');
const moderationMigration = fs.readFileSync(new URL('../supabase/migrations/20261102073722_vybora_moderation_queue.sql', 'file://' + __filename), 'utf8');
const moderationHardening = fs.readFileSync(new URL('../supabase/migrations/20261102073755_harden_vybora_moderation_audit.sql', 'file://' + __filename), 'utf8');
const readReceiptsMigration = fs.readFileSync(new URL('../supabase/migrations/20261102074553_vybora_message_read_receipts.sql', 'file://' + __filename), 'utf8');
const readReceiptHardening = fs.readFileSync(new URL('../supabase/migrations/20261102074733_harden_vybora_read_receipt_policy.sql', 'file://' + __filename), 'utf8');
const liveHeartbeatMigration = fs.readFileSync(new URL('../supabase/migrations/20261103090000_vybora_live_heartbeat_cleanup.sql', 'file://' + __filename), 'utf8');
const liveHeartbeatHardeningMigration = fs.readFileSync(new URL('../supabase/migrations/20261103091000_vybora_live_heartbeat_trigger_guard.sql', 'file://' + __filename), 'utf8');
const liveChatMigration = fs.readFileSync(new URL('../supabase/migrations/20261103092000_vybora_live_chat_viewer_counts.sql', 'file://' + __filename), 'utf8');
const liveCleanupGraceMigration = fs.readFileSync(new URL('../supabase/migrations/20261103094000_vybora_live_cleanup_grace.sql', 'file://' + __filename), 'utf8');
const liveCapacityMigration = fs.readFileSync(new URL('../supabase/migrations/20261103093000_vybora_live_direct_viewer_cap.sql', 'file://' + __filename), 'utf8');
const cleanupFunction = fs.readFileSync(new URL('../supabase/functions/vybora-cleanup-expired-videos/index.ts', 'file://' + __filename), 'utf8');

test('VYBORA page is mobile-ready and keeps the steering feed free of forced snapping', () => {
  assert.match(html, /name="viewport"[^>]*width=device-width/);
  assert.match(html, /scroll-snap-type:none/);
  assert.match(html, /class="feed" id="feed"/);
  assert.match(html, /@media\(max-width:850px\)/);
});

test('guest browsing remains available without account creation', () => {
  assert.match(html, /async function loadFeed\(\)/);
  assert.match(html, /async function loadOpenArchiveVideos\(page=1\)/);
  assert.match(html, /feed-empty-state/);
  assert.match(html, /render\(\[\]\)/);
  assert.ok(html.includes('https://sepiasearch.org/api/v1/search/videos'));
  assert.match(html, /Your universe, in motion/);
  assert.match(html, /You can keep watching without one/);
});

test('signup keeps confirmation recovery visible and explains email provider rate limits', () => {
  assert.match(html, /authMode='signin';setAuthMode\(\);\$\('resendConfirmation'\)\.hidden=false/);
  assert.match(html, /Account created\. Check your inbox and spam folder/);
  assert.match(html, /over_email_send_rate_limit/);
  assert.match(html, /Wait at least 60 seconds/);
  assert.ok(html.includes('function startConfirmationCooldown(seconds=60)'));
  assert.ok(html.includes("button.textContent='Resend in '+remaining+'s'"));
});

test('authentication errors give actionable recovery instead of raw provider messages', () => {
  assert.match(html, /err\?\.code==='invalid_credentials'/);
  assert.match(html, /use “Forgot your password\?” to reset it/);
  assert.match(html, /over_email_send_rate_limit/);
  assert.match(html, /Wait at least 60 seconds before trying again/);
});

test('account-only interactions prompt guests to authenticate', () => {
  assert.match(html, /if\(!user\)\{authPrompt\('Create an account to like videos\.'/);
  assert.match(html, /if\(!user\)\{authPrompt\('Create an account to comment on videos\.'/);
  assert.match(html, /if\(!user\)\{closeModal\('createBackdrop'\);authPrompt\('Sign in or create an account to publish videos\.'/);
  assert.match(html, /if\(!user\)\{authPrompt\('Create an account to follow creators\.'/);
});

test('frontend uses the canonical production host for auth callbacks and public publishable credentials only', () => {
  assert.match(html, /sb_publishable_[A-Za-z0-9_-]+/);
  assert.match(html, /emailRedirectTo:'https:\/\/vybora-social-live-8yyn\.onrender\.com\/'/);
  assert.match(html, /redirectTo:'https:\/\/vybora-social-live-8yyn\.onrender\.com\/'/);
  assert.doesNotMatch(html, /location\.origin\+location\.pathname/);
  assert.doesNotMatch(html, /service_role|sb_secret_/);
});

test('video upload uses VYBORA storage and database records', () => {
  assert.match(html, /sb\.storage\.from\('vybora-media'\)\.upload/);
  assert.match(html, /sb\.from\('vybora_posts'\)\.insert/);
  assert.match(html, /media_path:path/);
  assert.match(html, /expires_at:new Date\(Date\.now\(\)\+24\*60\*60\*1000\)/);
  assert.match(html, /file\.size>25\*1024\*1024/);
  assert.match(html, /async function getSupportedVideoMimeType\(file\)/);
  assert.match(html, /header\[0\]===0x1a&&header\[1\]===0x45&&header\[2\]===0xdf&&header\[3\]===0xa3/);
  assert.match(html, /String\.fromCharCode\(\.\.\.header\.slice\(4,8\)\)==='ftyp'/);
  assert.match(html, /String\.fromCharCode\(\.\.\.header\.slice\(8,12\)\)==='qt  '\?'video\/quicktime':'video\/mp4'/);
  assert.match(html, /contentType:uploadMime/);
  assert.match(html, /uploadMime=await getSupportedVideoMimeType\(file\)/);
  assert.match(html, /vybora_record_video_view/);
  assert.match(html, /views_count/);
  assert.match(html, /sb\.from\('vybora_comments'\)\.insert/);
  assert.match(html, /sb\.from\('vybora_reactions'\)/);
  assert.match(html, /vybora_post_stats/);
  assert.match(html, /sb\.from\('vybora_follows'\)/);
});

test('profile creation retries with a unique username when an email-derived username is taken', () => {
  assert.ok(html.includes("uniqueUsername=username.slice(0,22)+'_'+user.id.replace(/-/g,'').slice(0,7)"));
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
  assert.match(html, /if\(tab==='Watch'\)\{posts=allPosts;render\(allPosts\);return\}/);
  assert.match(html, /async function loadFollowingFeed\(\)/);
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
  assert.match(html, /data-live-event-search/);
  assert.match(html, /Search ongoing events, teams or competitions/);
  assert.match(html, /hub\.querySelectorAll\('\.official-tracked-event'\)/);
  assert.match(html, /No currently listed live event matches that search/);
  assert.match(html, /data-open-live="join"/);
  assert.match(html, /data-open-live="start"/);
  assert.match(html, /data-live-rooms/);
  assert.match(html, /data-join-vybora-live/);
  assert.match(html, /vybora_live_sessions/);
  assert.match(html, /\.eq\('status','live'\)/);
  assert.match(html, /last_verified_at&&now-Date\.parse\(e\.last_verified_at\)<60\*60\*1000/);
  assert.match(html, /class="official-live-player"/);
  const liveRenderer = html.slice(html.indexOf('function renderLiveEvents()'), html.indexOf('async function loadOfficialEvents()'));
  assert.ok(liveRenderer.length > 0, 'Live renderer must be present');
  assert.doesNotMatch(liveRenderer, /events\.map/);
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

test('new account profile creation retries with a unique username when email-derived names collide', () => {
  assert.ok(html.includes("uniqueUsername=username.slice(0,22)+'_'+user.id.replace(/-/g,'').slice(0,7)"));
});

test('feed uses touch-friendly smooth scrolling and avoids forced stop on every card', () => {
  assert.match(html, /scroll-behavior:smooth;-webkit-overflow-scrolling:touch;touch-action:pan-y/);
  assert.match(html, /\.video-card\{[^}]*scroll-snap-stop:normal/);
});

test('external video discovery streams from live sources without reading the persisted video catalogue', () => {
  const feedSource = html.slice(html.indexOf('async function loadFeed()'), html.indexOf('async function ensureProfile()'));
  const searchSource = html.slice(html.indexOf('async function searchVideos(query)'), html.indexOf("$('searchSubmit').addEventListener"));
  assert.doesNotMatch(feedSource, /sb\.from\('vybora_external_videos'\)/);
  assert.doesNotMatch(searchSource, /sb\.from\('vybora_external_videos'\)/);
  assert.match(feedSource, /loadOpenArchiveVideos\(1\)/);
  assert.match(searchSource, /loadPeerTubeVideos\(1,q\)/);
  assert.match(searchSource, /loadOpenverseVideos\(1,q\)/);
});

test('uploaded community videos are limited to short clips', () => {
  assert.match(html, /async function getVideoDuration\(file\)/);
  assert.match(html, /duration>60/);
  assert.match(html, /short videos must be 60 seconds or less/i);
});


test('Data Saver prevents automatic video and embed loading until the viewer requests it', () => {
  assert.match(html, /id="dataSaverBtn" aria-pressed="false"/);
  assert.match(html, /vybora:data-saver:v1/);
  assert.match(html, /dataSaver\?'data-src="'\+esc\(media\)\+'" ':'src="'\+esc\(media\)\+'" '/);
  assert.match(html, /if\(!dataSaver&&v&&!v\.getAttribute\('src'\)&&v\.dataset\.src\)\{v\.src=v\.dataset\.src;v\.preload='auto';v\.load\(\)\}/);
  assert.match(html, /dataSaver\?'':'autoplay '/);
  assert.match(html, /index===0&&!dataSaver\?'auto':'none'/);
  assert.match(html, /dataSaver&&isExternal&&!isDirectExternal/);
  assert.match(html, /data-action="load-external"/);
  assert.match(html, /if\(!dataSaver&&entry\.isIntersecting/);
  assert.match(html, /if\(!dataSaver\)\{const playback=v\.play\(\)/);
  assert.match(html, /action==='load-external'/);
  assert.match(html, /isExternal&&!isDirectExternal\?'':'<button class="play-toggle" data-action="play"/);
});

test('Data Saver keeps video discovery and infinite scrolling active without preloading source media', () => {
  assert.doesNotMatch(html, /async function loadOpenArchiveVideos\(page=1\)\{\s*if\(dataSaver\)return \[\]/);
  assert.doesNotMatch(html, /async function loadPeerTubeVideos\(page=1,searchTerm='short film'\)\{\s*if\(dataSaver/);
  assert.doesNotMatch(html, /async function loadMoreArchiveOnly\(\)\{\s*if\(dataSaver\)return/);
  assert.match(html, /if\(!dataSaver&&v&&!v\.getAttribute\('src'\)&&v\.dataset\.src\)/);
});

test('video feed avoids downloading every clip at once and never inserts fabricated demo clips', () => {
  assert.match(html, /index===0&&!dataSaver\?'auto':'none'/);
  assert.match(html, /v\.preload='auto';v\.load\(\)/);
  assert.doesNotMatch(html, /demo-1|VYBORA Daily|Showing demo videos|featured demo/);
});

test('community post sharing uses canonical post-specific links and restores the shared post first', () => {
  assert.match(html, /new URLSearchParams\(location\.search\)\.get\('post'\)/);
  assert.match(html, /shareUrl=new URL\('\/',\s*'https:\/\/vybora-social-live-8yyn\.onrender\.com'\)/);
  assert.match(html, /shareUrl\.searchParams\.set\('post',String\(post\.id\)\)/);
  assert.match(html, /\.eq\('id',requestedPostId\)\.eq\('visibility','public'\)/);
  assert.match(html, /const requestedIndex=requestedPostId\?items\.findIndex\(p=>String\(p\.id\)===requestedPostId\):requestedSourceUrl\?items\.findIndex\(p=>String\(p\.source_url\|\|''\)===requestedSourceUrl\):-1/);
});

test('shared external and open-license source links restore the matching feed card first', () => {
  assert.match(html, /new URLSearchParams\(location\.search\)\.get\('source'\)/);
  assert.match(html, /requestedSourceUrl\?items\.findIndex\(p=>String\(p\.source_url\|\|''\)===requestedSourceUrl\)/);
  assert.match(html, /else if\(post\.source_url\)shareUrl\.searchParams\.set\('source',String\(post\.source_url\)\)/);
});

test('Watch feed paginates endlessly as the user nears the bottom', () => {
  assert.match(html, /async function loadMoreFeed\(\)/);
  assert.match(html, /\.range\(feedPostOffset,feedPostOffset\+postBatchSize-1\)/);
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


test('official live-event feed embeds only recently verified active events and hides source links', () => {
  assert.match(html, /async function loadOfficialEvents\(\)/);
  assert.match(html, /vybora_live_events/);
  assert.match(html, /\.eq\('status','live'\)/);
  assert.match(html, /last_verified_at&&now-Date\.parse\(e\.last_verified_at\)<60\*60\*1000/);
  assert.match(html, /class="official-live-player"/);
  assert.match(html, /const allowed=\['youtube\.com','www\.youtube\.com','www\.youtube-nocookie\.com','player\.vimeo\.com','vimeo\.com','www\.twitch\.tv','player\.twitch\.tv','geo\.dailymotion\.com','player\.kick\.com'\]/);
  assert.doesNotMatch(html, /Watch on official service/);
  assert.doesNotMatch(html, /LIVE STATUS UNVERIFIED/);
});

test('live-event registry migration restricts public clients to reading active events', () => {
  const migration = fs.readFileSync(new URL('../supabase/migrations/20261026213000_vybora_live_event_registry.sql', 'file://' + __filename), 'utf8');
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /for select to anon, authenticated/i);
  assert.match(migration, /active = true/i);
  assert.match(migration, /status in \('upcoming','live','ended','cancelled'\)/);
  assert.match(migration, /embed_url is null or embed_url ~ '\^https:\/\//i);
});


test('optional video discovery providers have bounded network timeouts', () => {
  assert.match(html, /function fetchWithTimeout/);
  assert.ok(html.includes('controller.abort()'));
  assert.ok(html.includes("fetchWithTimeout('https://api.openverse.org/v1/videos/"));
  assert.ok(html.includes("fetchWithTimeout('https://archive.org/advancedsearch.php"));
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
  assert.match(html, /posts=rankFeedItems\(\[\.\.\.remote,\.\.\.featured\]\)/);
  assert.match(html, /loadOpenArchiveVideos\(1\)\.then\(archive=>/);
  assert.match(html, /Background open-video discovery unavailable/);
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
  assert.match(html, /const combined=\[\.\.\.entries\.filter\(Boolean\),\.\.\.commonsPromise,\.\.\.openversePromise,\.\.\.nasaPromise,\.\.\.blenderPromise,\.\.\.peertubePromise\]/);
  assert.match(html, /handle:'@openfeed'/);
  assert.doesNotMatch(html, /commons\.wikimedia\.org[\s\S]{0,1800}sb\.storage\.from\('vybora-media'\)\.upload/);
});

test('Discover adds Openverse and NASA sources with clean-content filtering and no media imports', () => {
  assert.match(html, /async function loadOpenverseVideos\(page=1,queryOverride=''\)/);
  assert.match(html, /https:\/\/api\.openverse\.org\/v1\/videos\//);
  assert.match(html, /license:'by,by-sa,cc0,pdm'/);
  assert.match(html, /unstable__sort_by:'indexed_on',unstable__sort_dir:'desc'/, 'prefer newly indexed open-license videos');
  assert.match(html, /mature:'false'/);
  assert.match(html, /async function loadNasaVideos\(page=1,queryOverride=''\)/);
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
  assert.match(html, /<video '\+\(dataSaver\?'data-src="'\+esc\(media\)\+'" ':'src="'\+esc\(media\)\+'" '\)\+\(dataSaver\?'':'autoplay '\)\+'muted playsinline loop/);
  assert.match(html, /if\(v\)\{v\.muted=true;if\(!dataSaver\)\{const playback=v\.play\(\)/);
  assert.match(html, /finishWatchSession\(card\);if\(v\)v\.pause\(\)/);
});

test('official live embeds remain in-app and do not display provider attribution or outbound watch links', () => {
  assert.match(html, /allow="autoplay; encrypted-media; picture-in-picture; fullscreen"/);
  assert.doesNotMatch(html, /esc\(e\.source_name\|\|'Official broadcaster'\)/);
  assert.doesNotMatch(html, /Watch on official service/);
  assert.doesNotMatch(html, /LIVE STATUS UNVERIFIED/);
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
  assert.ok(worker.includes("const SHELL = ['/', '/index.html', '/design-refresh.css', '/social-features.js'];"));
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
  assert.match(html, /posts=rankFeedItems\(\[\.\.\.remote,\.\.\.featured\]\)/);
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


test('live WebRTC buffers early ICE candidates until remote descriptions are ready', () => {
  const social = fs.readFileSync(new URL('../social-features.js', 'file://' + __filename), 'utf8');
  assert.match(social, /pendingIce=new Map\(\)/);
  assert.match(social, /async function setRemoteAndDrain\(pc,id,description\)/);
  assert.match(social, /if\(pc\?\.remoteDescription\)await pc\.addIceCandidate\(x\.payload\);else\{const queued=pendingIce\.get\(x\.sender_id\)\|\|\[\]/);
  assert.match(social, /for\(const candidate of queued\)await pc\.addIceCandidate\(candidate\)/);
  assert.match(social, /pendingIce\.clear\(\)/);
});


test('mobile auth modal close control is outside the modal header hit area', () => {
  assert.match(html, /<section class="modal"><button class="close modal-close" id="authClose" type="button"/);
  assert.match(html, /<div class="modal-top"><h2 id="authTitle">Join your universe\.<\/h2><\/div>/);
  assert.match(html, /design-refresh\.css/);
  assert.match(designCss, /\.modal > \.modal-close\{position:absolute;top:22px;right:22px;z-index:100/);
  assert.match(designCss, /\.modal\{width:min\(calc\(100vw - 36px\),420px\);max-width:calc\(100vw - 36px\);min-width:0/);
});



test('mobile header action controls have non-overlapping hit targets', () => {
  assert.match(designCss, /\.top-actions #friendsBtn,\.top-actions #liveBtn,\.top-actions #dataSaverBtn,\.top-actions #soundBtn\{width:32px;min-width:32px;max-width:32px;height:32px/);
  assert.match(designCss, /\.top-actions #accountBtn\{min-width:58px;padding:8px 10px;font-size:12px/);
});


test('creator muting is private, persisted, manageable, and applied to feed pagination', () => {
  assert.match(muteMigration, /create table if not exists public\.vybora_mutes/);
  assert.match(muteMigration, /enable row level security/);
  assert.match(muteMigration, /revoke all on public\.vybora_mutes from anon, authenticated/);
  assert.match(muteMigration, /using \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.match(html, /async function syncMutedAuthors\(\)/);
  assert.match(html, /sb\.from\('vybora_mutes'\)\.select\('muted_user_id'\)/);
  assert.match(html, /async function muteCreator\(author\)/);
  assert.match(html, /async function unmuteCreator\(author\)/);
  assert.match(html, /async function openMutedCreators\(\)/);
  assert.match(html, /data-action="mute"/);
  assert.match(html, /data-unmute-creator/);
  assert.match(html, /!mutedAuthors\.has\(p\.author_id\)/);
  assert.match(html, /Manage muted creators/);
});


test('account blocking is enforced by private RLS helper across social interactions', () => {
  assert.match(blockMigration, /create table if not exists public\.vybora_blocks/);
  assert.match(blockMigration, /alter table public\.vybora_blocks enable row level security/);
  assert.match(blockMigration, /create or replace function private\.vybora_is_blocked/);
  assert.match(blockMigration, /security definer set search_path = ''/);
  assert.match(blockMigration, /revoke all on function private\.vybora_is_blocked\(uuid\) from public, anon/);
  assert.match(blockMigration, /grant execute on function private\.vybora_is_blocked\(uuid\) to authenticated/);
  assert.match(blockMigration, /VYBORA friends send messages without blocks/);
  assert.match(blockMigration, /VYBORA users request friendship without blocks/);
  assert.match(blockMigration, /Members cannot read blocked VYBORA posts/);
  assert.match(blockMigration, /Members send live signals without blocks/);
  assert.match(html, /async function blockCreator\(author\)/);
  assert.match(html, /async function unblockCreator\(author\)/);
  assert.match(html, /async function openBlockedCreators\(\)/);
  assert.match(html, /data-action="block"/);
  assert.match(html, /data-unblock-creator/);
  assert.match(html, /Manage blocked accounts/);
  assert.match(socialSource, /The account may have blocked you or the friend connection is no longer active/);
});


test('report moderation queue is app-metadata gated with a private audit trail', () => {
  assert.match(moderationMigration, /auth\.jwt\(\) -> 'app_metadata'/);
  assert.match(moderationMigration, /vybora_role/);
  assert.match(moderationMigration, /private\.vybora_report_reviews/);
  assert.match(moderationHardening, /revoke all on private\.vybora_report_reviews from public, anon, authenticated/);
  assert.match(moderationHardening, /VYBORA audit log is not directly accessible/);
  assert.match(moderationHardening, /private\.vybora_review_report_impl/);
  assert.match(moderationHardening, /security definer set search_path = ''/);
  assert.match(moderationHardening, /revoke all on function private\.vybora_review_report_impl/);
  assert.match(moderationHardening, /grant execute on function public\.vybora_review_report/);
  assert.match(socialSource, /user\.app_metadata\?\.vybora_role/);
  assert.match(socialSource, /sb\.rpc\('vybora_review_report'/);
  assert.match(socialSource, /event:'\*'/);
  assert.match(html, /id="moderationBackdrop"/);
  assert.match(html, /id="moderationOpenBtn"[^>]*hidden/);
  assert.match(moderationHardening, /returns void language sql security invoker set search_path = ''/);
  assert.doesNotMatch(socialSource, /user_metadata/);
});

test('chat read receipts update only read_at and expose unread counts', () => {
  assert.match(readReceiptsMigration, /grant update\(read_at\) on public\.vybora_messages to authenticated/);
  assert.match(readReceiptHardening, /read_at is null/);
  assert.match(readReceiptHardening, /read_at is not null/);
  assert.match(socialSource, /select\('id,sender_id,recipient_id,body,created_at,read_at'\)/);
  assert.match(socialSource, /update\(\{read_at:readAt\}\)/);
  assert.match(socialSource, /m\.read_at\?' · Seen':' · Sent'/);
  assert.match(socialSource, /refreshUnreadCount/);
  assert.match(socialSource, /event:'\*'/);
  assert.match(socialSource, /unread-count/);
  assert.match(html, /unread-count/);
});

test('Data Saver avoids background catalogue downloads and respects device data-saving preferences', () => {
  assert.match(html, /const saved=localStorage\.getItem\('vybora:data-saver:v1'\);if\(saved!==null\)return saved==='on'/);
  assert.match(html, /connection\?\.saveData\|\|\/\^\(slow-2g\|2g\)\$\//);
  assert.match(html, /dataSaver&&isExternal&&!isDirectExternal/);
  assert.match(html, /if\(dataSaver\)return \[\]/);
  assert.match(html, /async function loadOpenArchiveVideos\(page=1\)\{\s*if\(dataSaver\)return \[\]/);
  assert.match(html, /async function loadMoreArchiveOnly\(\)\{\s*if\(dataSaver\)return/);
  assert.match(html, /if\(!dataSaver\)refreshActiveFeed\(\)/);
});

test('personalized feed ranking diversifies creators without discarding relevance scores', () => {
  assert.match(html, /function feedCreatorKey\(post\)/);
  assert.match(html, /function diversifyFeedItems\(ranked\)/);
  assert.match(html, /output\.slice\(-2\)/);
  assert.match(html, /remaining\.findIndex\(post=>!recent\.has\(feedCreatorKey\(post\)\)\)/);
  assert.match(html, /return diversifyFeedItems\(ranked\)/);
});


test('viewers can steer recommendations with private negative feedback and reset feed learning', () => {
  assert.match(html, /data-action="not-interested"/);
  assert.match(html, /function recordNotInterested\(post\)/);
  assert.match(html, /profile\.hiddenPosts=.*slice\(-120\)/);
  assert.match(html, /profile\.avoidCreators/);
  assert.match(html, /profile\.avoidTopics/);
  assert.match(html, /const negative=avoidCreator\+avoidTopic/);
  assert.match(html, /items\.filter\(p=>!hiddenPosts\.has\(String\(p\.id\)\)\)/);
  assert.match(html, /action==='not-interested'/);
  assert.match(html, /posts=posts\.filter\(p=>String\(p\.id\)!==String\(id\)\);allPosts=allPosts\.filter\(p=>String\(p\.id\)!==String\(id\)\)/);
  assert.match(html, /id="resetFeedLearningBtn"/);
  assert.match(html, /localStorage\.removeItem\(WATCH_INTEREST_KEY\)/);
  assert.doesNotMatch(html, /sb\.from\(['"]vybora_watch_feedback/);
});


test('infinite feed pagination preserves dismissed posts and applies learned preferences to new items', () => {
  assert.match(html, /const fresh=rankFeedItems\(additions\)\.filter\(p=>!known\.has\(String\(p\.id\)\)\)/);
  assert.match(html, /const batch=await loadOpenArchiveVideos\(archivePage\+1\),known=new Set\(allPosts\.map\(p=>String\(p\.id\)\)\),fresh=rankFeedItems\(batch\)/);
  assert.match(html, /allPosts=allPosts\.concat\(fresh\);posts=posts\.concat\(fresh\)/);
  assert.doesNotMatch(html, /allPosts=allPosts\.concat\(fresh\);posts=allPosts/);
});

test('viewers can understand why a video was recommended without sending watch history to the server', () => {
  assert.match(html, /function recommendationReason[(]post[)]/);
  assert.match(html, /data-action="why"/);
  assert.match(html, /action==='why'/);
  assert.match(html, /currentIntentTokens\.some\(token=>words\.includes\(token\)\)/);
  assert.match(html, /Because you follow this creator/);
  assert.match(html, /creator variety/);
  assert.doesNotMatch(html, /sb\.from\(['"]vybora_watch_interests/);
});

test('offline worker caches the VYBORA stylesheet and serves its last good copy offline', () => {
  const worker = fs.readFileSync(new URL('../service-worker.js', 'file://' + __filename), 'utf8');
  assert.match(worker, /const CACHE_NAME = 'vybora-shell-v3'/);
  assert.ok(worker.includes("'/design-refresh.css'"));
  assert.ok(worker.includes("url.pathname === '/design-refresh.css'"));
  assert.ok(worker.includes('if (response.ok) await cache.put(request, response.clone())'));
  assert.ok(worker.includes('(await cache.match(request, { ignoreSearch: true })) || Response.error()'));
});


test('Data Saver reduces community feed page sizes without changing normal browsing', () => {
  assert.match(html, /const initialPostBatchSize=dataSaver\?30:100/);
  assert.match(html, /\.limit\(initialPostBatchSize\)/);
  assert.match(html, /feedHasMore=rows\.length===initialPostBatchSize/);
  assert.match(html, /const postBatchSize=dataSaver\?20:50/);
  assert.match(html, /\.range\(feedPostOffset,feedPostOffset\+postBatchSize-1\)/);
  assert.match(html, /feedHasMore=\(rows\|\|\[\]\)\.length===postBatchSize/);
});


test('Following feed fetches public posts from the signed-in viewer’s followed creators', () => {
  assert.match(html, /async function loadFollowingFeed\(\)/);
  assert.match(html, /sb\.from\('vybora_follows'\)\.select\('followed_id'\)\.eq\('follower_id',user\.id\)/);
  assert.match(html, /sb\.from\('vybora_posts'\)[\s\S]*?\.in\('author_id',followedIds\)/);
  assert.match(html, /function setTab\(tab\)[\s\S]*?if\(tab==='Following'\)[\s\S]*?loadFollowingFeed\(\)/);
  assert.match(html, /async function refreshActiveFeed\(\)\{if\(activeTab==='Following'&&user\)return loadFollowingFeed\(\);if\(activeTab==='Search'\)return searchVideos\(\$\('searchInput'\)\.value\);return loadFeed\(\)\}/);
  assert.doesNotMatch(html, /allPosts\.filter\(p=>p\.following/);
});


test('Following feed paginates its own creator-only result set', () => {
  assert.match(html, /followingPostOffset=\(rows\|\|\[\]\)\.length/);
  assert.match(html, /\.range\(0,pageSize-1\)/);
  assert.match(html, /async function loadMoreFollowingFeed\(\)/);
  assert.match(html, /\.range\(followingPostOffset,followingPostOffset\+pageSize-1\)/);
  assert.match(html, /followingHasMore=\(rows\|\|\[\]\)\.length===pageSize/);
  assert.match(html, /if\(activeTab==='Following'\)loadMoreFollowingFeed\(\);else\{loadMoreFeed\(\);loadMoreArchiveOnly\(\)\}/);
});


test('video signature detection identifies WebM, MP4, MOV and rejects unrelated files', async () => {
  const start = html.indexOf('async function getSupportedVideoMimeType(file){');
  const end = html.indexOf('async function getVideoDuration(file)', start);
  assert.ok(start >= 0 && end > start, 'video signature helper should be present');
  const detectMime = vm.runInNewContext('(' + html.slice(start, end).trim() + ')');
  const fakeFile = bytes => ({ slice: () => ({ arrayBuffer: async () => Uint8Array.from(bytes).buffer }) });
  assert.equal(await detectMime(fakeFile([0x1a,0x45,0xdf,0xa3,0,0,0,0])), 'video/webm');
  assert.equal(await detectMime(fakeFile([0,0,0,24,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d])), 'video/mp4');
  assert.equal(await detectMime(fakeFile([0,0,0,24,0x66,0x74,0x79,0x70,0x71,0x74,0x20,0x20])), 'video/quicktime');
  assert.equal(await detectMime(fakeFile([0,1,2,3,4,5,6,7,8,9,10,11])), null);
  assert.equal(await detectMime({}), null);
});


test('creators can delete only their own posts and uploaded media', () => {
  assert.match(html, /user&&p\.author_id===user\.id\?'[\s\S]*?data-action="delete"/);
  assert.match(html, /if\(action==='delete'\)\{if\(!user\|\|post\.author_id!==user\.id/);
  assert.match(html, /sb\.storage\.from\('vybora-media'\)\.remove\(\[post\.media_path\]\)/);
  assert.match(html, /sb\.from\('vybora_posts'\)\.delete\(\)\.eq\('id',post\.id\)\.eq\('author_id',user\.id\)/);
  assert.ok(html.includes("post.media_path){if(!String(post.media_path).startsWith(user.id+'/'))"));
  assert.doesNotMatch(html, /update\(\{expires_at:new Date\(\)\.toISOString\(\)\}\)/);
});


test('search results preserve mute and block preferences when refreshed', () => {
  assert.match(html, /filter\(p=>\(p\.body\+' '\+\(p\.username\|\|''\)\+' '\+\(p\.handle\|\|''\)\)\.toLowerCase\(\)\.includes\(q\.toLowerCase\(\)\)&&!mutedAuthors\.has\(p\.author_id\)&&!blockedAuthors\.has\(p\.author_id\)\)/);
  assert.match(html, /const dbPosts=\(postRows\|\|\[\]\)\.filter\(p=>\(window\.vyboraAllowMature\|\|!p\.mature_content\)&&!mutedAuthors\.has\(p\.author_id\)&&!blockedAuthors\.has\(p\.author_id\)\)/);
  assert.match(html, /\.eq\('visibility','public'\)\.not\('media_url','is',null\)\.or\('expires_at\.is\.null,expires_at\.gt\.'\+new Date\(\)\.toISOString\(\)\)\.ilike\('body',pattern\)/);
});

test('feed actions refresh the active search instead of replacing it with For You', () => {
  assert.ok(html.includes("if(activeTab==='Search')return searchVideos($('searchInput').value)"));
});


test('blocked creators stay hidden in the initial and paginated community feed', () => {
  assert.match(html, /rows=rows\.filter\(p=>\(window\.vyboraAllowMature\|\|!p\.mature_content\)&&!mutedAuthors\.has\(p\.author_id\)&&!blockedAuthors\.has\(p\.author_id\)\)/);
  assert.match(html, /const clean=\(rows\|\|\[\]\)\.filter\(p=>\(window\.vyboraAllowMature\|\|!p\.mature_content\)&&!mutedAuthors\.has\(p\.author_id\)&&!blockedAuthors\.has\(p\.author_id\)\)/);
});


test('like and save actions refresh the active feed instead of forcing For You', () => {
  const likeStart = html.indexOf("if(action==='like')");
  const followStart = html.indexOf("if(action==='follow')", likeStart);
  assert.ok(likeStart >= 0 && followStart > likeStart);
  assert.match(html.slice(likeStart, followStart), /await refreshActiveFeed\(\);return/);
  assert.ok(html.includes("tell(existing?'Removed from saved videos.':'Video saved to your account.');await refreshActiveFeed();return}}"));
});


test('database search results hydrate real likes, bookmarks and comment counts', () => {
  assert.match(html, /const searchPostIds=dbPosts\.map\(p=>p\.id\)/);
  assert.match(html, /vybora_post_stats'\)\.select\('post_id,likes_count'\)\.in\('post_id',searchPostIds\)/);
  assert.match(html, /vybora_reactions'\)\.select\('post_id'\)\.eq\('user_id',user\.id\)\.in\('post_id',searchPostIds\)/);
  assert.match(html, /vybora_bookmarks'\)\.select\('post_id'\)\.eq\('user_id',user\.id\)\.in\('post_id',searchPostIds\)/);
  assert.match(html, /liked:searchLiked\.has\(p\.id\),saved:searchSaved\.has\(p\.id\),comments_count:searchComments\[p\.id\]\|\|0/);
});


test('search results remain addressable by shared video actions', () => {
  assert.match(html, /const found=rankFeedItems\(\[\.\.\.dedup\.values\(\)\]\)/);
  assert.match(html, /posts=found;activeTab='Search'/);
  assert.match(html, /id,post=posts\.find\(p=>String\(p\.id\)===id\)\|\|demo\.find\(p=>p\.id===id\)/);
});


test('later For You pages hydrate real viewer likes, saves, follows and comment counts', () => {
  const start = html.indexOf('async function loadMoreFeed()');
  const end = html.indexOf("feed.addEventListener('scroll'", start);
  const loader = html.slice(start, end);
  assert.match(loader, /sb\.from\('vybora_reactions'\)\.select\('post_id'\)\.eq\('user_id',user\.id\)/);
  assert.match(loader, /sb\.from\('vybora_bookmarks'\)\.select\('post_id'\)\.eq\('user_id',user\.id\)/);
  assert.match(loader, /sb\.from\('vybora_follows'\)\.select\('followed_id'\)\.eq\('follower_id',user\.id\)/);
  assert.match(loader, /sb\.from\('vybora_comments'\)\.select\('post_id'\)/);
  assert.match(loader, /liked:myLikes\.has\(p\.id\),saved:mySaves\.has\(p\.id\),following:following\.has\(p\.author_id\),comments_count:commentCounts\[p\.id\]\|\|0/);
  assert.match(loader, /const \[statsResult,commentsResult,reactsResult,marksResult,followingResult\]=await Promise\.all\(/);
});


test('initial feed hydrates creator and viewer metadata concurrently', () => {
  const start = html.indexOf('async function loadFeed()');
  const end = html.indexOf('async function ensureProfile()', start);
  const loader = html.slice(start, end);
  assert.match(loader, /const \[statsResult,likesResult,followsResult,bookmarksResult,profilesResult,commentsResult\]=await Promise\.all\(/);
  assert.match(loader, /sb\.from\('vybora_reactions'\)\.select\('post_id'\)\.eq\('user_id',user\.id\)/);
  assert.match(loader, /sb\.from\('vybora_bookmarks'\)\.select\('post_id'\)\.eq\('user_id',user\.id\)/);
  assert.match(loader, /sb\.from\('vybora_comments'\)\.select\('post_id'\)\.in\('post_id',ids\)/);
  assert.match(loader, /comments_count:ccounts\[p\.id\]\|\|0/);
});


test('Following feed hydrates profile and interaction state concurrently', () => {
  const start = html.indexOf('async function hydrateFollowingRows(rows)');
  const end = html.indexOf('async function loadFollowingFeed()', start);
  const loader = html.slice(start, end);
  assert.match(loader, /const \[profilesResult,statsResult,likesResult,bookmarksResult,commentsResult\]=await Promise\.all\(/);
  assert.match(loader, /sb\.from\('vybora_reactions'\)\.select\('post_id'\)\.eq\('user_id',user\.id\)/);
  assert.match(loader, /sb\.from\('vybora_bookmarks'\)\.select\('post_id'\)\.eq\('user_id',user\.id\)/);
  assert.match(loader, /sb\.from\('vybora_comments'\)\.select\('post_id'\)/);
  assert.match(loader, /following:true,comments_count:commentCounts\[p\.id\]\|\|0/);
});


test('turning Data Saver off preserves the current Search view', () => {
  assert.match(html, /render\(\);if\(activeTab==='Following'&&user\)loadFollowingFeed\(\);else if\(!dataSaver\)refreshActiveFeed\(\);tell\(dataSaver\?/);
  assert.match(html, /async function refreshActiveFeed\(\)\{if\(activeTab==='Following'&&user\)return loadFollowingFeed\(\);if\(activeTab==='Search'\)return searchVideos\(\$\('searchInput'\)\.value\);return loadFeed\(\)\}/);
});


test('live signaling waits for realtime readiness and reconciles viewers that joined during host startup', () => {
  const start = socialSource.indexOf('async function liveRealtime()');
  const end = socialSource.indexOf('async function refreshLive()', start);
  const signaling = socialSource.slice(start, end);
  assert.ok(start >= 0 && end > start, 'live signaling implementation should exist');
  assert.match(signaling, /next\.subscribe\(status=>\{if\(status==='SUBSCRIBED'\)resolve\(\)/);
  assert.match(signaling, /if\(host\)\{const \{data,error\}=await sb\.from\('vybora_live_participants'\)\.select\('user_id'\)/);
  assert.match(signaling, /for\(const participant of data\|\|\[\]\)await offerViewer\(participant\.user_id\)/);
  assert.match(socialSource, /liveSay\('Joining live…'\);try\{await liveRealtime\(\)\}/);
  assert.match(socialSource, /liveSay\('You are live\. Keep this screen open\.'\);try\{await liveRealtime\(\);startLiveHeartbeat\(\)\}/);
  assert.match(socialSource, /async function offerViewer\(id\)[\s\S]*?pc\.close\(\);peers\.delete\(id\)/);
});


test('live host heartbeats keep active rooms alive and scheduled cleanup ends abandoned rooms atomically', () => {
  assert.match(liveHeartbeatMigration, /add column if not exists heartbeat_at timestamptz not null default now\(\)/i);
  assert.match(liveHeartbeatMigration, /where status = 'live'[\s\S]*heartbeat_at < p_stale_before/i);
  assert.match(liveHeartbeatMigration, /delete from public\.vybora_live_participants[\s\S]*delete from public\.vybora_live_signals/i);
  assert.match(liveHeartbeatMigration, /grant execute on function public\.vybora_cleanup_stale_live_sessions\(timestamptz\) to service_role/i);
  assert.match(liveHeartbeatMigration, /revoke update on public\.vybora_live_sessions from authenticated/i);
  assert.match(liveHeartbeatMigration, /grant update \(status, ended_at\) on public\.vybora_live_sessions to authenticated/i);
  assert.match(liveHeartbeatHardeningMigration, /drop function if exists public\.vybora_touch_live_session\(uuid\)/i);
  assert.match(liveHeartbeatHardeningMigration, /grant update \(status, ended_at, heartbeat_at\)\s+on public\.vybora_live_sessions to authenticated/i);
  assert.match(liveHeartbeatHardeningMigration, /before insert or update on public\.vybora_live_sessions/i);
  assert.match(liveHeartbeatHardeningMigration, /auth\.uid\(\) <> old\.host_id/i);
  assert.match(liveHeartbeatHardeningMigration, /new\.heartbeat_at := clock_timestamp\(\)/i);
  assert.match(socialSource, /async function touchLiveHeartbeat\(\)/);
  assert.match(socialSource, /sb\.from\('vybora_live_sessions'\)\.update\(\{heartbeat_at:new Date\(\)\.toISOString\(\)\}\)/);
  assert.match(socialSource, /setInterval\(\(\)=>touchLiveHeartbeat\(\)\.catch\(error=>console\.warn\('Live heartbeat update failed',error\)\),30000\)/);
  assert.match(socialSource, /try\{await liveRealtime\(\);startLiveHeartbeat\(\)\}/);
  assert.match(socialSource, /async function leaveLive\(\)\{stopLiveHeartbeat\(\)/);
  assert.match(cleanupFunction, /vybora_cleanup_stale_live_sessions/);
  assert.match(cleanupFunction, /Date\.now\(\) - 30 \* 60 \* 1000/);
});


test('live rooms expose participant-only chat and database-maintained viewer counts', () => {
  assert.match(liveChatMigration, /add column if not exists viewer_count integer not null default 0/i);
  assert.match(liveChatMigration, /create table if not exists public\.vybora_live_chat_messages/i);
  assert.match(liveChatMigration, /create or replace function public\.vybora_guard_live_chat_insert/i);
  assert.match(liveChatMigration, /v_recent_count >= 20/i);
  assert.match(liveChatMigration, /new\.created_at := clock_timestamp\(\)/i);
  assert.match(socialSource, /insert\(\{session_id:live\.id,sender_id:user\.id,body\}\)\.select\('id,sender_id,body,created_at'\)/);
  assert.match(liveChatMigration, /enable row level security/i);
  assert.match(liveChatMigration, /create policy "Live participants read live chat"[\s\S]*vybora_live_participants/i);
  assert.match(liveChatMigration, /create policy "Live participants send live chat"[\s\S]*sender_id = \(select auth\.uid\(\)\)/i);
  assert.match(liveChatMigration, /after insert or delete on public\.vybora_live_participants/i);
  assert.match(liveChatMigration, /alter publication supabase_realtime add table public\.vybora_live_chat_messages/i);
  assert.match(liveChatMigration, /create policy "Vybora active live sessions are public"[\s\S]*exists \([\s\S]*vybora_live_participants/i);
  assert.match(liveChatMigration, /delete from public\.vybora_live_chat_messages where session_id = v_session_id/i);
  assert.match(liveChatMigration, /grant execute on function public\.vybora_cleanup_stale_live_sessions\(timestamptz\) to service_role/i);
  assert.match(cleanupFunction, /removedLiveChatMessages/);
  assert.match(socialSource, /async function liveChatRealtime\(\)/);
  assert.match(socialSource, /liveChatPending\.forEach\(message=>merged\.set\(message\.id,message\)\)/);
  assert.match(socialSource, /\.sort\(\(a,b\)=>new Date\(a\.created_at\)-new Date\(b\.created_at\)\)/);
  assert.match(socialSource, /async function sendLiveChat\(e\)/);
  assert.match(socialSource, /async function refreshLiveCount\(\)/);
  assert.match(socialSource, /liveChatForm.*addEventListener\('submit',sendLiveChat\)/);
});


test('direct live video uses a mobile data-saving capture and per-viewer bitrate cap', () => {
  assert.match(socialSource, /width:\{ideal:640\},height:\{ideal:360\},frameRate:\{ideal:24,max:24\}/);
  assert.match(socialSource, /noiseSuppression:true/);
  assert.match(socialSource, /maxBitrate:650000,maxFramerate:24/);
});

test('direct WebRTC live rooms enforce a safe viewer cap until SFU media is available', () => {
  assert.match(liveCapacityMigration, /viewer_count >= 3/i);
  assert.match(html, /limited to 3 viewers per room/i);
  assert.match(socialSource, /Number\(x\.viewer_count\|\|0\)>=3\?'disabled':''/);
  assert.match(liveCapacityMigration, /for update/i);
  assert.match(liveCapacityMigration, /as restrictive/i);
  assert.match(liveCapacityMigration, /create trigger vybora_live_participant_capacity_guard/i);
  assert.match(socialSource, /This live room has reached its safe viewer limit/);
});


test('stale live cleanup preserves participant authorization during terminal-event grace', () => {
  assert.match(liveCleanupGraceMigration, /interval '20 minutes'/i);
  assert.match(liveCleanupGraceMigration, /retain participant rows for a grace window/i);
  assert.match(liveCleanupGraceMigration, /delete from public\.vybora_live_participants p[\s\S]*s\.status = 'ended'/i);
  assert.match(liveCleanupGraceMigration, /s\.ended_at < now\(\) - interval '20 minutes'/i);
  assert.match(liveCleanupGraceMigration, /s\.status = 'live'/i);
  assert.match(liveCleanupGraceMigration, /join public\.vybora_live_sessions s[\s\S]*s\.status = 'live'/i);
});


test('PeerTube expands open-licensed discovery and rejects private, mature, and live results from the watch feed', () => {
  assert.match(html, /async function loadPeerTubeVideos\(page=1,searchTerm='short film'\)/);
  assert.match(html, /https:\/\/sepiasearch\.org\/api\/v1\/search\/videos/);
  assert.match(html, /licenceOneOf:'1,2,7,8'/);
  assert.match(html, /video\.isLive===true\|\|video\.nsfw===true/);
  assert.match(html, /video\.privacy\?\.id!=null&&Number\(video\.privacy\.id\)!==1/);
  assert.match(html, /embed\.origin!==source\.origin/);
  assert.match(html, /loadPeerTubeVideos\(page\)/);
  assert.match(html, /requestPage\*20<Number\(payload\.total\)/);
  assert.ok(html.includes("!/^([a-z0-9-]+\\.)+[a-z]{2,}$/i.test(source.hostname)"));
});

test('PeerTube feed prioritizes trending and live tab requests only active streams', () => {
  assert.match(html, /if\(searchTerm==='short film'\)params\.set\('sort','-trending'\)/);
  assert.doesNotMatch(html, /'-match'/);
  assert.match(html, /search:'live',isLive:'true'/);
});

test('Live tab discovers and re-verifies currently live PeerTube streams before embedding them', () => {
  assert.match(html, /async function loadPeerTubeLiveEvents\(hub,signal\)/);
  assert.match(html, /detail\.isLive!==true/);
  assert.match(html, /detail\.state\?\.id!=null&&Number\(detail\.state\.id\)!==1/);
  assert.match(html, /peertube-live-event/);
  assert.match(html, /loadPeerTubeLiveEvents\(hub,liveScrollSignal\)/);
  assert.match(html, /feed\.addEventListener\('scroll',[\s\S]*?appendPage\(\)/);
  assert.match(html, /loadPeerTubeLiveEvents\(hub,liveScrollSignal\)/);
  assert.match(html, /function setTab\(tab\)\{if\(tab!=='Live'\)window\.vyboraLiveScrollController\?\.abort\(\)/);
});

test('live event embeds support additional providers and satisfy Twitch parent-domain requirements', () => {
  assert.match(html, /geo\.dailymotion\.com/);
  assert.match(html, /player\.kick\.com/);
  assert.match(html, /u\.searchParams\.set\('parent',location\.hostname\)/);
});

test('feed scroll loading is animation-frame throttled to avoid repeated layout and network work', () => {
  assert.match(html, /let feedScrollQueued=false;feed\.addEventListener\('scroll'/);
  assert.match(html, /requestAnimationFrame\(\(\)=>\{feedScrollQueued=false/);
  assert.match(html, /if\(!entry\.isIntersecting\)\{if\(v&&v\.getAttribute\('src'\)\)/);
  assert.match(html, /v\.dataset\.src=v\.getAttribute\('src'\)/);
});


test('topic search queries the federated PeerTube catalogue and additional open video sources without importing media', () => {
  assert.match(html, /async function loadPeerTubeVideos\(page=1,searchTerm='short film'\)/);
  assert.match(html, /search:String\(searchTerm\|\|'short film'\)/);
  assert.match(html, /loadPeerTubeVideos\(1,q\)/);
  assert.match(html, /async function loadNasaVideos\(page=1,queryOverride=''\)/);
  assert.match(html, /q:String\(queryOverride\|\|'NASA'\)/);
  assert.match(html, /loadNasaVideos\(1,q\)/);
  assert.match(html, /loadOpenverseVideos\(1,q\)/);
  assert.match(html, /loadBlenderVideos\(1,q\)/);
  assert.match(html, /federated creators/);
});
