export const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
export const clockMinutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
export const teamGroups = {
  cugb: { short: '地大', name: '中国地质大学（北京）', code: 'CUGB' },
  blcu: { short: '北语', name: '北京语言大学', code: 'BLCU' },
  ustb: { short: '北科', name: '北京科技大学', code: 'USTB' },
  trae: { short: 'TRAE', name: 'TRAE', code: 'TRAE' },
};
export const safeURL = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};
export function validateEvent(event) {
  if (!['upcoming', 'event-day', 'ended', 'recap'].includes(event.phase))
    throw new Error('Unknown event phase');
  if (
    !event.start.endsWith('+08:00') ||
    !event.end.endsWith('+08:00') ||
    !(Date.parse(event.end) > Date.parse(event.start))
  )
    throw new Error('Invalid event dates');
  if (!event.agenda.length) throw new Error('Agenda required');
  let previous = event.start.slice(11, 16);
  for (const slot of event.agenda) {
    if (
      !/^\d{2}:\d{2}$/.test(slot.start) ||
      !/^\d{2}:\d{2}$/.test(slot.end) ||
      slot.start !== previous ||
      clockMinutes(slot.end) <= clockMinutes(slot.start)
    )
      throw new Error('Agenda must be continuous and ordered');
    previous = slot.end;
  }
  if (previous !== event.end.slice(11, 16)) throw new Error('Agenda must end with the event');
  if (!['pending', 'open', 'closed'].includes(event.registration.status))
    throw new Error('Invalid registration state');
  if (event.registration.status === 'open' && !safeURL(event.registration.url))
    throw new Error('Open registration needs an HTTPS URL');
  for (const guest of event.guests)
    if (!guest.confirmed || !guest.name || !guest.role || !guest.topic)
      throw new Error('Only confirmed, complete guest records may be published');
  const memberIds = new Set();
  const speakerOrders = new Set();
  for (const member of event.team || []) {
    if (
      !/^[a-z][a-z0-9-]*$/.test(member.id || '') ||
      memberIds.has(member.id) ||
      !Object.hasOwn(teamGroups, member.group) ||
      !member.role?.trim() ||
      (member.name !== null && !member.name?.trim())
    )
      throw new Error('Team members need unique IDs, a known group, a role and a name or null');
    if (member.speakerOrder !== undefined) {
      if (
        !Number.isInteger(member.speakerOrder) ||
        member.speakerOrder < 1 ||
        speakerOrders.has(member.speakerOrder) ||
        !member.name
      )
        throw new Error('Team speakers need a name and a unique positive order');
      speakerOrders.add(member.speakerOrder);
    }
    memberIds.add(member.id);
  }
  const photos = [...event.pastPhotos, ...(event.recap?.photos || [])];
  for (const photo of photos)
    if (
      !photo.src?.startsWith('assets/') ||
      photo.src.includes('..') ||
      !photo.alt ||
      !photo.caption ||
      !photo.source ||
      !photo.date ||
      !photo.width ||
      !photo.height
    )
      throw new Error('Photos need a local path, size, caption, source, and date');
  if (event.phase === 'recap') {
    if (
      !event.recap?.summary ||
      !event.recap.verified ||
      event.recap.photos.length < 4 ||
      event.recap.photos.length > 6 ||
      !event.recap.photos.some((photo) => photo.panorama)
    )
      throw new Error('Recap requires verified copy and 4–6 real photos including a panorama');
    if (
      !event.recap.stats?.every(
        (stat) => stat.source && stat.label && Number.isFinite(stat.value),
      ) ||
      !event.recap.asOf
    )
      throw new Error('Recap statistics need sources and a cutoff date');
    for (const work of event.recap.works || [])
      if (!safeURL(work.url) || !work.title) throw new Error('Invalid public work link');
  }
  return event;
}
export function resolvePhase(event, now = new Date()) {
  if (event.phase === 'recap') return 'recap';
  if (now.getTime() >= Date.parse(event.end)) return 'ended';
  return event.phase;
}
export function calendar(event) {
  const utc = (value) => new Date(value).toISOString().replace(/[-:]/g, '').replace('.000', '');
  const escape = (value) =>
    value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  // RFC 5545 lines fold at 75 UTF-8 octets, never inside a multibyte character.
  const fold = (line) => {
    let result = '',
      part = '';
    for (const char of line) {
      if (Buffer.byteLength(part + char) > 75) {
        result += part + '\r\n';
        part = ' ';
      }
      part += char;
    }
    return result + part;
  };
  return (
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//TRAE on Campus//Beijing Meetup//ZH',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:trae-campus-beijing-20261010@trae-on-campus.local',
      'DTSTAMP:20260924T000000Z',
      'DTSTART:' + utc(event.start),
      'DTEND:' + utc(event.end),
      'SUMMARY:' + escape(event.name),
      'LOCATION:' + escape(event.address),
      'DESCRIPTION:' +
        escape(
          '主题分享、Q&A、现场 AI Coding 演示答疑。北京时间 13:30 开始签到。请在出发前确认报名及入场安排。',
        ),
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .map(fold)
      .join('\r\n') + '\r\n'
  );
}
