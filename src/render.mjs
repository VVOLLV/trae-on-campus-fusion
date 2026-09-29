import { escapeHTML as e, validateEvent, resolvePhase, teamGroups } from './content.mjs';

function renderTeam(members) {
  const people = members.map((member, index) => {
    const group = teamGroups[member.group];
    const peers = members.filter(
      (person) => person.group === member.group && person.role === member.role,
    );
    const suffix = peers.length > 1 ? ' ' + String(peers.indexOf(member) + 1).padStart(2, '0') : '';
    return {
      ...member,
      number: String(index + 1).padStart(2, '0'),
      label: member.name || group.short + member.role + suffix,
      organization: group.name,
      detail: member.speakerOrder
        ? '嘉宾 ' + String(member.speakerOrder).padStart(2, '0') + ' · ' + member.role
        : member.role,
    };
  });
  return {
    teamCount: String(people.length).padStart(2, '0'),
    teamBars: people
      .map(
        (person) => `
      <button type="button" class="team-bar team-color-${e(person.group)}" data-team-select="${e(person.id)}" aria-label="${e(person.number + ' · ' + person.label + '，' + person.organization + '，' + person.detail)}" aria-controls="team-selection" disabled>
        <span>${person.number}</span><span class="team-bar-marker" aria-hidden="true">↗</span>
      </button>`,
      )
      .join(''),
    teamLegend: Object.entries(teamGroups)
      .map(([id, group]) => {
        const count = people.filter((person) => person.group === id).length;
        return count
          ? `<li class="team-color-${id}"><i aria-hidden="true"></i>${e(group.short)}<span>${count}</span></li>`
          : '';
      })
      .join(''),
    teamRoster: people
      .map(
        (person) => `
      <li class="team-person team-color-${e(person.group)}" id="team-${e(person.id)}">
        <button type="button" class="team-member" data-team-select="${e(person.id)}" aria-controls="team-selection" disabled>
          <span class="team-member-number">${person.number}</span>
          <span class="team-member-copy"><strong data-member-name>${e(person.label)}</strong><span data-member-detail>${e(person.name ? person.detail : person.organization)}</span></span>
        </button>
      </li>`,
      )
      .join(''),
  };
}

function photos(items) {
  return (
    '<div class="photo-grid">' +
    items
      .map(
        (p, i) =>
          '<figure class="photo-card"><a href="' +
          e(p.src) +
          '" data-photo data-caption="' +
          e(p.caption + ' · ' + p.date) +
          '" aria-label="放大照片：' +
          e(p.caption) +
          '"><img src="' +
          e(p.src) +
          '" alt="' +
          e(p.alt) +
          '" width="' +
          p.width +
          '" height="' +
          p.height +
          '" loading="lazy" decoding="async"></a><figcaption><span>' +
          String(i + 1).padStart(2, '0') +
          ' / ' +
          e(p.date) +
          '</span><span>' +
          e(p.caption) +
          '</span></figcaption></figure>',
      )
      .join('') +
    '</div>'
  );
}

export function render(event, template, { now = new Date(), siteURL = '' } = {}) {
  validateEvent(event);
  if (siteURL) {
    const url = new URL(siteURL);
    if (
      url.protocol !== 'https:' ||
      /^(localhost|127\.|\[::1\])/.test(url.hostname) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error('SITE_URL must be a public HTTPS base URL');
    siteURL = url.href.replace(/\/?$/, '/');
  }
  const phase = resolvePhase(event, now);
  const past = ['ended', 'recap'].includes(phase);
  const open = !past && event.registration.status === 'open';
  const date = new Date(event.start);
  const dateParts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  }).formatToParts(date);
  const part = (type) => dateParts.find((p) => p.type === type).value;
  const dateShort = part('year') + '.' + part('month') + '.' + part('day');
  const fullDate =
    part('year') +
    ' 年 ' +
    Number(part('month')) +
    ' 月 ' +
    Number(part('day')) +
    ' 日 · ' +
    part('weekday');
  const timeRange = event.start.slice(11, 16) + '–' + event.end.slice(11, 16);
  const statusLabel =
    phase === 'recap'
      ? '活动回顾'
      : phase === 'ended'
        ? '活动已结束'
        : phase === 'event-day'
          ? '今天见'
          : open
            ? '报名已开放'
            : event.registration.status === 'closed'
              ? '报名已截止'
              : '报名信息待公布';
  const description =
    event.name +
    '，' +
    fullDate +
    ' ' +
    timeRange +
    '，' +
    event.venue +
    '。主题分享、Q&A 与现场 AI Coding 演示答疑，面向三校在校生。';
  const registrationAction = open
    ? '<a class="button button-dark" data-register href="' +
      e(event.registration.url) +
      '" target="_blank" rel="noopener noreferrer">前往报名 <span aria-hidden="true">↗</span></a>'
    : '<a class="button button-dark" href="' +
      (past ? '#memory' : '#agenda') +
      '">' +
      (phase === 'recap' ? '阅读活动回顾' : phase === 'ended' ? '查看活动档案' : '先看活动议程') +
      ' <span aria-hidden="true">↗</span></a>';
  // The header CTA stays put at every phase: filled while registration is open,
  // quieter outline otherwise, so the phase is readable without scrolling.
  const headerAction = open
    ? '<a class="button button-dark header-cta" data-register href="' +
      e(event.registration.url) +
      '" target="_blank" rel="noopener noreferrer">前往报名 <span aria-hidden="true">↗</span></a>'
    : '<a class="button button-outline header-cta" data-header-cta href="' +
      (past ? '#memory' : phase === 'event-day' ? '#guide' : '#agenda') +
      '">' +
      (phase === 'recap'
        ? '阅读活动回顾'
        : phase === 'ended'
          ? '查看活动档案'
          : phase === 'event-day'
            ? '查看入场指引'
            : '先看活动议程') +
      ' <span aria-hidden="true">↗</span></a>';
  const teamSpeakers = (event.team || [])
    .filter((member) => member.speakerOrder)
    .sort((a, b) => a.speakerOrder - b.speakerOrder);
  const speakerRecords = event.guests.length
    ? event.guests
    : teamSpeakers.map((member) => ({ ...member, topic: '分享话题后续公布' }));
  const speakers = speakerRecords.length
    ? '<div class="speaker-grid">' +
      speakerRecords
        .map(
          (g, index) =>
            '<article><span class="speaker-label">分享嘉宾 ' +
            String(index + 1).padStart(2, '0') +
            '</span><h4>' +
            e(g.name) +
            '</h4><p>' +
            e(g.role) +
            '</p><p class="speaker-topic">' +
            e(g.topic) +
            '</p></article>',
        )
        .join('') +
      '</div>'
    : '<div class="speaker-pending"><span class="pending-symbol" aria-hidden="true">＋</span><p><strong>嘉宾及话题，后续公布。</strong><br>两场分享，期待不同经验带来的新视角。</p></div>';
  const previousDate = new Date(event.previousEvent.date + 'T12:00:00+08:00');
  const monthName = (value) =>
    new Intl.DateTimeFormat('zh-CN', { month: 'long', timeZone: 'Asia/Shanghai' }).format(value);
  const previousLabel = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Shanghai',
  }).format(previousDate);
  let memory = `
    <div class="section-heading">
      <h2 id="memory-title" class="display">从${e(monthName(previousDate))}的初见，<br><span class="outline">到${e(monthName(date))}的再会。</span></h2>
      <p class="section-intro">${e(previousLabel)}，${e(event.previousEvent.label)}举办。<br>让交流继续，也让更多同学加入。</p>
    </div>
    <div class="history-grid">
      <article class="history-card past">
        <p class="history-date">${e(event.previousEvent.date.slice(5, 7))}<span>/</span>${e(event.previousEvent.date.slice(8, 10))}</p>
        <div><h3>第一次，在地大相遇。</h3><p>${e(event.previousEvent.date.slice(0, 4))} · ${e(event.previousEvent.label)}</p></div>
        <span class="history-symbol" aria-hidden="true">↗</span>
      </article>
      <article class="history-card next">
        <p class="history-date">${e(part('month'))}<span>/</span>${e(part('day'))}</p>
        <div><h3>这一次，和更多人一起。</h3><p>${e(part('year'))} · ${e(event.edition)} · 三校联合</p></div>
        <span class="history-symbol" aria-hidden="true">✳</span>
      </article>
    </div>
    <a class="text-link history-link" href="https://forum.trae.cn/t/topic/213" target="_blank" rel="noopener noreferrer">看看更多高校的创造故事 <span aria-hidden="true">↗</span></a>
  `;
  if (event.pastPhotos.length) memory += photos(event.pastPhotos);
  if (phase === 'ended')
    memory =
      '<div class="section-heading"><h2 id="memory-title" class="display">活动已结束，<br><span class="outline">故事还在继续。</span></h2><p class="section-intro">回顾整理中。真实现场照片、分享内容与公开作品将在资料整理完成后更新。</p></div><p class="archive-note">' +
      e(fullDate) +
      ' · ' +
      e(timeRange) +
      ' · ' +
      e(event.venue) +
      '</p>';
  if (phase === 'recap')
    memory =
      '<div class="section-heading"><h2 id="memory-title" class="display">一个下午，<br><span class="outline">留下这些可能。</span></h2><p class="section-intro">' +
      e(event.recap.summary) +
      '</p></div>' +
      photos(event.recap.photos) +
      '<dl class="recap-stats">' +
      event.recap.stats
        .map(
          (s) =>
            '<div><dt>' +
            e(s.label) +
            '</dt><dd>' +
            e(s.value) +
            '</dd><p>' +
            e(s.source) +
            '</p></div>',
        )
        .join('') +
      '</dl><p class="muted">统计截至 ' +
      e(event.recap.asOf) +
      '</p><div class="work-links">' +
      (event.recap.works || [])
        .map(
          (w) =>
            '<a class="text-link" href="' +
            e(w.url) +
            '" target="_blank" rel="noopener noreferrer">' +
            e(w.title) +
            ' ↗</a>',
        )
        .join('') +
      '</div>';
  const faq = event.faq
    .map((item, i) => {
      let answer = item.answer;
      if (i === 3)
        answer = past
          ? '活动已结束，可以在本页查看活动档案与回顾更新。'
          : open
            ? '报名已开放，请使用本页的“前往报名”入口。13:30 开始签到；' + event.entryNote
            : event.registration.status === 'closed'
              ? '报名已截止。已报名同学请于 13:30 开始签到，并在出发前查看入场指引。'
              : item.answer;
      return (
        '<details><summary>' +
        e(item.question) +
        '<span class="faq-plus" aria-hidden="true"></span></summary><p>' +
        e(answer) +
        '</p></details>'
      );
    })
    .join('');
  const fields = {
    pageTitle: e(event.name + (past ? '｜活动回顾' : '｜让想法，开始运行。')),
    description: e(description),
    shareImage: e(siteURL ? new URL('assets/share.png', siteURL).href : 'assets/share.png'),
    canonical: siteURL
      ? '<link rel="canonical" href="' +
        e(siteURL) +
        '"><meta property="og:url" content="' +
        e(siteURL) +
        '">'
      : '',
    phase,
    end: e(event.end),
    statusLabel: e(statusLabel),
    headerAction,
    edition: e(event.edition),
    compactDate: e(
      dateShort +
        ' · ' +
        new Intl.DateTimeFormat('zh-CN', { weekday: 'short', timeZone: 'Asia/Shanghai' }).format(
          date,
        ),
    ),
    fullDate: e(fullDate),
    timeRange: e(timeRange),
    venue: e(event.venue),
    organizer: e(event.organizer),
    address: e(event.address),
    schoolCount: String(event.schools.length).padStart(2, '0'),
    durationHours: (Date.parse(event.end) - Date.parse(event.start)) / 3600000,
    talkCount: String(event.agenda.filter((slot) => slot.type.startsWith('TALK')).length).padStart(
      2,
      '0',
    ),
    plannedRange: event.plannedParticipants.min + '–' + event.plannedParticipants.max,
    dayNumber: part('day'),
    monthEnglish: new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'Asia/Shanghai' })
      .format(date)
      .toUpperCase(),
    heroTitle:
      'TRAE on Campus <span class="hero-fusion outline">' +
      [...'Fusion'].map((letter) => `<span class="fusion-letter">${letter}</span>`).join('') +
      '</span>',
    heroDescription: e(
      past
        ? '一个关于 AI Coding 的下午。活动已结束，继续在这里关注内容、作品与现场回顾。'
        : '与中国地质大学（北京）、北京语言大学、北京科技大学的同学一起，在分享、演示和问答中，探索 AI Coding 的第一步。',
    ),
    heroAction: open
      ? registrationAction
      : '<a class="button button-dark" href="' +
        (past ? '#memory' : phase === 'event-day' ? '#guide' : '#agenda') +
        '">' +
        (past ? '查看活动回顾' : phase === 'event-day' ? '查看入场指引' : '探索活动议程') +
        ' <span aria-hidden="true">↗</span></a>',
    agenda: event.agenda
      .map(
        (slot) =>
          '<li class="agenda-row reveal' +
          (slot.featured ? ' featured' : '') +
          '"><span class="agenda-time"><time>' +
          e(slot.start) +
          '</time><span>— ' +
          e(slot.end) +
          '</span></span><div class="agenda-content"><h3>' +
          e(slot.title) +
          '</h3><p>' +
          e(slot.detail) +
          '</p></div></li>',
      )
      .join(''),
    speakers,
    ...renderTeam(event.team || []),
    memory,
    memoryLabel: past ? '活动回顾' : '从五月到十月',
    mapURL: e(
      'https://uri.amap.com/search?keyword=' +
        encodeURIComponent(event.address) +
        '&city=' +
        encodeURIComponent('北京') +
        '&callnative=0',
    ),
    entryNote: e(event.entryNote),
    contact: event.contact
      ? '<p class="public-contact">活动联系：' + e(event.contact) + '</p>'
      : '',
    faq,
    joinTitle: past ? '把新的想法，<br>带回校园。' : '下一次创造，<br>从这次见面开始。',
    joinDescription: e(
      phase === 'recap'
        ? '回看这个下午的现场与作品。期待下次相遇。'
        : phase === 'ended'
          ? '活动已结束，回顾整理中。收藏本页，继续关注内容更新。'
          : open
            ? '报名入口已开放。带上你的好奇心和问题，现场见。'
            : event.registration.status === 'closed'
              ? '报名已截止。已报名的同学请查看参会指引，现场见。'
              : '报名信息待公布。先记下这个下午，带上你的好奇心和问题。',
    ),
    registrationAction,
  };
  let html = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in fields)) throw new Error('Unknown field ' + key);
    return fields[key];
  });
  if (past) html = html.replace(/<a\b[^>]*\bdata-calendar\b[^>]*>.*?<\/a\s*>/gs, '');
  return html;
}
