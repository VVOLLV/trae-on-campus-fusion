import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const sources = [
  ['apple', 'https://www.apple.com/cn/macbook-air/'],
  ['linear', 'https://linear.app/'],
  ['teenage', 'https://teenage.engineering/'],
  ['trae', 'https://www.trae.cn/'],
  ['trae-campus', 'https://www.trae.cn/campus'],
  ['baseline', 'http://127.0.0.1:4199/'],
];
const results = await Promise.allSettled(
  sources.map(async ([name, url]) => {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
    });
    const record = { name, url, visited: new Date().toISOString() };
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      record.status = response?.status();
      await page.waitForTimeout(1600);
      record.title = await page.title();
      record.text = (await page.locator('body').innerText()).slice(0, 9000);
      record.links = await page.locator('a').evaluateAll((els) =>
        els
          .map((a) => ({ label: a.innerText, url: a.href }))
          .filter((a) => /campus|校园|活动|event|社区/i.test(a.label + ' ' + a.url))
          .slice(0, 20),
      );
      await page.screenshot({ path: `artifacts/research/${name}-desktop.png` });
      await page.mouse.wheel(0, 850);
      await page.waitForTimeout(700);
      await page.screenshot({ path: `artifacts/research/${name}-scroll.png` });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(700);
      await page.screenshot({ path: `artifacts/research/${name}-mobile.png` });
    } catch (e) {
      record.error = e.message;
    }
    await page.close();
    return record;
  }),
);
await writeFile('artifacts/research/references.json', JSON.stringify(results, null, 2));
console.log(
  results.map((r) =>
    r.status === 'fulfilled'
      ? {
          name: r.value.name,
          title: r.value.title,
          status: r.value.status,
          error: r.value.error,
          links: r.value.links,
        }
      : r,
  ),
);
await browser.close();
