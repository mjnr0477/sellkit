const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseURL = process.env.VYBORA_URL || 'https://vybora-social-preview-yb6x.onrender.com';

test('hosted VYBORA feed loads and guest account gates work for available feed content', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();
    async function activateTopmostControl(selector) {
      const hit = await page.locator(selector).evaluate(el => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        return { topmost: document.elementFromPoint(x, y) === el,
          rect: { x:r.x, y:r.y, width:r.width, height:r.height },
          viewport: { innerWidth, clientWidth:document.documentElement.clientWidth } };
      });
      assert.equal(hit.topmost, true, selector + ' must be the topmost hit target: ' + JSON.stringify(hit));
      await page.locator(selector).evaluate(el => el.click());
    }
    await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('#feed .video-card', { timeout: 60000 });
    await page.waitForFunction(() =>
      document.querySelector('#commentsBackdrop') &&
      document.querySelector('#profileBackdrop') &&
      document.querySelector('#savedBackdrop') &&
      document.querySelector('#resetBackdrop') &&
      document.querySelector('#authBackdrop'),
      { timeout: 30000 }
    );

    assert.match(await page.title(), /VYBORA/i);
    const offlineShellReady = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const registration = await navigator.serviceWorker.ready;
      const cache = await caches.open('vybora-shell-v3');
      return Boolean(registration.active && await cache.match('/design-refresh.css?v=20261102b', { ignoreSearch: true }));
    });
    assert.equal(offlineShellReady, true, 'offline shell should cache the production stylesheet');
    assert.ok(await page.locator('.video-card').count() > 0, 'guest feed should show video cards');
    assert.equal(await page.locator('[data-tab="Watch"]').count(), 1, 'watch navigation should exist');
    assert.equal(await page.locator('#createBtn').count(), 1, 'create navigation should exist');
    assert.equal(await page.locator('#savedOpenBtn').count(), 1, 'saved-video library should exist');
    assert.equal(await page.locator('#feed').evaluate(el => getComputedStyle(el).scrollSnapType.includes('y')), true,
      'feed should use vertical scroll snapping');

    // Curated third-party videos intentionally expose sharing, not community post reactions.
    // Only test the like gate when the live feed actually contains a community post.
    const likeAction = page.locator('[data-action="like"]').first();
    if (await likeAction.count()) {
      await likeAction.click();
      await page.waitForFunction(() => document.querySelector('#authBackdrop').classList.contains('open'));
      assert.match(await page.locator('#authDescription').innerText(), /like videos|publish|comment|follow/i);
await activateTopmostControl('#authClose');
      await page.waitForFunction(() => !document.querySelector('#authBackdrop').classList.contains('open'));
    } else {
      assert.ok(await page.locator('[data-action="share"]').count() > 0,
        'a curated-only guest feed should still expose share actions');
    }

    await page.locator('#createBtn').click();
    await page.waitForFunction(() => document.querySelector('#authBackdrop').classList.contains('open'));
    assert.match(await page.locator('#authDescription').innerText(), /publish|create an account/i);

await activateTopmostControl('#authClose');
    await page.waitForFunction(() => !document.querySelector('#authBackdrop').classList.contains('open'));
    const headerTargets = await page.evaluate(() => {
      const ids = ['friendsBtn', 'liveBtn', 'dataSaverBtn', 'soundBtn', 'accountBtn'];
      return ids.map(id => {
        const el = document.getElementById(id), r = el.getBoundingClientRect();
        return { id, left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height };
      });
    });
    const layoutMetrics = await page.evaluate(() => {
      const rect = selector => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right};
      };
      return {innerWidth,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,
        visualViewport:{width:visualViewport?.width,scale:visualViewport?.scale},
        app:rect('.app'),top:rect('.top'),brand:rect('.brand'),actions:rect('.top-actions'),
        devicePixelRatio,mediaMobile:matchMedia('(max-width:850px)').matches};
    });
    const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
    assert.ok(headerTargets.every(r => r.width > 0 && r.left >= 0 && r.right <= viewportWidth),
      'mobile header controls must remain inside the viewport: ' + JSON.stringify({viewportWidth,headerTargets,layoutMetrics}));
    for (let i=0;i<headerTargets.length;i++) for (let j=i+1;j<headerTargets.length;j++) {
      assert.ok(headerTargets[i].right <= headerTargets[j].left || headerTargets[j].right <= headerTargets[i].left,
        'mobile header controls must not overlap: ' + JSON.stringify(headerTargets));
    }
    await page.locator('#accountBtn').click();
    await page.locator('#authSwitch').click();
    assert.equal(await page.locator('#forgotPassword').isVisible(), true,
      'forgot-password action should be available during sign-in');
  } finally {
    await browser.close();
  }
});


test('Data Saver defers video bytes until the viewer explicitly presses play', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('vybora:data-saver:v1', 'on'));
    await page.route('https://media.test/**', route => route.abort());
    await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('#feed .video-card', { timeout: 60000 });
    await page.evaluate(() => {
      const card = document.createElement('article');
      card.className = 'video-card';
      card.dataset.id = 'demo-1';
      card.dataset.mediaUrl = 'https://media.test/clip.mp4';
      card.innerHTML = '<video data-src="https://media.test/clip.mp4" preload="none"></video><button data-action="play" type="button">Play</button>';
      document.querySelector('#feed').replaceChildren(card);
    });
    const video = page.locator('#feed video');
    assert.equal(await video.getAttribute('src'), null, 'video bytes must not be requested before playback');
    assert.equal(await video.getAttribute('data-src'), 'https://media.test/clip.mp4');
    await page.locator('#feed [data-action="play"]').click();
    await page.waitForFunction(() => document.querySelector('#feed video')?.getAttribute('src') === 'https://media.test/clip.mp4');
    assert.equal(await video.getAttribute('preload'), 'auto', 'explicit playback should opt into loading the clip');
  } finally {
    await browser.close();
  }
});
