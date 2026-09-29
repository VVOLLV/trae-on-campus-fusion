import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { escapeHTML as e } from '../src/content.mjs';
const event = JSON.parse(await readFile('src/event.json', 'utf8'));
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
await page.setContent(
  '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#f7f7f2;color:#181818;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;padding:52px 65px}.top{display:flex;justify-content:space-between;font-size:22px}.top span{font-size:14px;margin-top:4px}h1{font-size:94px;line-height:1.17;letter-spacing:-7px;font-weight:600;margin:70px 0 50px}h1 span{color:transparent;-webkit-text-stroke:1.5px #181818}.info{font-size:22px;border-top:1px solid #bfc2b7;padding-top:22px}.small{font-size:16px;margin-top:10px;color:#60605a}.emblem{position:absolute;right:98px;top:208px;width:205px;height:205px;border-radius:50px;background:#b8f24a;display:grid;place-items:center;transform:rotate(-8deg);font-size:128px;line-height:1}</style><div class="top"><strong>TRAE <span style="font-size:22px;font-weight:400">on Campus</span></strong><span>BEIJING · ' +
    e(event.edition) +
    '</span></div><h1>让想法，<br><span>开始运行。</span></h1><div class="emblem">↗</div><div class="info">' +
    e(event.start.slice(0, 10).replaceAll('-', '.')) +
    '　' +
    e(event.start.slice(11, 16)) +
    '–' +
    e(event.end.slice(11, 16)) +
    '　/　' +
    e(event.venue) +
    '</div><p class="small">' +
    event.schools.map(e).join(' · ') +
    '</p></html>',
);
await page.screenshot({ path: 'src/assets/share.png' });
await browser.close();
console.log('Generated 1200 × 630 share image from event data.');
