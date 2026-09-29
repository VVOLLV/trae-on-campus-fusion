import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const page = await browser.newPage({ reducedMotion: 'reduce' });
const issues = [];
page.on('pageerror', (e) => issues.push(e.message));
for (const width of [1440, 1024, 768, 390, 360]) {
  await page.setViewportSize({ width, height: width < 800 ? 844 : 1000 });
  await page.goto('http://127.0.0.1:4199/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'artifacts/validation/initial-' + width + '.png', fullPage: true });
  const overflow = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    items: [...document.querySelectorAll('main *')]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
      })
      .map((e) => e.className)
      .slice(0, 20),
  }));
  console.log(width, overflow);
}
console.log('errors', issues);
await browser.close();
