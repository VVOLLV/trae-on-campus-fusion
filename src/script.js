/* Progressive enhancement: the event, schedule, links and FAQs work without JS. */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const desktop = matchMedia('(min-width: 801px)');
const finePointer = matchMedia('(pointer: fine)');
let toastTimer;
const dialogOpeners = new WeakMap();

function notify(message) {
  const toast = $('.toast');
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 4500);
}

function openDialog(dialog, opener = document.activeElement) {
  dialogOpeners.set(dialog, opener);
  dialog.returnValue = '';
  dialog.showModal();
  document.body.classList.add('modal-open');
}

function setupDialogs() {
  $$('dialog').forEach((dialog) => {
    dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const controls = $$(
        'a[href], button:not([disabled]), textarea, input, [tabindex="0"]',
        dialog,
      ).filter((element) => !element.hidden && element.getClientRects().length);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    dialog.addEventListener('close', () => {
      if (!$('dialog[open]')) document.body.classList.remove('modal-open');
      const opener = dialogOpeners.get(dialog);
      if (opener?.isConnected && opener.getClientRects().length)
        opener.focus({ preventScroll: true });
      dialogOpeners.delete(dialog);
    });
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      )
        dialog.close();
    });
  });
}

function setupMenu() {
  const menu = $('#mobile-menu');
  const toggle = $('.menu-toggle');
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    openDialog(menu, toggle);
    toggle.setAttribute('aria-expanded', 'true');
  });
  $('[data-close-menu]').addEventListener('click', () => menu.close());
  menu.addEventListener('close', () => {
    toggle.setAttribute('aria-expanded', 'false');
    if (menu.returnValue.startsWith('#')) {
      const target = $(menu.returnValue);
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
      }
    } else if (desktop.matches) $('.brand').focus({ preventScroll: true });
  });
  $$('nav a', menu).forEach((link) =>
    link.addEventListener('click', () => {
      menu.close(link.hash);
    }),
  );
  desktop.addEventListener('change', () => {
    if (desktop.matches && menu.open) {
      menu.close();
      $('.brand').focus({ preventScroll: true });
    }
  });
}

async function copyText(value, success, opener) {
  try {
    await navigator.clipboard.writeText(value);
    notify(success);
  } catch {
    const dialog = $('.copy-dialog');
    const textarea = $('textarea', dialog);
    textarea.value = value;
    openDialog(dialog, opener);
    textarea.focus();
    textarea.select();
  }
}

function setupActions() {
  const addressButton = $('[data-copy-address]');
  addressButton.hidden = false;
  addressButton.addEventListener('click', () =>
    copyText(addressButton.dataset.value, '地址已复制，地图里见。', addressButton),
  );
  $('[data-close-copy]').addEventListener('click', () => $('.copy-dialog').close());
  const shareButton = $('[data-share]');
  shareButton.hidden = false;
  shareButton.addEventListener('click', async () => {
    const canonical = $('link[rel="canonical"]')?.href;
    const local = ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);
    if (!canonical && local) {
      notify('活动页面上线后即可分享，先加入日历吧。');
      return;
    }
    const url = canonical || location.origin + location.pathname;
    if (navigator.share) {
      try {
        await navigator.share({
          title: document.title,
          text: 'TRAE on Campus：让想法，开始运行。',
          url,
        });
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }
    await copyText(url, '活动链接已复制。', shareButton);
  });
}

function setupTheme() {
  const controls = $$('[data-theme-switch]');
  if (!controls.length) return;
  const meta = $('meta[name="theme-color"]');
  const isTrae = () => document.documentElement.dataset.theme === 'trae';
  const apply = (theme) => {
    const trae = theme === 'trae';
    if (trae) document.documentElement.dataset.theme = 'trae';
    else delete document.documentElement.dataset.theme;
    if (meta) meta.content = trae ? '#1a1b1d' : '#f7f7f2';
    controls.forEach((control) => control.setAttribute('aria-checked', String(trae)));
  };
  const stored = () => {
    try {
      return localStorage.getItem('trae-on-campus-theme') === 'trae' ? 'trae' : 'campus';
    } catch {
      // Storage blocked: the pre-paint script already resolved the attribute.
      return isTrae() ? 'trae' : 'campus';
    }
  };
  controls.forEach((control) => {
    control.hidden = false;
    control.addEventListener('click', () => {
      const next = isTrae() ? 'campus' : 'trae';
      apply(next);
      try {
        localStorage.setItem('trae-on-campus-theme', next);
      } catch {
        // Private mode: the choice just does not persist.
      }
    });
  });
  apply(stored());
}

function setupTeam() {
  const team = $('#team');
  if (!team) return;
  const controls = $$('[data-team-select]', team);
  const number = $('[data-team-number]', team);
  const name = $('[data-team-name]', team);
  const detail = $('[data-team-detail]', team);
  const overview = [number.textContent, name.textContent, detail.textContent];
  let selected = '';
  controls.forEach((control) => {
    control.disabled = false;
    control.setAttribute('aria-pressed', 'false');
  });
  team.addEventListener('click', (event) => {
    const control = event.target.closest('[data-team-select]');
    if (!control || !team.contains(control)) return;
    const id = control.dataset.teamSelect;
    const member = document.getElementById('team-' + id);
    if (!member) return;
    selected = selected === id ? '' : id;
    controls.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.teamSelect === selected));
    });
    const values = selected
      ? [
          $('.team-member-number', member).textContent,
          $('[data-member-name]', member).textContent,
          $('[data-member-detail]', member).textContent,
        ]
      : overview;
    [number, name, detail].forEach((element, index) => {
      element.textContent = values[index];
    });
  });
}

function setupMotion() {
  const progress = $('.scroll-progress span');
  const header = $('.site-header');
  const navLinks = $$('.desktop-nav a');
  const sections = navLinks.map((link) => $(link.hash));
  let frame = 0;
  let previousSection = '';
  const update = () => {
    frame = 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform =
      'scaleX(' + (max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0) + ')';
    header.classList.toggle('scrolled', scrollY > 20);
    let active = '';
    sections.forEach((section) => {
      const box = section.getBoundingClientRect();
      if (box.top <= innerHeight * 0.42 && box.bottom >= 120) active = section.id;
    });
    if (active !== previousSection) {
      navLinks.forEach((link) => {
        if (link.hash === '#' + active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
      previousSection = active;
    }
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  reducedMotion.addEventListener('change', schedule);
  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(document.body);
  schedule();

  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove('will-reveal');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -20px 0px' },
  );
  if (!reducedMotion.matches) {
    $$('.reveal').forEach((element) => {
      if (element.getBoundingClientRect().top < innerHeight - 30) return;
      element.classList.add('will-reveal');
      observer.observe(element);
    });
  }
  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    observer.disconnect();
    $$('.will-reveal').forEach((element) => element.classList.remove('will-reveal'));
    document.getAnimations().forEach((animation) => animation.finish());
  });
}

function setupHeroMotion() {
  const hero = $('.hero');
  if (!hero) return;
  const heading = $('.hero-heading', hero);
  const fusion = $('.hero-fusion', hero);
  if (!heading || !fusion) return;
  const letters = $$('.fusion-letter', fusion);
  const canAnimate = () => !reducedMotion.matches && !document.hidden;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const set = (element, name, value) => element.style.setProperty(name, value);
  hero.classList.add('has-hero-motion');

  // Read layout once per interaction/resize. The easing loop sleeps when settled.
  function lightSurface(element, measure, paint) {
    const current = { x: 0.5, y: 0.5, light: 0 };
    const target = { ...current };
    let frame = 0;
    let lastTime = 0;
    let geometry;
    let dirty = true;
    let pointer;
    let sweep;
    const request = () => {
      if (!frame && canAnimate()) frame = requestAnimationFrame(update);
    };
    const update = (now) => {
      frame = 0;
      if (!canAnimate()) return reset();
      if (dirty) {
        const box = element.getBoundingClientRect();
        geometry = { box, detail: measure(box) };
        dirty = false;
      }
      const { box, detail } = geometry;
      if (pointer) {
        target.x = clamp((pointer.x - box.left) / box.width, 0, 1);
        target.y = clamp((pointer.y - box.top) / box.height, 0, 1);
        pointer = null;
      }
      if (sweep) {
        const progress = clamp((now - sweep.start) / 1350, 0, 1);
        target.x = sweep.from + (sweep.to - sweep.from) * progress;
        target.y = sweep.y;
        target.light = Math.sin(progress * Math.PI) * 0.85;
        if (progress === 1) {
          sweep = null;
          target.light = 0;
        }
      }
      const dt = lastTime ? Math.min(now - lastTime, 48) : 16;
      lastTime = now;
      const ease = 1 - Math.exp(-dt / 85);
      let moving = false;
      for (const key of ['x', 'y', 'light']) {
        current[key] += (target[key] - current[key]) * ease;
        if (Math.abs(target[key] - current[key]) < 0.001) current[key] = target[key];
        else moving = true;
      }
      paint(current, box, detail);
      if (moving || sweep) request();
      else lastTime = 0;
    };
    const release = () => {
      sweep = null;
      pointer = null;
      target.light = 0;
      if (current.light > 0 || frame) request();
    };
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      sweep = null;
      pointer = null;
      current.light = target.light = 0;
      if (geometry) paint(current, geometry.box, geometry.detail);
      dirty = true;
    };
    element.addEventListener(
      'pointermove',
      (event) => {
        if (!canAnimate() || !finePointer.matches || event.pointerType === 'touch') return;
        sweep = null;
        pointer = { x: event.clientX, y: event.clientY };
        target.light = 1;
        request();
      },
      { passive: true },
    );
    element.addEventListener('pointerleave', (event) => {
      // Touch pointers leave immediately after a tap; let that tap's sweep finish.
      if (event.pointerType !== 'touch') release();
    });
    element.addEventListener('pointercancel', release);
    return {
      reset,
      invalidate() {
        dirty = true;
        release();
      },
      release,
      sweep(from, to, y) {
        if (!canAnimate() || target.light > 0) return;
        sweep = { from, to, y, start: performance.now() };
        current.x = from;
        current.y = y;
        request();
      },
    };
  }

  const titleLight = lightSurface(
    heading,
    (box) => {
      const typeBox = fusion.getBoundingClientRect();
      return {
        left: typeBox.left - box.left,
        top: typeBox.top - box.top,
        width: typeBox.width,
        height: typeBox.height,
        letters: letters.map((letter) => ({ left: letter.offsetLeft, width: letter.offsetWidth })),
      };
    },
    ({ x, y, light }, box, type) => {
      const px = x * box.width;
      const py = y * box.height;
      const localX = px - type.left;
      const localY = py - type.top;
      const proximity = clamp(
        1 - Math.max(0, Math.abs(localY - type.height / 2) - type.height / 2) / 100,
        0,
        1,
      );
      const strength = light * proximity;
      set(heading, '--title-x', px.toFixed(1) + 'px');
      set(heading, '--title-y', (py + 32).toFixed(1) + 'px');
      set(heading, '--title-light', (light * 0.7).toFixed(3));
      set(fusion, '--type-light', strength.toFixed(3));
      set(fusion, '--type-y', localY.toFixed(1) + 'px');
      set(fusion, '--type-radius', Math.max(36, type.width * 0.4).toFixed(1) + 'px');
      letters.forEach((letter, index) => {
        const metrics = type.letters[index];
        const distance =
          (localX - metrics.left - metrics.width / 2) / Math.max(36, type.width * 0.45);
        const influence = Math.exp(-distance * distance * 2) * strength;
        const amplitude = Math.min(4, type.height * 0.035);
        set(letter, '--letter-light', (localX - metrics.left).toFixed(1) + 'px');
        letter.style.transform =
          strength > 0.001
            ? `translateY(${(-amplitude * influence).toFixed(2)}px) rotate(${(clamp(distance, -1, 1) * influence * 1.8).toFixed(2)}deg) scale(${(1 + influence * 0.025).toFixed(4)}, ${(1 + influence * 0.045).toFixed(4)})`
            : '';
      });
    },
  );
  const surfaces = [titleLight];
  fusion.addEventListener(
    'pointerup',
    (event) => {
      if (event.pointerType === 'touch') titleLight.sweep(0.68, 1.05, 0.2);
    },
    { passive: true },
  );

  // The headline introduces its material once, without an idle animation loop.
  if ('IntersectionObserver' in window) {
    let introduced = false;
    const introduce = () => {
      if (introduced || !canAnimate()) return;
      const box = heading.getBoundingClientRect();
      if (box.bottom <= 0 || box.top >= innerHeight) return;
      introduced = true;
      titleLight.sweep(0.68, 1.05, 0.2);
    };
    const entry = new IntersectionObserver(
      (entries) => {
        entries.forEach(({ isIntersecting }) => {
          if (!isIntersecting) return;
          entry.unobserve(heading);
          introduce();
        });
      },
      { threshold: 0.45 },
    );
    entry.observe(heading);
    // Safari/WebKit can defer the first observer delivery while fonts and SVGs settle.
    // A bounded visibility check keeps the one-time introduction deterministic.
    requestAnimationFrame(introduce);
    setTimeout(introduce, 120);
    const visibility = new IntersectionObserver((entries) => {
      entries.forEach(({ isIntersecting }) => {
        if (!isIntersecting) titleLight.reset();
      });
    });
    visibility.observe(heading);
  }
  const reset = () => surfaces.forEach((surface) => surface.reset());
  addEventListener('blur', reset);
  addEventListener('pagehide', reset);
  document.addEventListener('visibilitychange', reset);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) reset();
  });
  finePointer.addEventListener('change', () => {
    if (!finePointer.matches) reset();
  });
  addEventListener('scroll', () => surfaces.forEach((surface) => surface.invalidate()), {
    passive: true,
  });
  addEventListener('resize', reset, { passive: true });
  if ('ResizeObserver' in window) {
    const measured = new Map();
    const resize = new ResizeObserver((entries) => {
      // The first delivery only reports the size we already know, and it lands
      // right after the one-time introduction starts. Resetting then would cancel
      // that sweep for good, so only a real size change invalidates the surface.
      const changed = entries.some((entry) => {
        const box = entry.target.getBoundingClientRect();
        const size = box.width + 'x' + box.height;
        const before = measured.get(entry.target);
        measured.set(entry.target, size);
        return before !== undefined && before !== size;
      });
      if (changed) reset();
    });
    resize.observe(heading);
  }
}

function setupLightbox() {
  const links = $$('[data-photo]');
  if (!links.length) return;
  const dialog = $('.lightbox');
  let current = 0;
  const show = (index) => {
    current = (index + links.length) % links.length;
    const link = links[current];
    const image = $('img', dialog);
    image.src = link.href;
    image.alt = $('img', link).alt;
    $('figcaption', dialog).textContent = link.dataset.caption;
    $('[data-photo-count]', dialog).textContent = current + 1 + ' / ' + links.length;
  };
  links.forEach((link, index) =>
    link.addEventListener('click', (event) => {
      event.preventDefault();
      show(index);
      openDialog(dialog, link);
    }),
  );
  $('[data-close-lightbox]').addEventListener('click', () => dialog.close());
  $('[data-photo-prev]').addEventListener('click', () => show(current - 1));
  $('[data-photo-next]').addEventListener('click', () => show(current + 1));
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      show(current - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      show(current + 1);
    }
  });
}

function guardExpiredEvent() {
  if (document.body.dataset.phase === 'recap' || Date.now() < Date.parse(document.body.dataset.end))
    return;
  document.body.dataset.phase = 'ended';
  $$('[data-register]').forEach((link) => {
    link.href = '#memory';
    link.removeAttribute('target');
    link.textContent = '查看活动档案 ↗';
  });
  $$('[data-header-cta]').forEach((link) => {
    link.href = '#memory';
    link.textContent = '查看活动档案 ↗';
  });
  $$('[data-calendar]').forEach((link) => {
    link.hidden = true;
  });
  $$('[data-status]').forEach((label) => {
    label.textContent = '活动已结束';
  });
  $('[data-join-description]').textContent = '活动已结束，回顾整理中。收藏本页，继续关注内容更新。';
}

const VISION_VERTEX = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
const VISION_SCENE = `
precision highp float;
uniform vec2 uRes;
uniform float uProgress;
uniform float uQuality;
const vec3 GREEN = vec3(0.196, 0.941, 0.549);
const vec3 MINT = vec3(0.80, 1.0, 0.89);
const vec3 DEEP = vec3(0.024, 0.027, 0.032);
const vec3 FOGC = vec3(0.045, 0.060, 0.055);
const float FLOOR_Y = -3.4;
float hash1(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
vec3 hash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash1(i);
  float b = hash1(i + vec2(1.0, 0.0));
  float c = hash1(i + vec2(0.0, 1.0));
  float d = hash1(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float sdBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}
vec2 spine(float z) {
  return vec2(sin(z * 0.18) * 2.4 + sin(z * 0.07) * 1.2, cos(z * 0.13) * 1.1);
}
vec2 mapScene(vec3 p) {
  vec3 cell = floor(p / 7.0);
  vec3 lp = p - cell * 7.0 - 3.5;
  vec3 h = hash3(cell);
  float dC = sdBox(lp - (h - 0.5) * 3.4, vec3(0.20 + h.x * h.y * 0.72), 0.06);
  vec3 cell2 = floor(p / 16.0);
  vec3 l2 = p - cell2 * 16.0 - 8.0;
  vec3 h2 = hash3(cell2 + 31.0);
  float dS = sdBox(l2 - (h2 - 0.5) * vec3(9.0, 2.4, 9.0), vec3(1.4 + h2.x * 2.6, 0.20, 2.2 + h2.z * 3.0), 0.10);
  float dF = p.y - FLOOR_Y;
  float d = dC;
  float id = 1.0;
  if (dS < d) { d = dS; id = 2.0; }
  if (dF < d) { d = dF; id = 3.0; }
  return vec2(d, id);
}
vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.02, 0.0);
  return normalize(vec3(
    mapScene(p + e.xyy).x - mapScene(p - e.xyy).x,
    mapScene(p + e.yxy).x - mapScene(p - e.yxy).x,
    mapScene(p + e.yyx).x - mapScene(p - e.yyx).x));
}
vec3 sky(vec3 rd, float t) {
  vec3 c = DEEP * (0.5 + 0.7 * clamp(rd.y * 0.5 + 0.5, 0.0, 1.0));
  c += GREEN * exp(-abs(rd.y + 0.02) * 9.0) * 0.10;
  vec2 aq = rd.xz / max(abs(rd.y) + 0.35, 0.2);
  float n = vnoise(aq * 1.6 + vec2(0.0, t * 3.0)) * 0.65 + vnoise(aq * 3.4 + 7.3) * 0.35;
  float band = smoothstep(0.52, 0.95, n) * exp(-abs(rd.y - 0.30) * 2.6);
  c += GREEN * band * 0.05 + MINT * band * 0.02;
  return c;
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uProgress;
  float z = 2.0 + t * 34.0;
  vec3 ro = vec3(spine(z), z);
  ro.y += 0.35;
  float z2 = z + 6.5;
  vec3 ta = vec3(spine(z2), z2);
  vec3 fw = normalize(ta - ro);
  vec3 up0 = vec3(sin(t * 3.14159) * 0.10, 1.0, 0.0);
  vec3 rt = normalize(cross(fw, up0));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(fw * 1.45 + uv.x * rt + uv.y * up);
  vec3 acc = vec3(0.0);
  vec3 p = ro;
  float travel = 0.0;
  float id = 0.0;
  int steps = int(uQuality);
  for (int i = 0; i < 90; i++) {
    if (i >= steps) break;
    vec2 hit = mapScene(p);
    float dR = length(p.xy - spine(p.z)) - 0.05;
    acc += GREEN * exp(-max(dR, 0.0) * 26.0) * 0.55;
    acc += GREEN * exp(-max(dR, 0.0) * 6.5) * 0.045;
    if (hit.x < 0.001 + travel * 0.0022) { id = hit.y; break; }
    float dst = max(hit.x * 0.9, 0.012 + travel * 0.006);
    p += rd * dst;
    travel += dst;
    if (travel > 60.0) break;
  }
  vec3 col;
  if (id > 0.5 && travel < 60.0) {
    vec3 n = calcNormal(p);
    vec3 kp = vec3(spine(p.z), p.z);
    vec3 L = normalize(kp - p);
    float dl = max(dot(n, L), 0.0);
    float distL = length(kp - p);
    float atten = 1.0 / (1.0 + 0.18 * distL * distL);
    vec3 albedo;
    float emissive = 0.0;
    if (id > 2.5) {
      vec2 gp = fract(p.xz * 0.5) - 0.5;
      float gw = 0.03 + travel * 0.0035;
      float line = smoothstep(gw, 0.0, min(abs(gp.x), abs(gp.y)));
      albedo = vec3(0.045, 0.055, 0.052);
      emissive = line * exp(-travel * 0.035) * 1.4;
      emissive += exp(-abs(p.x - kp.x) * 0.55) * 0.5 * exp(-travel * 0.02);
    } else if (id > 1.5) {
      albedo = vec3(0.10, 0.115, 0.11);
    } else {
      vec3 cell = floor(p / 7.0);
      vec3 h = hash3(cell);
      albedo = mix(vec3(0.085, 0.10, 0.095), vec3(0.05, 0.06, 0.058), h.y);
      if (h.z > 0.80) emissive = 1.1 + h.y * 0.9;
    }
    float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    col = albedo * (GREEN * dl * atten * 2.2 + vec3(0.05, 0.06, 0.058));
    col += GREEN * emissive + MINT * fres * 0.22;
    col += acc * 0.5;
    col = mix(FOGC, col, exp(-travel * 0.040));
  } else {
    col = sky(rd, t) * 0.9 + acc;
  }
  col *= 1.0 - 0.30 * dot(uv, uv);
  col = 1.0 - exp(-col * 1.6);
  col = pow(col, vec3(0.4545));
  col += (hash1(gl_FragCoord.xy + fract(t) * 17.0) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

function setupVisionWindow() {
  const figure = $('.vision-window');
  if (!figure) return;
  try {
    const canvas = $('canvas', figure);
    const readout = $('[data-vision-readout]', figure);
    const gl = canvas.getContext('webgl', {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
    });
    if (!gl) {
      figure.dataset.vision = 'static';
      return;
    }
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(shader) || 'shader compile failed');
      return shader;
    };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VISION_VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, VISION_SCENE));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(program) || 'program link failed');
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(program, 'uRes');
    const uProgress = gl.getUniformLocation(program, 'uProgress');
    const uQuality = gl.getUniformLocation(program, 'uQuality');
    const software = /swiftshader|software|llvmpipe|basic render/i.test(
      String(gl.getParameter(gl.RENDERER)),
    );
    gl.uniform1f(uQuality, software ? 44 : 90);
    figure.dataset.vision = 'ready';
    let visible = true;
    let frame = 0;
    let lastText = '';
    const draw = () => {
      const rect = figure.getBoundingClientRect();
      const top = figure.offsetTop - scrollY;
      const lead = innerHeight * 0.45;
      const raw = Math.max(0, Math.min(1, (lead - top) / lead));
      const grow = raw * raw * (3 - 2 * raw);
      figure.style.setProperty('--vision-grow', grow.toFixed(4));
      let value = 0.42;
      if (!reducedMotion.matches) {
        const span = innerHeight + rect.height;
        value = Math.max(0, Math.min(1, (innerHeight - rect.top) / span));
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uProgress, value);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const text = 'VIEW ' + String(Math.round(value * 100)).padStart(3, '0');
      if (readout && text !== lastText) {
        readout.textContent = text;
        lastText = text;
      }
    };
    const render = () => {
      frame = 0;
      if (document.hidden || !visible) return;
      try {
        draw();
      } catch {
        visible = false;
        figure.dataset.vision = 'static';
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 1.6);
      const w = Math.max(2, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(2, Math.round(canvas.clientHeight * dpr));
      const budget = software ? 240000 : 940000;
      const scale = Math.min(1, Math.sqrt(budget / (w * h)));
      canvas.width = Math.max(2, Math.round(w * scale));
      canvas.height = Math.max(2, Math.round(h * scale));
      schedule();
    };
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) schedule();
    });
    reducedMotion.addEventListener('change', schedule);
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            visible = entry.isIntersecting;
            if (visible) schedule();
            else if (frame) {
              cancelAnimationFrame(frame);
              frame = 0;
            }
          });
        },
        { rootMargin: '50% 0px' },
      );
      observer.observe(figure);
    }
    resize();
  } catch {
    figure.dataset.vision = 'static';
  }
}

setupDialogs();
setupMenu();
setupActions();
setupTheme();
setupTeam();
setupMotion();
setupHeroMotion();
setupVisionWindow();
setupLightbox();
guardExpiredEvent();
// Recheck on return to an old tab; date passing never fabricates a recap.
addEventListener('pageshow', guardExpiredEvent);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) guardExpiredEvent();
});
