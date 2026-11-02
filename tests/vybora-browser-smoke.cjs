const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseURL = process.env.VYBORA_URL || 'https://vybora-social-preview-yb6x.onrender.com';

test('hosted VYBORA feed loads and guest account gates work for available feed content', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
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
await page.locator('#authClose').click();
    } else {
      assert.ok(await page.locator('[data-action="share"]').count() > 0,
        'a curated-only guest feed should still expose share actions');
    }

    await page.locator('#createBtn').click();
    await page.waitForFunction(() => document.querySelector('#authBackdrop').classList.contains('open'));
    assert.match(await page.locator('#authDescription').innerText(), /publish|create an account/i);

    console.log('auth close computed hit-test', await page.locator('#authClose').evaluate(el => {
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const cs = getComputedStyle(el), parent = el.parentElement, ps = getComputedStyle(parent);
      return { viewport: { innerWidth, innerHeight, clientWidth:document.documentElement.clientWidth }, modalRect: (()=>{const m=el.parentElement.getBoundingClientRect();return {x:m.x,y:m.y,w:m.width,h:m.height}})(), rect: { x:r.x, y:r.y, w:r.width, h:r.height }, position:cs.position, zIndex:cs.zIndex,
        pointerEvents:cs.pointerEvents, parentTag:parent.tagName, parentClass:parent.className,
        parentPosition:ps.position, hit:document.elementFromPoint(x,y)?.outerHTML?.slice(0,240),
        stack:document.elementsFromPoint(x,y).slice(0,5).map(n=>({tag:n.tagName,id:n.id,class:n.className})) };
    }));
    await page.locator('#authClose').click();
    await page.locator('#accountBtn').click();
    await page.locator('#authSwitch').click();
    assert.equal(await page.locator('#forgotPassword').isVisible(), true,
      'forgot-password action should be available during sign-in');
  } finally {
    await browser.close();
  }
});
