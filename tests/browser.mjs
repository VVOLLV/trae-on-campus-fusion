import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { render } from '../src/render.mjs';
import { verifyHeroMotion } from './hero-motion.mjs';

const root = resolve('dist');
const event = JSON.parse(await readFile('src/event.json', 'utf8'));
const template = await readFile('src/index.template.html', 'utf8');
const before = new Date('2026-09-24T12:00:00+08:00');
// Explicitly synthetic data: fixtures exercise future states, never enter dist.
const registered = {
  ...structuredClone(event),
  registration: { status: 'open', url: 'https://example.com/register' },
};
const recap = {
  ...structuredClone(event),
  phase: 'recap',
  recap: {
    verified: true,
    summary: '测试数据，仅用于验证回顾功能。',
    asOf: '2026-10-17',
    photos: Array.from({ length: 4 }, (_, i) => ({
      src: 'assets/favicon.svg',
      width: 64,
      height: 64,
      alt: '测试图形 ' + (i + 1),
      caption: '测试照片 ' + (i + 1),
      source: '自动化测试图形，不是活动照片',
      date: '2026-10-10',
      panorama: i === 0,
    })),
    stats: [{ label: '测试指标', value: 1, source: '合成测试数据' }],
    works: [{ title: '测试作品链接', url: 'https://example.com/work' }],
  },
};
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ics': 'text/calendar',
};
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const modes = {
      '/test-open.html': [registered, before],
      '/test-ended.html': [registered, new Date('2026-10-11')],
      '/test-day.html': [{ ...event, phase: 'event-day' }, before],
      '/test-recap.html': [recap, before],
      '/test-share.html': [event, before],
    };
    if (modes[pathname]) {
      const [data, now] = modes[pathname];
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        render(data, template, {
          now,
          siteURL: pathname === '/test-share.html' ? 'https://example.com/campus/' : '',
        }),
      );
      return;
    }
    const file = resolve(
      root,
      '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)),
    );
    if (!file.startsWith(root + '/')) throw new Error('Invalid path');
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = 'http://127.0.0.1:' + server.address().port;
const report = { date: new Date().toISOString(), checks: [], errors: [] };
const check = (name, detail = 'passed') => {
  report.checks.push({ name, detail });
  console.log('PASS', name);
};
await mkdir('artifacts/validation', { recursive: true });
try {
  for (const [engine, type, options] of [
    [
      'chromium',
      chromium,
      {
        executablePath:
          process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      },
    ],
    ['webkit', webkit, {}],
  ]) {
    const browser = await type.launch(options);
    try {
      const context = await browser.newContext({ reducedMotion: 'reduce', acceptDownloads: true });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('response', (response) => {
        if (response.status() >= 400) errors.push(response.status() + ' ' + response.url());
      });
      for (const width of [320, 360, 390, 768, 800, 801, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: width < 800 ? 844 : 1000 });
        await page.goto(base, { waitUntil: 'networkidle' });
        assert.equal(await page.locator('h1').count(), 1);
        assert.equal(await page.locator('.agenda-row').count(), 9);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        assert.equal(overflow, false, engine + ' overflow at ' + width);
        const layout = await page.evaluate(() => {
          const style = (selector) => getComputedStyle(document.querySelector(selector));
          return {
            paper: style('body').backgroundColor,
            headingSize: parseFloat(style('h1').fontSize),
            navigation: style('.site-header').position,
          };
        });
        assert.equal(layout.paper, 'rgb(247, 247, 242)', 'Theme stylesheet must be applied');
        assert.ok(
          layout.headingSize >= (width >= 768 ? 60 : 24),
          'Hero must render with its component styles',
        );
        assert.equal(layout.navigation, 'sticky');
        if (width === 390 || width === 1440) {
          const vision = await page.evaluate(async () => {
            const el = document.querySelector('.vision-window');
            const canvas = el.querySelector('canvas');
            const measure = () => {
              const rect = el.getBoundingClientRect();
              return { top: rect.top, width: rect.width, height: rect.height };
            };
            const label = el.getAttribute('aria-labelledby');
            const inset = measure();
            document.documentElement.style.scrollBehavior = 'auto';
            window.scrollTo(0, el.offsetTop);
            await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
            const full = measure();
            window.scrollTo(0, 0);
            return {
              state: el.dataset.vision,
              innerW: innerWidth,
              innerH: innerHeight,
              insetWidth: inset.width,
              fullWidth: full.width,
              fullHeight: full.height,
              pinned: Math.abs(full.top) < 2,
              pixels: canvas.width + 'x' + canvas.height,
              labelled: !!document.getElementById(label),
            };
          });
          assert.equal(vision.state, 'ready', engine + ' vision WebGL pipeline at ' + width);
          assert.ok(
            vision.insetWidth < vision.innerW * 0.95,
            engine + ' vision starts inset at ' + width,
          );
          assert.ok(
            vision.fullWidth >= vision.innerW - 2,
            engine + ' vision grows to full width at ' + width,
          );
          assert.ok(
            vision.fullHeight >= vision.innerH - 2,
            engine + ' vision fills the viewport at ' + width,
          );
          assert.equal(vision.pinned, true, engine + ' vision pins to viewport top at ' + width);
          assert.ok(
            Number(vision.pixels.split('x')[0]) >= 2,
            engine + ' vision canvas allocated at ' + width,
          );
          assert.equal(vision.labelled, true, engine + ' vision accessible name at ' + width);
        }
        const teamLayout = await page.evaluate(() => {
          const team = document.querySelector('#team');
          const rect = team.querySelector('.team-bars').getBoundingClientRect();
          const bars = [...team.querySelectorAll('.team-bar')].map((el) =>
            el.getBoundingClientRect(),
          );
          return {
            count: bars.length,
            ratio: rect.width / rect.height,
            singleRow: bars.every(
              (bar) => Math.abs(bar.top - rect.top) < 1 && Math.abs(bar.height - rect.height) < 1,
            ),
            equalWidths:
              Math.max(...bars.map((bar) => bar.width)) -
                Math.min(...bars.map((bar) => bar.width)) <
              1,
            contentFits: [
              ...team.querySelectorAll('button, .team-member-copy, .team-selection'),
            ].every(
              (el) =>
                el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1,
            ),
            previous: team.previousElementSibling.id,
            next: team.nextElementSibling.id,
          };
        });
        assert.equal(teamLayout.count, 8);
        assert.ok(
          Math.abs(teamLayout.ratio - 16 / 9) < 0.005,
          engine + ' team aspect ratio at ' + width,
        );
        assert.ok(
          teamLayout.singleRow && teamLayout.equalWidths,
          engine + ' team columns at ' + width,
        );
        assert.ok(teamLayout.contentFits, engine + ' team text clipped at ' + width);
        assert.equal(teamLayout.previous, 'memory');
        assert.equal(teamLayout.next, 'guide');
        await page.screenshot({
          path: 'artifacts/validation/' + engine + '-' + width + '.png',
          fullPage: true,
        });
        if (width === 390 || width === 1440) {
          await page.screenshot({
            path: 'artifacts/validation/hero-' + engine + '-' + width + '.png',
          });
          const axe = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();
          await writeFile(
            'artifacts/validation/axe-' + engine + '-' + width + '.json',
            JSON.stringify(
              {
                violations: axe.violations,
                incomplete: axe.incomplete.map((x) => ({
                  id: x.id,
                  nodes: x.nodes.map((n) => n.target),
                })),
              },
              null,
              2,
            ),
          );
          assert.equal(
            axe.violations.length,
            0,
            JSON.stringify(
              axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
            ),
          );
        }
        check(engine + ' layout ' + width);
      }
      const teamBar = page.locator('.team-bar[data-team-select="zhiqian"]');
      const teamMember = page.locator('.team-member[data-team-select="zhiqian"]');
      await teamBar.focus();
      await page.keyboard.press('Enter');
      assert.equal(await teamMember.getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('[data-team-name]').innerText(), '治乾');
      assert.equal(await page.locator('[data-team-detail]').innerText(), '嘉宾 01 · TRAE 产品经理');
      await page.locator('.team-member[data-team-select="xinran"]').click();
      assert.equal(await page.locator('[data-team-name]').innerText(), '欣然');
      assert.equal(await teamBar.getAttribute('aria-pressed'), 'false');
      await page.locator('.team-member[data-team-select="xinran"]').focus();
      await page.keyboard.press('Space');
      assert.equal(await page.locator('[data-team-name]').innerText(), '不同角色，一起共创。');
      assert.equal(await page.locator('#team [aria-pressed="true"]').count(), 0);
      check(engine + ' team selection, keyboard activation and overview reset');

      const touchContext = await browser.newContext({
        hasTouch: true,
        viewport: { width: 390, height: 844 },
        reducedMotion: 'reduce',
      });
      try {
        const touchPage = await touchContext.newPage();
        await touchPage.goto(base + '/#team');
        await touchPage.locator('.team-bar[data-team-select="keke"]').tap();
        assert.equal(await touchPage.locator('[data-team-name]').innerText(), '可可');
        assert.equal(
          await touchPage
            .locator('.team-member[data-team-select="keke"]')
            .getAttribute('aria-pressed'),
          'true',
        );
        await touchPage.locator('.team-member[data-team-select="blcu-ambassador-2"]').tap();
        assert.equal(await touchPage.locator('[data-team-name]').innerText(), '北语校园大使 02');
        assert.equal(await touchPage.locator('[data-team-detail]').innerText(), '北京语言大学');
      } finally {
        await touchContext.close();
      }
      check(engine + ' mobile team taps and complete member list');

      const assets = await page
        .locator('link[rel="stylesheet"], script[src]')
        .evaluateAll((nodes) => nodes.map((node) => node.href || node.src));
      assert.equal(assets.length, 3);
      for (const asset of assets) {
        const url = new URL(asset);
        const content = await readFile(resolve(root, '.' + url.pathname));
        assert.equal(
          url.searchParams.get('v'),
          createHash('sha256').update(content).digest('hex').slice(0, 12),
          'Styles and scripts must use a URL matching the built content',
        );
      }
      check(engine + ' stylesheet rendering and versioned build resources');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(base);
      const toggle = page.locator('.menu-toggle');
      await toggle.click();
      assert.equal(await page.locator('#mobile-menu').evaluate((el) => el.open), true);
      await page.keyboard.press('Shift+Tab');
      assert.ok(
        await page.evaluate(() =>
          document.querySelector('#mobile-menu').contains(document.activeElement),
        ),
      );
      await page.keyboard.press('Escape');
      await page.waitForFunction(
        () => document.querySelector('.menu-toggle').getAttribute('aria-expanded') === 'false',
      );
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      assert.ok(await toggle.evaluate((el) => el === document.activeElement));
      await toggle.click();
      await page.locator('#mobile-menu a[href="#guide"]').click();
      await page.waitForFunction(() => document.activeElement.id === 'guide');
      assert.ok(
        await page.locator('#guide').evaluate((el) => el.getBoundingClientRect().top >= 60),
      );
      await toggle.click();
      await page.setViewportSize({ width: 1024, height: 1000 });
      await page.waitForFunction(() => !document.querySelector('#mobile-menu').open);
      assert.equal(
        await page.locator('body').evaluate((el) => el.classList.contains('modal-open')),
        false,
      );
      check(engine + ' mobile menu, Escape, focus, anchor and resize');

      const summary = page.locator('.faq-list summary').first();
      await summary.focus();
      await page.keyboard.press('Enter');
      assert.equal(await summary.evaluate((el) => el.parentElement.open), true);
      check(engine + ' keyboard FAQ');
      const downloadPromise = page.waitForEvent('download');
      await page.locator('[data-calendar]').first().click();
      const download = await downloadPromise;
      const ics = await readFile(await download.path(), 'utf8');
      assert.match(ics, /DTSTART:20261010T053000Z/);
      assert.match(ics, /DTEND:20261010T090000Z/);
      check(engine + ' actual calendar download');

      await page.evaluate(() =>
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: async (value) => {
              window.copiedValue = value;
            },
          },
        }),
      );
      await page.locator('[data-copy-address]').click();
      assert.equal(await page.evaluate(() => window.copiedValue), event.address);
      await page.evaluate(() =>
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: async () => {
              throw new Error('Denied');
            },
          },
        }),
      );
      await page.locator('[data-copy-address]').click();
      assert.equal(await page.locator('.copy-dialog textarea').inputValue(), event.address);
      await page.keyboard.press('Escape');
      assert.ok(
        await page.locator('[data-copy-address]').evaluate((el) => el === document.activeElement),
      );
      check(engine + ' copy success and denied permission fallback');

      await page.locator('[data-share]').click();
      assert.match(await page.locator('.toast').innerText(), /上线后/);
      await page.goto(base + '/test-share.html');
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: async (value) => {
              window.copiedValue = value;
            },
          },
        });
      });
      await page.locator('[data-share]').click();
      assert.equal(await page.evaluate(() => window.copiedValue), 'https://example.com/campus/');
      check(engine + ' share with native-share fallback and local URL guard');

      await page.goto(base + '/test-open.html');
      assert.equal(await page.locator('[data-register]').count(), 3);
      assert.equal(
        await page.locator('[data-register]').first().getAttribute('href'),
        'https://example.com/register',
      );
      await page.goto(base + '/test-ended.html');
      assert.equal(await page.locator('[data-register]').count(), 0);
      assert.equal(await page.locator('[data-calendar]').count(), 0);
      assert.match(await page.locator('#memory').innerText(), /回顾整理中/);
      await page.goto(base + '/test-day.html');
      assert.equal(await page.locator('.hero-actions > a').first().getAttribute('href'), '#guide');
      await page.goto(base + '/test-recap.html');
      const firstPhoto = page.locator('[data-photo]').first();
      await firstPhoto.click();
      assert.equal(await page.locator('[data-photo-count]').innerText(), '1 / 4');
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('[data-photo-count]').innerText(), '2 / 4');
      await page.keyboard.press('Escape');
      assert.ok(await firstPhoto.evaluate((el) => el === document.activeElement));
      check(engine + ' registration, event-day, ended and recap fixture workflows');
      assert.deepEqual(errors, []);
      check(engine + ' zero browser errors or failed local resources');

      const noJS = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 390, height: 844 },
      });
      const plain = await noJS.newPage();
      await plain.goto(base);
      assert.equal(await plain.locator('h1').isVisible(), true);
      assert.equal(await plain.locator('.agenda-row').count(), 9);
      assert.equal(await plain.locator('[data-calendar]').first().isVisible(), true);
      assert.equal(await plain.locator('.will-reveal').count(), 0);
      assert.equal(await plain.locator('.team-person').count(), 8);
      assert.equal(await plain.locator('.team-bar:disabled').count(), 8);
      assert.equal(
        await plain.locator('.team-member').filter({ hasText: '治乾' }).isVisible(),
        true,
      );
      assert.equal(
        await plain.locator('.team-member').filter({ hasText: '北语校园大使 02' }).isVisible(),
        true,
      );
      await plain.locator('.faq-list summary').first().click();
      assert.equal(
        await plain
          .locator('.faq-list details')
          .first()
          .evaluate((el) => el.open),
        true,
      );
      assert.equal(await plain.locator('[data-theme-switch]:visible').count(), 0);
      assert.equal(await plain.locator('html').getAttribute('data-theme'), null);
      assert.equal(
        await plain.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor),
        'rgb(247, 247, 242)',
      );
      check(engine + ' no-JavaScript content, calendar and FAQ');
      await noJS.close();
      await context.close();

      const motionContext = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: 'no-preference',
        recordVideo:
          engine === 'chromium'
            ? { dir: 'artifacts/validation/motion', size: { width: 1440, height: 1000 } }
            : undefined,
      });
      const motion = await motionContext.newPage();
      await motion.goto(base);
      assert.ok((await motion.locator('.will-reveal').count()) > 0);
      await motion.locator('.benefit').first().scrollIntoViewIfNeeded();
      await motion.waitForFunction(
        () => !document.querySelector('.benefit').classList.contains('will-reveal'),
      );
      await motion.waitForTimeout(900);
      assert.equal(
        await motion
          .locator('.benefit')
          .first()
          .evaluate((el) => getComputedStyle(el).opacity),
        '1',
      );
      await motion.emulateMedia({ reducedMotion: 'reduce' });
      await motion.waitForFunction(() => document.querySelectorAll('.will-reveal').length === 0);
      assert.equal(await motion.locator('.will-reveal').count(), 0);
      await motion.screenshot({ path: 'artifacts/validation/' + engine + '-story.png' });
      await motionContext.close();
      check(engine + ' reveal animation and live reduced-motion preference');
      const themeContext = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: 'reduce',
      });
      try {
        const themed = await themeContext.newPage();
        const htmlRoot = themed.locator('html');
        const headerSwitch = themed.locator('.header-inner .theme-switch');
        const background = () =>
          themed.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor);
        const themeColor = () => themed.locator('meta[name="theme-color"]').getAttribute('content');
        const assertTraeAxe = async (label) => {
          const result = await new AxeBuilder({ page: themed })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();
          assert.equal(
            result.violations.length,
            0,
            engine +
              ' Trae axe ' +
              label +
              ' ' +
              JSON.stringify(
                result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
              ),
          );
        };
        await themed.goto(base, { waitUntil: 'networkidle' });
        assert.equal(await headerSwitch.getAttribute('aria-checked'), 'false');
        assert.equal(await background(), 'rgb(247, 247, 242)');
        assert.equal(await htmlRoot.getAttribute('data-theme'), null);
        await headerSwitch.click();
        assert.equal(await htmlRoot.getAttribute('data-theme'), 'trae');
        assert.equal(await headerSwitch.getAttribute('aria-checked'), 'true');
        assert.equal(await background(), 'rgb(26, 27, 29)');
        assert.equal(await themeColor(), '#1a1b1d');
        await themed.reload({ waitUntil: 'networkidle' });
        assert.equal(await htmlRoot.getAttribute('data-theme'), 'trae');
        assert.equal(await headerSwitch.getAttribute('aria-checked'), 'true');
        assert.equal(await background(), 'rgb(26, 27, 29)');
        await assertTraeAxe('1440');
        await themed.screenshot({
          path: 'artifacts/validation/trae-' + engine + '-1440.png',
          fullPage: true,
        });
        assert.equal(
          await themed.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
        );
        await headerSwitch.focus();
        await themed.keyboard.press('Space');
        assert.equal(await htmlRoot.getAttribute('data-theme'), null);
        assert.equal(await headerSwitch.getAttribute('aria-checked'), 'false');
        assert.equal(await themeColor(), '#f7f7f2');
        await themed.keyboard.press('Enter');
        assert.equal(await htmlRoot.getAttribute('data-theme'), 'trae');
        await themed.setViewportSize({ width: 390, height: 844 });
        assert.equal(await headerSwitch.isVisible(), false);
        await themed.locator('.menu-toggle').click();
        const menuSwitch = themed.locator('.mobile-menu .theme-switch');
        assert.equal(await menuSwitch.isVisible(), true);
        assert.equal(await menuSwitch.getAttribute('aria-checked'), 'true');
        await themed.locator('[data-close-menu]').click();
        await assertTraeAxe('390');
        assert.equal(
          await themed.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
        );
        await themed.locator('.menu-toggle').click();
        await menuSwitch.click();
        assert.equal(await htmlRoot.getAttribute('data-theme'), null);
        assert.equal(await menuSwitch.getAttribute('aria-checked'), 'false');
        await themed.locator('[data-close-menu]').click();
        assert.equal(await background(), 'rgb(247, 247, 242)');
      } finally {
        await themeContext.close();
      }
      check(engine + ' theme switch, persistence, keyboard and Trae contrast');
      await verifyHeroMotion(browser, base, engine, check);
    } finally {
      await browser.close();
    }
  }
} catch (error) {
  report.errors.push(error.stack);
  process.exitCode = 1;
  console.error(error);
} finally {
  await writeFile('artifacts/validation/browser-report.json', JSON.stringify(report, null, 2));
  await new Promise((done) => server.close(done));
}
