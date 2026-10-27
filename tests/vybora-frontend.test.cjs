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

test('curated videos use VYBORA branding without stripping creator attribution', () => {
  assert.match(html, /isCurated\?'VYBORA PICKS'/);
  assert.match(html, /aria-label="Curated for VYBORA">VYBORA PICKS/);
  assert.doesNotMatch(html, /Watch video ↗/);
  assert.doesNotMatch(html, /esc\(p\.source_name\|\|'ONLINE'\)/);
  assert.match(html, /p\.username\|\|p\.name\|\|'VYBORA creator'/);
});

test('Live tab provides in-app live participation and official football coverage', () => {
  assert.match(html, /data-tab="Live"/);
  assert.match(html, /function renderLiveEvents\(\)/);
  assert.match(html, /class="live-hub"/);
  assert.match(html, /data-open-live="join"/);
  assert.match(html, /data-open-live="start"/);
  assert.match(html, /data-live-rooms/);
  assert.match(html, /data-join-vybora-live/);
  assert.match(html, /vybora_live_sessions/);
  assert.match(html, /https:\/\/www\.fifa\.com\/en\/watch/);
  assert.match(html, /https:\/\/www\.uefa\.tv\//);
  assert.match(html, /https:\/\/footballkenya\.org\/media\/broadcasters/);
  assert.match(html, /https:\/\/azamtv\.co\.tz\//);
  assert.match(html, /rel="noopener noreferrer"/);
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

test('Live tab offers in-app live room participation and keeps official sports links as secondary options', () => {
  assert.match(html, /data-open-live="join"/);
  assert.match(html, /data-open-live="start"/);
  assert.match(html, /Open live rooms/);
  assert.match(html, /Go live/);
});

test('video feed avoids downloading every clip at once and does not fake variety with duplicate demo clips', () => {
  assert.match(html, /index===0\?'auto':'none'/);
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
  assert.match(html, /Reuse license/);
  assert.doesNotMatch(html, /archive\.org[\s\S]{0,1500}sb\.storage\.from\('vybora-media'\)\.upload/);
});

test('feed cards remove platform-source badges while preserving mature-content warnings', () => {
  assert.doesNotMatch(html, /COMMUNITY SHARE/);
  assert.doesNotMatch(html, /VYBORA PICKS/);
  assert.match(html, /p\.mature_content\?'<div class="muted-badge">18\+ · MATURE<\/div>'/);
});
