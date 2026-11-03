import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { Script } from 'node:vm';
import { resolve } from 'node:path';

const root = process.cwd();
const read = path => readFile(resolve(root, path), 'utf8');
const failures = [];
function check(label, condition) {
  if (!condition) failures.push(label);
  else console.log('PASS', label);
}
function syntaxCheck(path) {
  const result = spawnSync(process.execPath, ['--check', path], {
    cwd: root, encoding: 'utf8'
  });
  check(`JavaScript syntax: ${path}`, result.status === 0);
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || '');
  }
}

const [html, social, worker, launcher, packageJson] = await Promise.all([
  read('index.html'),
  read('social-features.js'),
  read('service-worker.js'),
  read('scripts/prepare-web.mjs'),
  read('package.json')
]);
try {
  JSON.parse(packageJson);
  check('package.json is valid JSON', true);
} catch (error) {
  check('package.json is valid JSON', false);
  console.error(error);
}

// Compile every inline browser script without executing browser-side code.
const inlineScripts = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(source => source.trim());
check('At least one inline application script exists', inlineScripts.length > 0);
for (let index = 0; index < inlineScripts.length; index += 1) {
  try {
    new Script(inlineScripts[index], { filename: `index.html:inline-script-${index + 1}` });
    check(`Inline browser script ${index + 1} parses`, true);
  } catch (error) {
    check(`Inline browser script ${index + 1} parses`, false);
    console.error(error);
  }
}

const requiredIds = [
  'feed', 'accountBtn', 'authForm', 'postForm', 'videoFile',
  'commentsBackdrop', 'commentForm', 'profileForm', 'savedList',
  'searchInput', 'dataSaverBtn', 'soundBtn', 'friendsBackdrop',
  'friendSearch', 'friendList', 'chatForm', 'liveBackdrop',
  'startLiveBtn', 'liveRoom', 'reportForm', 'moderationList'
];
const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
for (const id of requiredIds) check(`Required interface element #${id}`, htmlIds.has(id));

check('Social feature bundle is loaded by the production page', /<script[^>]+src=["'][^"']*social-features\.js(?:\?[^"']*)?["']/i.test(html));
check('Service worker is registered by the production page', /serviceWorker\.register\([^)]*service-worker\.js/i.test(html));
check('Supabase client uses a publishable key', /sb_publishable_[A-Za-z0-9_-]+/.test(html));
check('No Supabase service-role or secret key is embedded in browser code',
  !/(service[_-]?role|sb_secret_[A-Za-z0-9_-]+)/i.test(html + social + worker + launcher));

const application = html + social;
for (const [label, token] of [
  ['Persistent authentication sessions', 'persistSession:true'],
  ['Auth state listener', 'onAuthStateChange'],
  ['Community feed query', 'vybora_posts'],
  ['Content reporting flow', 'vybora_reports'],
  ['Moderator review RPC', 'vybora_review_report'],
  ['Live video uses WebRTC', 'RTCPeerConnection'],
  ['Personalised feed ranking', 'rankFeedItems'],
  ['Data saver mode', 'dataSaver']
]) check(label, application.includes(token));

check('Service worker does not cache private Supabase REST/auth/storage APIs',
  !/\/(?:rest|auth|storage)\/v1\//i.test(worker));
check('Service worker limits caching to GET requests', /request\.method\s*!==\s*['"]GET['"]/.test(worker));
check('Android launcher targets the production VYBORA service',
  launcher.includes('https://vybora-social-live-8yyn.onrender.com/'));

syntaxCheck('social-features.js');
syntaxCheck('service-worker.js');
syntaxCheck('scripts/prepare-web.mjs');

if (failures.length) {
  console.error(`\n${failures.length} verification check(s) failed:`);
  for (const failure of failures) console.error(' -', failure);
  process.exitCode = 1;
} else {
  console.log('\nVYBORA production guardrails passed.');
}
