/* Original pixel sprites, drawn locally. No requests, tracking or saved state. */
(() => {
  'use strict';
  const host = document.querySelector('.manifest-city');
  const canvas = host?.querySelector('canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;
  const stage = host.closest('.hero-mascot');
  const pauseButton = document.querySelector('[data-city-pause]');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const mod = (n, m) => ((n % m) + m) % m;
  const random = seed => {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  let width = 320, height = 115, time = 0, previous = 0, frame = 0;
  let visible = true, userPaused = false, cheerAt = -20, palette;
  let pointerStart = null;
  const font = {
    A: ['010','101','111','101','101'], B: ['110','101','110','101','110'],
    C: ['011','100','100','100','011'], E: ['111','100','110','100','111'],
    I: ['111','010','010','010','111'], L: ['100','100','100','100','111'],
    M: ['101','111','111','101','101'], N: ['101','111','111','111','101'],
    O: ['010','101','101','101','010'], R: ['110','101','110','101','101'],
    S: ['011','100','010','001','110'], T: ['111','010','010','010','010'],
    U: ['101','101','101','101','111'], W: ['101','101','111','111','101'],
    Y: ['101','101','010','010','010'], ' ': ['000','000','000','000','000']
  };
  const placards = [['MY','TABS'], ['MY','RULES'], ['LOCAL'], ['OWN','IT']];
  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function letters(value, x, y, color) {
    [...value].forEach((letter, i) => {
      (font[letter] || font[' ']).forEach((row, dy) => {
        [...row].forEach((pixel, dx) => { if (pixel === '1') rect(x + i * 4 + dx, y + dy, 1, 1, color); });
      });
    });
  }
  function theme() {
    palette = root.dataset.theme === 'light' ? {
      building: '#ececef', roof: '#d0d0d7', window: '#d0d0d7', lit: '#a7a0bc',
      road: '#e0e0e5', stripe: '#d3d3da', shadow: '#dadbe0',
      fur: ['#656674','#8b8b97','#53545e','#a7a6ae'], ear: '#d2bac7',
      ink: '#17171b', face: '#ececf2', pole: '#777583',
      accents: ['#ac8cdd','#77b59a','#d1bb71','#929cbb'],
      sign: '#e9def8', signInk: '#4c386b', cloud: '#e7e7ec'
    } : {
      building: '#27272c', roof: '#404047', window: '#44444d', lit: '#7a6c91',
      road: '#333338', stripe: '#424249', shadow: '#151518',
      fur: ['#d7d6df','#aaa9b7','#ede7e1','#95949f'], ear: '#bd94b1',
      ink: '#202025', face: '#32323b', pole: '#a7a4b3',
      accents: ['#bd96f4','#8ad3ae','#e3d187','#8dabc9'],
      sign: '#b99ae3', signInk: '#25202e', cloud: '#38383e'
    };
    draw();
  }
  function cloud(x, y, small = false) {
    rect(x + 5, y, small ? 9 : 14, 2, palette.cloud);
    rect(x, y + 2, small ? 21 : 30, 3, palette.cloud);
    rect(x + 3, y + 5, small ? 15 : 23, 1, palette.cloud);
  }
  function skyline() {
    const ground = Math.round(height * .57);
    const span = 36;
    for (let i = -1; i <= Math.ceil(width / span); i++) {
      const seed = i + 11, x = i * span + 3;
      const w = 21 + Math.floor(random(seed) * 11);
      const h = 23 + Math.floor(random(seed + 80) * 25);
      const y = ground - h;
      rect(x, y, w, h, palette.building);
      rect(x - 1, y, w + 2, 2, palette.roof);
      if (i % 3 === 0) {
        rect(x + w - 8, y - 6, 5, 6, palette.building);
        rect(x + w - 6, y - 11, 1, 6, palette.roof);
      }
      for (let wx = 4; wx < w - 3; wx += 7) {
        for (let wy = 7; wy < h - 6; wy += 9) {
          const glow = random(seed * 9 + wx + wy) > .81;
          rect(x + wx, y + wy, 3, 4, glow ? palette.lit : palette.window);
        }
      }
      rect(x + Math.floor(w / 2) - 2, ground - 8, 5, 8, palette.roof);
      if (i % 4 === 1) {
        rect(x + 3, ground - 14, w - 6, 3, palette.accents[1]);
        rect(x + 3, ground - 14, w - 6, 1, palette.roof);
      }
    }
    for (let lane = 0; lane < 3; lane++) {
      const floor = Math.round(height * [.62, .81, .99][lane]);
      rect(0, floor, width, 1, palette.road);
      if (lane < 2) for (let x = 6; x < width; x += 20) rect(x, floor + 3, 5, 1, palette.stripe);
    }
  }
  function sign(x, y, style, phase) {
    const words = placards[style % placards.length];
    const w = Math.max(...words.map(word => word.length)) * 4 + 5;
    const h = words.length === 1 ? 10 : 16;
    const sway = Math.sin(phase) > .4 ? 1 : 0;
    rect(x + 1, y + h - 1, 1, 13, palette.pole);
    rect(x - w / 2 + sway, y, w, h, palette.signInk);
    rect(x - w / 2 + 1 + sway, y + 1, w - 2, h - 2, palette.sign);
    words.forEach((word, row) => letters(word, Math.round(x - (word.length * 4 - 1) / 2) + sway, y + 3 + row * 6, palette.signInk));
  }
  function mouse(x, floor, seed, lane) {
    const phase = time * (4 + random(seed) * 2) + seed;
    const march = Math.floor(phase) % 2;
    const rally = time - cheerAt < 2.6;
    const jump = rally ? Math.max(0, Math.round(Math.sin((time - cheerAt) * 9 + seed) * 4)) : 0;
    const bob = march && lane > 0 ? 1 : 0;
    const y = Math.round(floor - 17 - bob - jump);
    const fur = palette.fur[seed % palette.fur.length];
    const shirt = palette.accents[seed % palette.accents.length];
    const hasSign = seed % 4 === 0;
    const wave = seed % 5 === 0 || rally;
    rect(x + 1, floor - 1, 12, 1, palette.shadow);
    // Tail, legs and shirt. Walking alternates only whole pixels.
    rect(x + 11, y + 12, 3, 1, fur);
    rect(x + 13, y + 9 + march, 1, 4 - march, fur);
    rect(x + 4 - march, y + 15, 2, 2, fur);
    rect(x + 8 + march, y + 15, 2, 2, fur);
    rect(x + 3, y + 10, 8, 5, shirt);
    rect(x + 4, y + 15, 6, 1, palette.ink);
    rect(x + 1, y + 10, 2, 4, fur);
    rect(x + 11, y + (wave ? 7 : 11), 2, wave ? 5 : 3, fur);
    if (wave) rect(x + 12, y + 6 - march, 2, 2, fur);
    // Large square ears, muzzle, eyes and one-pixel nose.
    rect(x, y + 1, 5, 5, fur);
    rect(x + 9, y + 1, 5, 5, fur);
    rect(x + 1, y + 2, 3, 2, palette.ear);
    rect(x + 10, y + 2, 3, 2, palette.ear);
    rect(x + 3, y + 4, 8, 5, fur);
    rect(x + 4, y + 9, 6, 2, fur);
    rect(x + 4, y + 6, 1, 1, palette.ink);
    rect(x + 9, y + 6, 1, 1, palette.ink);
    rect(x + 6, y + 8, 2, 1, palette.ink);
    // Small wardrobe differences keep each character recognisable.
    if (seed % 6 === 0) {
      rect(x + 3, y - 1, 8, 2, shirt);
      rect(x + 2, y + 1, 11, 1, shirt);
    } else if (seed % 6 === 1) {
      rect(x + 3, y + 5, 3, 3, palette.ink);
      rect(x + 8, y + 5, 3, 3, palette.ink);
      rect(x + 6, y + 6, 2, 1, palette.ink);
      rect(x + 4, y + 6, 1, 1, palette.face);
      rect(x + 9, y + 6, 1, 1, palette.face);
    } else if (seed % 6 === 2) {
      rect(x + 3, y + 9, 8, 2, shirt);
      rect(x + 9, y + 11, 2, 3, shirt);
    }
    if (seed % 7 === 0) rect(x + 6, y + 12, 2, 2, palette.fur[2]);
    if (hasSign) sign(x - 3, y - 11, Math.floor(seed / 4), phase * .6);
  }
  function spark(x, y, color) {
    rect(x + 1, y, 1, 3, color);
    rect(x, y + 1, 3, 1, color);
  }
  function draw() {
    if (!palette || width < 1) return;
    ctx.clearRect(0, 0, width, height);
    cloud(mod(time * 1.4 + 14, width + 35) - 30, 12, true);
    cloud(mod(time * .9 + width * .7, width + 40) - 35, 6);
    skyline();
    for (let lane = 0; lane < 3; lane++) {
      const count = Math.max(7, Math.min(15, Math.round(width / 30)));
      const floor = Math.round(height * [.62, .81, .99][lane]);
      for (let i = 0; i < count; i++) {
        const seed = i + lane * 17 + 1;
        const position = i * (width + 36) / count + lane * 11;
        const x = mod(position + time * [2.5, -3.5, 4.5][lane], width + 36) - 18;
        mouse(Math.round(x), floor, seed, lane);
      }
    }
    const elapsed = time - cheerAt;
    if (elapsed >= 0 && elapsed < 2.6) {
      for (let i = 0; i < 18; i++) {
        const x = width * random(i + 61);
        const y = height * .45 - elapsed * 10 + Math.sin(i) * 9;
        if (Math.floor(elapsed * 7 + i) % 3 !== 0) spark(x, y, palette.accents[i % 4]);
      }
    }
  }
  const paused = () => userPaused || motion.matches;
  const running = () => visible && !document.hidden && !paused();
  function tick(now) {
    frame = 0;
    if (!running()) { previous = 0; return; }
    if (!previous) previous = now;
    const elapsed = now - previous;
    if (elapsed >= 50) {
      time += Math.min(elapsed, 100) / 1000;
      previous = now;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function update() {
    if (!running() && frame) { cancelAnimationFrame(frame); frame = 0; previous = 0; }
    if (running() && !frame) frame = requestAnimationFrame(tick);
    if (pauseButton) {
      pauseButton.setAttribute('aria-pressed', String(paused()));
      pauseButton.dataset.cityReducedMotion = String(motion.matches);
      pauseButton.disabled = motion.matches;
    }
    host.dataset.paused = String(paused());
    document.dispatchEvent(new CustomEvent('mouse:city-state', { detail: { paused: paused(), reducedMotion: motion.matches } }));
    draw();
  }
  function resize() {
    const bounds = host.getBoundingClientRect();
    width = Math.max(1, Math.ceil(bounds.width / 2));
    height = Math.max(1, Math.ceil(bounds.height / 2));
    canvas.width = width; canvas.height = height;
    canvas.style.width = width * 2 + 'px'; canvas.style.height = height * 2 + 'px';
    ctx.imageSmoothingEnabled = false;
    draw();
  }
  pauseButton?.addEventListener('click', () => {
    // A system request for reduced motion is always respected.
    if (motion.matches) return;
    userPaused = !userPaused;
    update();
  });
  stage?.addEventListener('pointerdown', event => { pointerStart = [event.clientX, event.clientY]; });
  stage?.addEventListener('pointercancel', () => { pointerStart = null; });
  stage?.addEventListener('pointerup', event => {
    if (pointerStart && Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) < 8 && !event.target.closest('button,a') && !paused()) cheerAt = time;
    pointerStart = null;
  });
  document.addEventListener('visibilitychange', update);
  if (motion.addEventListener) motion.addEventListener('change', update); else motion.addListener(update);
  new MutationObserver(theme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(host); else window.addEventListener('resize', resize);
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting; update();
  }, { rootMargin: '40px' }).observe(host);
  theme(); resize(); update();
})();
