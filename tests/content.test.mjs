import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateEvent, calendar, resolvePhase } from '../src/content.mjs';
import { render } from '../src/render.mjs';
const event = JSON.parse(readFileSync('src/event.json', 'utf8'));
const template = readFileSync('src/index.template.html', 'utf8');
const before = new Date('2026-09-24T12:00:00+08:00');
const copy = () => structuredClone(event);
test('The actual nine agenda slots cover 13:30–17:00 continuously', () => {
  assert.equal(validateEvent(event), event);
  assert.equal(event.agenda.length, 9);
  assert.equal((Date.parse(event.end) - Date.parse(event.start)) / 60000, 210);
  const invalid = copy();
  invalid.agenda[1].start = '14:01';
  assert.throws(() => validateEvent(invalid), /continuous/);
});
test('Calendar uses UTC for correct import across client time zones and folds Unicode safely', () => {
  const result = calendar(event);
  assert.match(result, /DTSTART:20261010T053000Z\r\nDTEND:20261010T090000Z/);
  for (const line of result.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
  const unfolded = result.replace(/\r\n /g, '');
  assert.ok(unfolded.includes('LOCATION:' + event.address));
  assert.ok(unfolded.includes('SUMMARY:' + event.name));
});
test('Registration cannot publish an unsafe or missing link', () => {
  const modified = copy();
  modified.registration.status = 'open';
  for (const url of [null, 'javascript:alert(1)', 'http://example.com']) {
    modified.registration.url = url;
    assert.throws(() => validateEvent(modified), /HTTPS/);
  }
  modified.registration.url = 'https://example.com/register';
  const html = render(modified, template, { now: before });
  assert.match(html, /data-register/);
});
test('Candidates cannot be promoted to a confirmed lineup', () => {
  const modified = copy();
  modified.guests = [{ name: '候选人', role: '讲者', topic: 'AI Coding', confirmed: false }];
  assert.throws(() => validateEvent(modified), /confirmed/);
});
test('Ending the event removes registration and calendars but never invents a recap', () => {
  const modified = copy();
  modified.registration = { status: 'open', url: 'https://example.com/register' };
  const now = new Date('2026-10-10T17:00:01+08:00');
  assert.equal(resolvePhase(modified, now), 'ended');
  const html = render(modified, template, { now });
  assert.doesNotMatch(html, /data-register|data-calendar/);
  assert.match(html, /回顾整理中/);
});
test('Publishing a recap requires verified material and a panorama', () => {
  const modified = copy();
  modified.phase = 'recap';
  assert.throws(() => validateEvent(modified), /verified/);
  modified.recap = { verified: true, summary: '测试', photos: [], stats: [], asOf: '2026-10-17' };
  assert.throws(() => validateEvent(modified), /4–6/);
});
test('Preview HTML is complete without script execution and contains no former fiction', () => {
  const html = render(event, template, { now: before });
  assert.match(html, /2026 年 10 月 10 日 · 星期六/);
  assert.match(html, /报名信息待公布/);
  assert.doesNotMatch(html, /2025|1,?264|86%|hello@cugb|Open Studio|Night Radio|unsplash|\{\{/);
  assert.equal((html.match(/class="agenda-row/g) || []).length, 9);
});
test('Content is escaped and production metadata uses an explicit public origin', () => {
  const modified = copy();
  modified.contact = '<script>alert(1)</script>';
  const html = render(modified, template, { now: before, siteURL: 'https://example.com/campus/' });
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /https:\/\/example.com\/campus\/assets\/share.png/);
  assert.throws(
    () => render(event, template, { siteURL: 'http://localhost:4199' }),
    /public HTTPS/,
  );
});

test('The public team keeps unnamed ambassadors anonymous and known speakers separate from pending topics', () => {
  const html = render(event, template, { now: before });
  assert.equal(event.team.length, 8);
  assert.deepEqual(
    event.team.filter((member) => member.name === null).map((member) => member.group),
    ['cugb', 'blcu', 'blcu', 'ustb'],
  );
  assert.match(html, /北语校园大使 01/);
  assert.match(html, /北语校园大使 02/);
  assert.match(html, /<h4>治乾<\/h4>/);
  assert.match(html, /<h4>可可<\/h4>/);
  assert.match(html, /分享话题后续公布/);
  assert.doesNotMatch(html, /嘉宾及话题，后续公布/);
  const modified = copy();
  modified.team[0].name = '<img src=x onerror=alert(1)>';
  assert.match(render(modified, template, { now: before }), /&lt;img src=x onerror=alert\(1\)&gt;/);
  modified.team[1].id = modified.team[0].id;
  assert.throws(() => validateEvent(modified), /unique IDs/);
});
