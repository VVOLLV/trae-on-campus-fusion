import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'no-preference',
  });
  await page.goto('http://127.0.0.1:4199/');
  await page.waitForTimeout(2200);
  const measurements = [];
  for (const selector of ['.hero-heading', '.connection-scene']) {
    await page.locator(selector).evaluate((element) => {
      document.documentElement.style.scrollBehavior = 'auto';
      element.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(200);
    measurements.push(
      await page.evaluate(async (selector) => {
        const element = document.querySelector(selector);
        const box = element.getBoundingClientRect();
        const frames = [];
        let previous = performance.now();
        for (let index = 0; index < 150; index++) {
          await new Promise(requestAnimationFrame);
          const now = performance.now();
          frames.push(now - previous);
          previous = now;
          element.dispatchEvent(
            new PointerEvent('pointermove', {
              pointerType: 'mouse',
              clientX: box.left + box.width * (0.5 + 0.45 * Math.sin(index / 20)),
              clientY: box.top + box.height * (0.3 + 0.15 * Math.cos(index / 25)),
              bubbles: true,
            }),
          );
        }
        element.dispatchEvent(new PointerEvent('pointerleave'));
        const sorted = frames.slice(1).sort((a, b) => a - b);
        return {
          selector,
          samples: sorted.length,
          medianFrameMs: sorted[Math.floor(sorted.length * 0.5)],
          p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
          framesOver50Ms: sorted.filter((duration) => duration > 50).length,
        };
      }, selector),
    );
  }
  const result = {
    date: new Date().toISOString(),
    conditions:
      'Local Chrome at 1440×1000, no CPU/network throttle; synthetic pointer events issued each animation frame for 150 frames per surface. Not field performance or real-device certification.',
    measurements,
  };
  await mkdir('artifacts/hero-motion', { recursive: true });
  await writeFile('artifacts/hero-motion/performance.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
