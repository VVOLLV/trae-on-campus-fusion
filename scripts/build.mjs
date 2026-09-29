import { readFile, writeFile, mkdir, cp, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { render } from '../src/render.mjs';
import { calendar, validateEvent } from '../src/content.mjs';
const event = validateEvent(JSON.parse(await readFile('src/event.json', 'utf8')));
const assets = new Map();
for (const file of ['styles.css', 'script.js', 'colors_and_type.css'])
  assets.set(file, await readFile('src/' + file));
// A new build must not reuse a previous layout's cached CSS or JavaScript.
const template = (await readFile('src/index.template.html', 'utf8')).replace(
  /\b(href|src)="(colors_and_type\.css|styles\.css|script\.js)"/g,
  (_, attribute, file) => {
    const version = createHash('sha256').update(assets.get(file)).digest('hex').slice(0, 12);
    return `${attribute}="${file}?v=${version}"`;
  },
);
const html = render(event, template, { siteURL: process.env.SITE_URL || '' });
for (const photo of [...event.pastPhotos, ...(event.recap?.photos || [])])
  await stat(resolve('src', photo.src));
for (const destination of ['cugb-phase2-prototype', 'dist']) {
  await mkdir(destination, { recursive: true });
  await writeFile(destination + '/campus-meetup.ics', calendar(event));
  for (const [file, content] of assets) await writeFile(destination + '/' + file, content);
  await cp('src/assets', destination + '/assets', { recursive: true });
  await writeFile(destination + '/index.html', html);
}
console.log('Built preview and dist: ' + event.name + ' (' + event.phase + ')');
