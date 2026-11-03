const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');

test('video cards defer every direct video source until its card approaches the viewport', () => {
  assert.match(html, /<video data-src="\x27\+esc\(media\)/,
    'direct media must be represented as data-src, not an eager src');
  assert.match(html, /muted playsinline loop preload="none"/,
    'new video elements must not request media immediately');
  assert.doesNotMatch(html, /\(dataSaver\?'data-src="\x27\+esc\(media\)/,
    'Data Saver must not be the only mode that defers media');
});

test('one playback observer owns video and iframe activation', () => {
  assert.equal((html.match(/function activateVideoObserver\(/g) || []).length, 1);
  assert.match(html, /threshold:\[\.12,\.72\]/,
    'the active video should require a strong viewport intersection');
  assert.match(html, /if\(video&&near&&!video\.getAttribute\('src'\)&&video\.dataset\.src\)/,
    'a nearby direct video should be loaded only when approaching the viewport');
  assert.match(html, /if\(active&&!frame\.getAttribute\('src'\)&&frame\.dataset\.src\)/,
    'provider embeds should load only for the active card');
  assert.doesNotMatch(html, /<script src="clean-feed\.js"><\/script>/,
    'the retired second observer must not be loaded alongside the feed observer');
});
