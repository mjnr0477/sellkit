const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness() {
  let observer;
  const documentListeners = {};
  const feedListeners = {};
  const video = {
    dataset: { src: 'https://media.example/video.mp4' }, src: '', muted: false,
    playsInline: false, readyState: 2, currentTime: 12, paused: true,
    loads: 0, plays: 0, pauses: 0,
    removeAttribute(name) { if (name === 'data-src') delete this.dataset.src; },
    load() { this.loads++; },
    play() { this.plays++; this.paused = false; return Promise.resolve(); },
    pause() { this.pauses++; this.paused = true; }
  };
  const frame = {
    dataset: { src: 'https://www.youtube-nocookie.com/embed/demo?autoplay=1&mute=1' },
    src: '', contentWindow: { postMessage() {} }, removeAttribute(name) { if (name === 'data-src') delete this.dataset.src; if (name === 'src') this.src = ''; }
  };
  const card = {
    dataset: {}, querySelector(selector) { return selector === 'video' ? video : selector === 'iframe' ? frame : null; }
  };
  const feed = {
    querySelectorAll(selector) { return selector === '.video-card' ? [card] : selector === 'video' ? [video] : []; },
    addEventListener(name, fn) { feedListeners[name] = fn; }
  };
  class MockIntersectionObserver {
    constructor(callback, options) { this.callback = callback; this.options = options; observer = this; }
    observe(target) { this.target = target; }
  }
  class MockMutationObserver { constructor(callback) { this.callback = callback; } observe() {} }
  const document = {
    hidden: false,
    getElementById(id) { return id === 'feed' ? feed : null; },
    addEventListener(name, fn) { documentListeners[name] = fn; }
  };
  const source = fs.readFileSync(require.resolve('../clean-feed.js'), 'utf8');
  vm.runInNewContext(source, { document, IntersectionObserver: MockIntersectionObserver,
    MutationObserver: MockMutationObserver, URL, JSON, Set });
  return { observer, video, frame, frameMessages, card, feed, feedListeners, document, documentListeners };
}

test('visible video lazy-loads and starts muted automatically', async () => {
  const h = harness();
  h.observer.callback([{ target: h.card, isIntersecting: true, intersectionRatio: 0.8 }]);
  await Promise.resolve();
  assert.equal(h.video.src, 'https://media.example/video.mp4');
  assert.equal(h.video.loads, 1);
  assert.equal(h.video.muted, true);
  assert.equal(h.video.playsInline, true);
  assert.equal(h.video.plays, 1);
  assert.equal(h.frame.src, 'https://www.youtube-nocookie.com/embed/demo?autoplay=1&mute=1');
});

test('off-screen media pauses and visible playback resumes after tab visibility returns', async () => {
  const h = harness();
  h.observer.callback([{ target: h.card, isIntersecting: true, intersectionRatio: 0.9 }]);
  h.observer.callback([{ target: h.card, isIntersecting: false, intersectionRatio: 0 }]);
  assert.equal(h.video.paused, true);
  assert.equal(h.video.currentTime, 0);
  assert.equal(h.frame.src, 'https://www.youtube-nocookie.com/embed/demo?autoplay=1&mute=1');
  assert.equal(h.frameMessages.length, 1);
  assert.equal(h.frameMessages[0][1], 'https://www.youtube-nocookie.com');
  assert.equal(h.frame.dataset.src, 'https://www.youtube-nocookie.com/embed/demo?autoplay=1&mute=1');
  h.observer.callback([{ target: h.card, isIntersecting: true, intersectionRatio: 0.9 }]);
  h.document.hidden = true;
  h.documentListeners.visibilitychange();
  assert.equal(h.video.paused, true);
  assert.equal(h.frame.src, '');
  h.document.hidden = false;
  h.documentListeners.visibilitychange();
  await Promise.resolve();
  assert.equal(h.video.paused, false);
  assert.equal(h.frame.src, 'https://www.youtube-nocookie.com/embed/demo?autoplay=1&mute=1');
  assert.ok(h.video.plays >= 3);
});
