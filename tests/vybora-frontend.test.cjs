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
  assert.match(html, /const list=allPosts\.filter\(p=>p\.following&&!mutedAuthors\.has\(p\.author_id\)\)/);
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


test('official live-event feed embeds only recently verified active events and hides source links', () => {
  assert.match(html, /async function loadOfficialEvents\(\)/);
  assert.match(html, /vybora_live_events/);
  assert.match(html, /\.eq\('status','live'\)/);
  assert.match(html, /last_verified_at&&now-Date\.parse\(e\.last_verified_at\)<60\*60\*1000/);
  assert.match(html, /class="official-live-player"/);
  assert.match(html, /const allowed=\['youtube\.com','www\.youtube\.com','www\.youtube-nocookie\.com','player\.vimeo\.com','vimeo\.com','www\.twitch\.tv','player\.twitch\.tv'\]/);
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


test('live WebRTC buffers early ICE candidates until remote descriptions are ready', () => {
  const social = fs.readFileSync(new URL('../social-features.js', 'file://' + __filename), 'utf8');
  assert.match(social, /pendingIce=new Map\(\)/);
  assert.match(social, /async function setRemoteAndDrain\(pc,id,description\)/);
  assert.match(social, /if\(pc\?\.remoteDescription\)await pc\.addIceCandidate\(x\.payload\);else\{let queued=pendingIce\.get\(x\.sender_id\)\|\|\[\]/);
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
  assert.match(html, /dataSaver\?\{data:\[\],error:null\}:await sb\.from\('vybora_external_videos'\)/);
  assert.match(html, /async function loadOpenArchiveVideos\(page=1\)\{\s*if\(dataSaver\)return \[\]/);
  assert.match(html, /async function loadMoreArchiveOnly\(\)\{\s*if\(dataSaver\)return/);
  assert.match(html, /if\(!dataSaver\)loadFeed\(\)/);
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
  assert.match(html, /id="resetFeedLearningBtn"/);
  assert.match(html, /localStorage\.removeItem\(WATCH_INTEREST_KEY\)/);
  assert.doesNotMatch(html, /sb\.from\(['"]vybora_watch_feedback/);
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
