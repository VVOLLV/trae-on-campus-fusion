import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const records = [];
for (const [name, url] of [
  ['campus-about', 'https://forum.trae.cn/t/topic/29'],
  ['campus-recap', 'https://forum.trae.cn/t/topic/213'],
  ['campus-hackathon', 'https://forum.trae.cn/t/topic/2781'],
]) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const record = { name, url, date: new Date().toISOString() };
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    record.status = response.status();
    await page.waitForTimeout(1700);
    record.title = await page.title();
    record.text = (await page.locator('body').innerText()).slice(0, 14000);
    await page.screenshot({ path: 'artifacts/research/' + name + '-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'artifacts/research/' + name + '-mobile.png' });
  } catch (error) {
    record.error = error.message;
  }
  records.push(record);
  await page.close();
}
await writeFile('artifacts/research/campus-cases.json', JSON.stringify(records, null, 2));
console.log(
  records.map((r) => ({ name: r.name, status: r.status, title: r.title, error: r.error })),
);
await browser.close();
