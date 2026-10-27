(() => {
  'use strict';

  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const playBtn = document.getElementById('play');
  const gameBox = document.getElementById('game');
  const replayBtn = document.getElementById('replay');

  const BTN_H = 88;       // alto del botón final
  const BTN_W_MAX = 280;  // ancho máximo del botón final
  const R = 14;           // radio de cada gota
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W, H, dpr, birds, slots, order, rafId, last, phase, mergeT;

  const rand = (a, b) => a + Math.random() * (b - a);
  const ease = t => t * t * (3 - 2 * t);

  function setup() {
    cancelAnimationFrame(rafId);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Posición y tamaño del botón final
    const bw = Math.min(BTN_W_MAX, W - 40);
    const cx = W / 2;
    const cy = H * 0.62;
    playBtn.style.width = bw + 'px';
    playBtn.style.height = BTN_H + 'px';
    playBtn.style.left = (cx - bw / 2) + 'px';
    playBtn.style.top = (cy - BTN_H / 2) + 'px';
    playBtn.classList.remove('show');
    gameBox.hidden = true;

    // Huecos donde se acumularán las gotas (de abajo hacia arriba)
    const cols = Math.max(3, Math.floor((bw - 2 * R) / (1.8 * R)) + 1);
    const rows = 3;
    const dx = (bw - 2 * R) / (cols - 1);
    const dy = (BTN_H - 2 * R) / (rows - 1);
    slots = [];
    for (let r = rows - 1; r >= 0; r--) {
      for (let c = 0; c < cols; c++) {
        slots.push({
          x: cx - bw / 2 + R + c * dx + rand(-2, 2),
          y: cy - BTN_H / 2 + R + r * dy + rand(-2, 2),
        });
      }
    }

    // Pajaritos: uno por hueco
    const maxY = Math.min(H * 0.3, cy - BTN_H / 2 - 60);
    birds = slots.map(() => ({
      x: -rand(20, 500),
      baseY: rand(Math.max(30, maxY - 140), Math.max(60, maxY)),
      speed: rand(90, 150),
      amp: rand(15, 35),
      wave: rand(0, 6.28),
      flap: rand(0, 6.28),
      flapSpeed: rand(10, 16),
      size: rand(10, 15),
      triggerX: rand(W * 0.15, W * 0.85),
      mode: 'fly',   // fly -> morph -> fall -> rest
      morph: 0,
      x0: 0, y: 0, vy: 0,
      slot: null,
    }));
    birds.forEach(b => { b.y = b.baseY; });

    order = 0;
    mergeT = 0;
    phase = 'play';

    if (reduceMotion) {
      playBtn.classList.add('show');
      ctx.clearRect(0, 0, W, H);
      return;
    }
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function update(dt) {
    let resting = 0;
    for (const b of birds) {
      switch (b.mode) {
        case 'fly':
          b.x += b.speed * dt;
          b.wave += dt * 2;
          b.flap += b.flapSpeed * dt;
          b.y = b.baseY + Math.sin(b.wave) * b.amp;
          if (b.x >= b.triggerX) {
            b.mode = 'morph';
            b.slot = slots[order++];
          }
          break;
        case 'morph':
          b.x += b.speed * 0.5 * dt;
          b.flap += b.flapSpeed * dt;
          b.morph = Math.min(1, b.morph + dt / 0.7);
          if (b.morph >= 1) { b.mode = 'fall'; b.vy = 0; }
          break;
        case 'fall':
          b.vy += 1400 * dt;
          b.y += b.vy * dt;
          b.x += (b.slot.x - b.x) * Math.min(1, dt * 4);
          if (b.y >= b.slot.y) {
            b.y = b.slot.y;
            b.vy = -b.vy * 0.35;
            if (Math.abs(b.vy) < 40) {
              b.mode = 'rest';
              b.x = b.slot.x;
            }
          }
          break;
        case 'rest':
          resting++;
          break;
      }
    }
    if (phase === 'play' && resting === birds.length) {
      phase = 'merge';
      mergeT = 0;
    }
    if (phase === 'merge') {
      mergeT = Math.min(1, mergeT + dt / 1.2);
      if (mergeT > 0.55) playBtn.classList.add('show');
      if (mergeT >= 1) phase = 'done';
    }
  }

  function drawBird(b) {
    const k = 1 - b.morph;
    if (k <= 0) return;
    const s = b.size * k;
    const flapY = Math.sin(b.flap) * s * 0.9;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.globalAlpha = k;
    ctx.strokeStyle = '#eaf5ff';
    ctx.fillStyle = '#eaf5ff';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 1.4, -flapY);
    ctx.quadraticCurveTo(-s * 0.6, -flapY - s * 0.5, 0, 0);
    ctx.quadraticCurveTo(s * 0.6, -flapY - s * 0.5, s * 1.4, -flapY);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 1, s * 0.35, s * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawDrop(b, scale, alpha) {
    const r = R * b.morph * scale;
    if (r <= 0.5) return;
    const stretch = b.mode === 'fall' ? 1 + Math.min(0.35, Math.abs(b.vy) / 2500) : 1;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(1 / Math.sqrt(stretch), stretch);
    ctx.globalAlpha = alpha * (b.mode === 'morph' ? b.morph : 1);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
    g.addColorStop(0, 'rgba(235,248,255,0.75)');
    g.addColorStop(0.6, 'rgba(150,205,250,0.35)');
    g.addColorStop(1, 'rgba(110,175,240,0.7)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // brillo
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.22, r * 0.13, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // Al fundirse, las gotas crecen y se desvanecen dentro del botón
    const m = ease(mergeT);
    const scale = 1 + 0.6 * m;
    const alpha = 1 - m;
    if (phase === 'done') return;
    for (const b of birds) {
      drawBird(b);
      drawDrop(b, scale, alpha);
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    if (phase !== 'done') rafId = requestAnimationFrame(frame);
  }

  playBtn.addEventListener('click', () => {
    playBtn.classList.remove('show');
    gameBox.hidden = false;
    document.dispatchEvent(new CustomEvent('game:start'));
  });

  replayBtn.addEventListener('click', setup);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setup, 200);
  });

  setup();
})();
