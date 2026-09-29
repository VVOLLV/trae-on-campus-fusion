import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

export async function verifyHeroMotion(browser, base, engine, check) {
  await mkdir('artifacts/hero-motion', { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'no-preference',
  });
  await context.addInitScript(() => {
    const nativeFrame = window.requestAnimationFrame.bind(window);
    window.heroFrameCount = 0;
    window.requestAnimationFrame = (callback) =>
      nativeFrame((time) => {
        window.heroFrameCount++;
        callback(time);
      });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const fusion = page.locator('.hero-fusion');
  const waitForRest = () =>
    page.waitForFunction(
      () =>
        Number(
          getComputedStyle(document.querySelector('.hero-fusion')).getPropertyValue('--type-light'),
        ) === 0,
    );
  try {
    await page.goto(base);
    await page.waitForFunction(
      () =>
        Number(
          getComputedStyle(document.querySelector('.hero-fusion')).getPropertyValue('--type-light'),
        ) > 0.1,
    );
    await waitForRest();
    assert.equal(
      await page.getByRole('heading', { name: 'TRAE on Campus Fusion', exact: true }).count(),
      1,
    );
    const resting = await fusion.screenshot();
    const typeBox = await fusion.boundingBox();
    const titleStates = [];
    for (const fraction of [0.2, 0.75]) {
      await page.mouse.move(typeBox.x + typeBox.width * fraction, typeBox.y + typeBox.height * 0.5);
      await page.waitForFunction(
        () =>
          Number(
            getComputedStyle(document.querySelector('.hero-fusion')).getPropertyValue(
              '--type-light',
            ),
          ) > 0.98,
      );
      await page.waitForTimeout(220);
      titleStates.push(
        await page
          .locator('.fusion-letter')
          .evaluateAll((letters) => letters.map((letter) => getComputedStyle(letter).transform)),
      );
    }
    assert.notDeepEqual(
      titleStates[0],
      titleStates[1],
      'Letter shape must follow pointer position',
    );
    assert.notDeepEqual(
      await fusion.screenshot(),
      resting,
      'The light must change rendered pixels',
    );
    await page.screenshot({ path: `artifacts/hero-motion/${engine}-title-light.png` });
    await page.mouse.move(5, 90);
    await waitForRest();
    assert.ok(
      await page
        .locator('.fusion-letter')
        .evaluateAll((letters) =>
          letters.every((letter) => getComputedStyle(letter).transform === 'none'),
        ),
    );
    const frameCount = await page.evaluate(() => window.heroFrameCount);
    await page.waitForTimeout(220);
    assert.equal(
      await page.evaluate(() => window.heroFrameCount),
      frameCount,
      'No animation frame loop at rest',
    );
    check(engine + ' Fusion introduction, pointer light, letter deformation and idle sleep');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(100);
    assert.deepEqual(
      await page.locator('.hero').evaluate((el) => ({
        running: el
          .getAnimations({ subtree: true })
          .filter((animation) => animation.playState === 'running').length,
        letters: [...el.querySelectorAll('.fusion-letter')].every(
          (letter) => getComputedStyle(letter).transform === 'none',
        ),
      })),
      { running: 0, letters: true },
    );
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    // WebKit applies media emulation on the next rendering opportunity.
    await page.waitForFunction(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
    await page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    );
    await page.evaluate(() => document.querySelector('#join').scrollIntoView());
    await waitForRest();
    assert.equal(
      await page
        .locator('.hero')
        .evaluate(
          (el) =>
            el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length,
        ),
      0,
    );
    check(engine + ' live reduced-motion cancellation and offscreen cleanup');
    const visionMetrics = () =>
      page.evaluate(() => {
        const rect = document.querySelector('.vision-window').getBoundingClientRect();
        return { top: rect.top, width: rect.width, height: rect.height };
      });
    const initialVision = await visionMetrics();
    assert.ok(initialVision.width < 1440 * 0.95, 'Vision window starts inset');
    assert.ok(initialVision.height >= 400, 'Vision window keeps a cinematic height');
    assert.equal(
      await page.locator('.vision-window').getAttribute('aria-labelledby'),
      'vision-title',
    );
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, document.querySelector('.vision-window').offsetTop);
    });
    await page.waitForTimeout(400);
    const fullVision = await visionMetrics();
    assert.ok(Math.abs(fullVision.top) < 2, 'Vision window pins to the viewport top');
    assert.ok(fullVision.width >= 1438, 'Vision window expands to full width');
    assert.ok(fullVision.height >= 998, 'Vision window fills the viewport');
    await page.screenshot({ path: `artifacts/hero-motion/${engine}-vision-fullscreen.png` });
    const readout = page.locator('[data-vision-readout]');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(() => scrollY === 0);
    await page.waitForTimeout(300);
    const insetVision = await visionMetrics();
    assert.ok(insetVision.width < 1440 * 0.95, 'Vision window contracts back to inset');
    const view = await readout.textContent();
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForFunction(
      (from) => document.querySelector('[data-vision-readout]').textContent !== from,
      view,
    );
    await page.waitForTimeout(300);
    await page.screenshot({ path: `artifacts/hero-motion/${engine}-vision-scrolled.png` });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(
      (from) => document.querySelector('[data-vision-readout]').textContent === from,
      view,
    );
    check(engine + ' vision window scroll-linked growth and camera');
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }

  const touchContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'no-preference',
  });
  try {
    const touch = await touchContext.newPage();
    await touch.goto(base);
    await touch.waitForTimeout(2200);
    await touch.locator('.hero-fusion').tap();
    await touch.waitForFunction(
      () =>
        Number(
          getComputedStyle(document.querySelector('.hero-fusion')).getPropertyValue('--type-light'),
        ) > 0.2,
    );
    await touch.screenshot({ path: `artifacts/hero-motion/${engine}-touch-title.png` });
    await touch.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      document.querySelector('#join').scrollIntoView({ block: 'center' });
    });
    await touch.waitForTimeout(100);
    if (engine === 'chromium') {
      const cdp = await touchContext.newCDPSession(touch);
      const box = await touch.locator('.join-main').boundingBox();
      const before = await touch.evaluate(() => scrollY);
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let step = 1; step <= 8; step++) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x, y: y - step * 16 }],
        });
        await touch.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await touch.waitForTimeout(150);
      assert.ok(
        (await touch.evaluate(() => scrollY)) > before + 50,
        'Dragging over the logo must scroll',
      );
      await cdp.detach();
    }
    check(
      engine + ' mobile title sweep' + (engine === 'chromium' ? ' and native touch scrolling' : ''),
    );
  } finally {
    await touchContext.close();
  }
}
