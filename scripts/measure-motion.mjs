import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'no-preference',
});
const page = await context.newPage();
await page.goto('http://127.0.0.1:4199/', { waitUntil: 'networkidle' });
const scrolling = await page.evaluate(async () => {
  document.documentElement.style.scrollBehavior = 'auto';
  const frames = [];
  let previous = performance.now();
  for (let i = 0; i < 120; i++) {
    await new Promise(requestAnimationFrame);
    const now = performance.now();
    frames.push(now - previous);
    previous = now;
    scrollBy(0, 35);
  }
  const sorted = frames.slice(1).sort((a, b) => a - b);
  return {
    samples: sorted.length,
    medianFrameMs: sorted[Math.floor(sorted.length * 0.5)],
    p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
    framesOver50Ms: sorted.filter((x) => x > 50).length,
  };
});
const summary = page.locator('.faq-list summary').first();
await summary.scrollIntoViewIfNeeded();
await summary.evaluate((element) =>
  element.addEventListener(
    'click',
    () => {
      const start = performance.now();
      requestAnimationFrame(() =>
        requestAnimationFrame(() => (window.faqPaintDelay = performance.now() - start)),
      );
    },
    { once: true },
  ),
);
await summary.click();
await page.waitForFunction(() => Number.isFinite(window.faqPaintDelay));
const result = {
  date: new Date().toISOString(),
  conditions:
    'Local Chrome, 1440×1000, no CPU/network throttle; native scroll sampled for 120 frames. Not field INP.',
  scrolling,
  faqClickToSecondFrameMs: await page.evaluate(() => window.faqPaintDelay),
};
await writeFile('artifacts/validation/motion-metrics.json', JSON.stringify(result, null, 2));
console.log(result);
await browser.close();
