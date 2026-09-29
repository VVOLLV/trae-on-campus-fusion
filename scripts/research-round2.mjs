import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const sources = [
  ['apple', 'https://www.apple.com/macbook-air/'],
  ['linear', 'https://linear.app/'],
  ['trae-events', 'https://www.trae.cn/events'],
  ['trae-community', 'https://forum.trae.cn/'],
];
const results = await Promise.allSettled(
  sources.map(async ([name, url]) => {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    });
    const record = { name, url, visited: new Date().toISOString() };
    try {
      const response = await page.goto(url, { waitUntil: 'commit', timeout: 25000 });
      record.status = response?.status();
      await page.waitForTimeout(8000);
      record.title = await page.title();
      record.text = (await page.locator('body').innerText()).slice(0, 10000);
      await page.screenshot({
        path: 'artifacts/research/round2-' + name + '-desktop.png',
        timeout: 15000,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: 'artifacts/research/round2-' + name + '-mobile.png',
        timeout: 15000,
      });
    } catch (e) {
      record.error = e.message;
    }
    await page.close();
    return record;
  }),
);
await writeFile('artifacts/research/round2.json', JSON.stringify(results, null, 2));
console.log(
  results.map((x) =>
    x.value
      ? { name: x.value.name, status: x.value.status, title: x.value.title, error: x.value.error }
      : x,
  ),
);
await browser.close();
