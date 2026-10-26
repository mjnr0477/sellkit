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
  assert.match(html, /WATCH FROM THE ORIGINAL SOURCE/);
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
  assert.match(html, /emailRedirectTo:location\.origin\+location\.pathname/);
  assert.doesNotMatch(html, /service_role|sb_secret_/);
});

test('video upload uses VYBORA storage and database records', () => {
  assert.match(html, /sb\.storage\.from\('vybora-media'\)\.upload/);
  assert.match(html, /sb\.from\('vybora_posts'\)\.insert/);
  assert.match(html, /media_path:path/);
  assert.match(html, /expires_at:new Date\(Date\.now\(\)\+24\*60\*60\*1000\)/);
  assert.match(html, /file\.size>30\*1024\*1024/);
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

test('inline application JavaScript parses without syntax errors', () => {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(source => source.trim());
  assert.ok(scripts.length > 0, 'expected inline application script');
  for (const source of scripts) new vm.Script(source);
});
