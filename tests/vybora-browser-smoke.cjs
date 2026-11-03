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
      const cache = await caches.open('vybora-shell-v4');
      return Boolean(registration.active && await cache.match('/design-refresh.css?v=20261102b', { ignoreSearch: true }) && await cache.match('/clean-feed.css') && await cache.match('/clean-feed.js'));
    });
    assert.equal(offlineShellReady, true, 'offline shell should cache the production stylesheet');
    assert.ok(await page.locator('.video-card').count() > 0, 'guest feed should show video cards');
    assert.equal(await page.locator('[data-tab="Watch"]').count(), 1, 'watch navigation should exist');
    assert.equal(await page.locator('#createBtn').count(), 1, 'create navigation should exist');
    assert.equal(await page.locator('#savedOpenBtn').count(), 1, 'saved-video library should exist');
    assert.equal(await page.locator('#feed').evaluate(el => getComputedStyle(el).scrollSnapType), 'none',
      'steering feed should not force snap scrolling');
    assert.match(await page.locator('#feed').evaluate(el => getComputedStyle(el).touchAction), /pan-y/,
      'feed should accept natural vertical touch movement');
    assert.ok(await page.locator('#feed .video-card[data-external-id][data-media-url^="https://"]').count() > 0,
      'guest feed must contain real curated video sources, not only decorative cards');
    const playableCard = page.locator('#feed .video-card[data-external-id][data-media-url^="https://"]').first();
    await playableCard.scrollIntoViewIfNeeded();
    await page.waitForFunction(card => {
      const media = card.querySelector('video,iframe');
      return Boolean(media && (media.getAttribute('src') || media.getAttribute('data-src')));
    }, await playableCard.elementHandle(), { timeout: 15000 });
    const playableMedia = playableCard.locator('video,iframe').first();
    assert.equal(await playableMedia.count(), 1, 'a curated card must contain a real video or provider embed');
    await page.waitForFunction(card => {
      const media = card.querySelector('video,iframe');
      return Boolean(media && media.getAttribute('src'));
    }, await playableCard.elementHandle(), { timeout: 30000 });

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
    assert.equal(await page.locator('#resendConfirmation').isVisible(), false,
      'confirmation resend should stay hidden until an unconfirmed account is detected');
    let resendRequested = false;
    await page.route(url => url.pathname.endsWith('/auth/v1/token') && url.searchParams.get('grant_type') === 'password', route => route.fulfill({
      status: 400, contentType: 'application/json',
      body: JSON.stringify({ code: 'email_not_confirmed', msg: 'Email not confirmed' })
    }));
    await page.route(/\/auth\/v1\/resend(?:\?|$)/, route => {
      resendRequested = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.locator('#email').fill('browser-test@example.com');
    await page.locator('#password').fill('not-a-real-password');
    await page.locator('#authSubmit').click();
    await page.locator('#resendConfirmation').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#resendConfirmation').click();
    await page.waitForFunction(() => document.querySelector('#notice')?.classList.contains('show') ||
      document.querySelector('.notice')?.classList.contains('show'), { timeout: 15000 });
    assert.equal(resendRequested, true, 'unconfirmed accounts should be able to request a new confirmation email');
  } finally {
    await browser.close();
  }
});


test('successful email sign-in creates a persistent authenticated session in the UI', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const now = Math.floor(Date.now() / 1000);
    const jwtPart = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const token = jwtPart({ alg: 'HS256', typ: 'JWT' }) + '.' + jwtPart({
      sub: '00000000-0000-4000-8000-000000000123', aud: 'authenticated', role: 'authenticated',
      email: 'signed-in-browser@example.com', iat: now, exp: now + 3600
    }) + '.browser-test-signature';
    await page.route(url => url.pathname.endsWith('/auth/v1/token') && url.searchParams.get('grant_type') === 'password', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        access_token: token, token_type: 'bearer', expires_in: 3600, refresh_token: 'browser-test-refresh',
        user: {
          id: '00000000-0000-4000-8000-000000000123', aud: 'authenticated', role: 'authenticated',
          email: 'signed-in-browser@example.com', email_confirmed_at: new Date().toISOString(),
          app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
          identities: [], created_at: new Date().toISOString()
        }
      })
    }));
    await page.route(url => url.pathname.includes('/rest/v1/'), route => route.fulfill({
      status: route.request().method() === 'POST' ? 201 : 200,
      contentType: 'application/json', body: '[]'
    }));
    await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('#feed .video-card', { timeout: 60000 });
    await page.locator('#accountBtn').click();
    await page.locator('#authSwitch').click();
    await page.locator('#email').fill('signed-in-browser@example.com');
    await page.locator('#password').fill('ValidTestPassword123!');
    await page.locator('#authSubmit').click();
    await page.waitForFunction(() => document.querySelector('#accountStatus')?.innerText.includes('Signed in'),
      { timeout: 20000 });
    assert.match(await page.locator('#accountStatus').innerText(), /Signed in/);
    assert.equal(await page.locator('#authBackdrop').isVisible(), false,
      'successful sign-in should close the authentication modal');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => document.querySelector('#accountStatus')?.innerText.includes('Signed in'),
      { timeout: 20000 });
    assert.match(await page.locator('#accountStatus').innerText(), /Signed in/,
      'authenticated session should survive a page reload');
  } finally {
    await browser.close();
  }
});

test('Data Saver still auto-loads only the visible video when it enters the watch viewport', async () => {
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
      card.dataset.mediaUrl = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
      card.innerHTML = '<video data-src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" preload="none"></video><button class="play-toggle" data-action="play" type="button">Play</button>';
      document.querySelector('#feed').replaceChildren(card);
    });
    const video = page.locator('#feed video');
    await page.waitForFunction(() => document.querySelector('#feed video')?.getAttribute('src') === 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      { timeout: 15000 });
    assert.equal(await video.getAttribute('data-src'), null, 'visible media should be promoted from deferred source');
    assert.equal(await video.evaluate(el => el.muted), true, 'automatic playback must start muted');
    assert.equal(await video.getAttribute('preload'), 'none', 'Data Saver must preserve low-preload behavior');
  } finally {
    await browser.close();
  }
});
