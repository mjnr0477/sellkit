const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseURL = process.env.VYBORA_URL || 'https://vybora-social-preview.onrender.com';

test('hosted VYBORA feed loads and guests can watch but cannot interact without an account', async () => {
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
    assert.equal(await page.locator('.video-card').count() > 0, true, 'guest feed should show a video card');
    assert.equal(await page.locator('[data-tab="Watch"]').count(), 1, 'watch navigation should exist');
    assert.equal(await page.locator('#createBtn').count(), 1, 'create navigation should exist');
    assert.equal(await page.locator('#savedOpenBtn').count(), 1, 'saved-video library should exist');
    assert.equal(await page.locator('#feed').evaluate(el => getComputedStyle(el).scrollSnapType.includes('y')), true,
      'feed should use vertical scroll snapping');

    await page.locator('[data-action="like"]').first().click();
    await page.waitForFunction(() => document.querySelector('#authBackdrop').classList.contains('open'));
    assert.match(await page.locator('#authDescription').innerText(), /like videos|publish|comment|follow/i);

    await page.locator('#authClose').click();
    await page.locator('#createBtn').click();
    await page.waitForFunction(() => document.querySelector('#authBackdrop').classList.contains('open'));
    assert.match(await page.locator('#authDescription').innerText(), /publish|create an account/i);

    await page.locator('#authClose').click();
    await page.locator('#accountBtn').click();
    await page.locator('#authSwitch').click();
    assert.equal(await page.locator('#forgotPassword').isVisible(), true, 'forgot-password action should be available during sign-in');
  } finally {
    await browser.close();
  }
});
