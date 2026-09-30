/* zkBricks — hero: an isometric field of brick stacks.
 *
 * The field assembles on load, breathes, and lifts under the cursor. Every few
 * seconds it plays out t-of-n threshold decryption: t random stacks light up,
 * send their shares to a stationary floating box, and its two top flaps open.
 */
(function () {
  'use strict';

  var canvas = document.querySelector('[data-bricks]');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var N = 9;              // grid is N x N
  var FOOT = 0.72;        // brick footprint within its cell
  var LAYER = 0.42;       // height of one brick course, in cell units
  var T = 3;              // threshold: how many shares unlock the secret
  var C30 = Math.cos(Math.PI / 6);
  var center = (N - 1) / 2;
  // Independent of the field: neither breathing nor pointer lift moves this box.
  var box = { x: center + 0.5, y: center + 0.5, bottom: 5.8, size: 1.1 };

  var W = 0, H = 0, dpr = 1, unit = 0, ox = 0, oy = 0;
  var colors = {};
  var cells = [];
  var mouse = { x: -1e4, y: -1e4, gx: -99, gy: -99, active: false };
  var t0 = performance.now();
  var running = false, visible = true, rafId = null;
  var sceneEnabled = !canvas.closest('[hidden]'), motionPaused = false, stoppedAt = null;
  function visualNow() { return stoppedAt === null ? performance.now() : stoppedAt; }

  function hash(i, j) {
    var s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  // Stepped pyramid with some irregularity: reads as a hand-laid structure.
  for (var i = 0; i < N; i++) {
    for (var j = 0; j < N; j++) {
      var d = Math.max(Math.abs(i - center), Math.abs(j - center));
      var r = Math.hypot(i - center, j - center);
      var base = Math.max(0, 5.2 - d * 1.05 - r * 0.15 + (hash(i, j) - 0.5) * 1.6);
      cells.push({
        i: i, j: j,
        base: Math.round(base),
        h: 0,
        lift: 0,
        delay: r * 70 + hash(j, i) * 260,
        glow: 0
      });
    }
  }
  cells.sort(function (a, b) { return (a.i + a.j) - (b.i + b.j) || a.i - b.i; });

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    colors.background = cs.getPropertyValue('--paper').trim() || '#fff';
    colors.paper = cs.getPropertyValue('--brick-top').trim() || 'rgba(70, 101, 197, 0.14)';
    colors.paper2 = cs.getPropertyValue('--brick-left').trim() || 'rgba(70, 101, 197, 0.09)';
    colors.paper3 = cs.getPropertyValue('--brick-right').trim() || 'rgba(70, 101, 197, 0.05)';
    colors.ink = cs.getPropertyValue('--ink').trim() || '#121211';
    colors.outline = cs.getPropertyValue('--brick-outline').trim() || colors.ink;
    colors.muted = cs.getPropertyValue('--muted').trim() || '#75716a';
    colors.accent = cs.getPropertyValue('--accent').trim() || '#4665c5';
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Fit the field and fully opened flaps, leaving the same margin on resize.
    var top = box.x - box.bottom - box.size * 2;
    unit = Math.min((W * 0.92) / (2 * N * C30), (H * 0.86) / (N - top));
    ox = W * 0.52;
    oy = H * 0.5 - (N + top) * unit / 2;
    if (!running) draw(visualNow());
  }

  function P(x, y, z) {
    return [ox + (x - y) * C30 * unit, oy + (x + y) * 0.5 * unit - z * unit];
  }

  function poly(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.closePath();
  }

  // Lay translucent pigment over the page color so hidden edges stay hidden.
  function fillFace(fill) {
    ctx.fillStyle = colors.background; ctx.fill();
    ctx.fillStyle = fill; ctx.fill();
  }

  function drawStack(c) {
    var pad = (1 - FOOT) / 2;
    var x0 = c.i + pad, x1 = c.i + 1 - pad;
    var y0 = c.j + pad, y1 = c.j + 1 - pad;
    var z1 = Math.max(0, c.h) * LAYER;

    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';

    if (z1 < 0.02) {
      // Empty lot: a faint footprint.
      poly([P(x0, y0, 0), P(x1, y0, 0), P(x1, y1, 0), P(x0, y1, 0)]);
      ctx.strokeStyle = colors.muted;
      ctx.globalAlpha = 0.35;
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }

    var A = P(x0, y0, z1), B = P(x1, y0, z1), Cc = P(x1, y1, z1), D = P(x0, y1, z1);
    var E = P(x1, y0, 0), F = P(x1, y1, 0), G = P(x0, y1, 0);

    // Faces
    poly([D, Cc, F, G]);
    fillFace(colors.paper2);
    poly([B, E, F, Cc]);
    fillFace(colors.paper3);
    poly([A, B, Cc, D]);
    fillFace(colors.paper);
    if (c.glow > 0.01) {
      ctx.globalAlpha = c.glow;
      ctx.fillStyle = colors.accent;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Outline
    ctx.strokeStyle = colors.outline;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(Cc[0], Cc[1]); ctx.lineTo(D[0], D[1]); ctx.closePath();
    ctx.moveTo(B[0], B[1]); ctx.lineTo(E[0], E[1]); ctx.lineTo(F[0], F[1]); ctx.lineTo(Cc[0], Cc[1]);
    ctx.moveTo(D[0], D[1]); ctx.lineTo(G[0], G[1]); ctx.lineTo(F[0], F[1]);
    ctx.stroke();

  }

  function topCenter(c) {
    return P(c.i + 0.5, c.j + 0.5, Math.max(0, c.h) * LAYER);
  }

  function keyholeCenter() {
    return P(box.x, box.y + box.size / 2, box.bottom + box.size * 0.52);
  }

  function drawBox() {
    var x0 = box.x - box.size / 2, x1 = box.x + box.size / 2;
    var y0 = box.y - box.size / 2, y1 = box.y + box.size / 2;
    var z0 = box.bottom, z1 = z0 + box.size;
    var A = P(x0, y0, z1), B = P(x1, y0, z1);
    var C = P(x1, y1, z1), D = P(x0, y1, z1);
    // Each lid is hinged to a rim edge. Only the lids rotate; the body stays put.
    var angle = keyOpen * Math.PI * 0.92;
    var reach = Math.cos(angle) * box.size / 2;
    var rise = Math.sin(angle) * box.size / 2;
    function face(points, fill) {
      poly(points);
      fillFace(fill);
      ctx.stroke();
    }
    ctx.save();
    ctx.strokeStyle = colors.outline;
    ctx.lineWidth = 1.25;
    ctx.lineJoin = 'round';

    face([A, B, C, D], colors.ink);
    // The accent interior becomes visible as the lids separate.
    ctx.save();
    ctx.globalAlpha = keyOpen * 0.75;
    poly([A, B, C, D]);
    ctx.fillStyle = colors.accent;
    ctx.fill();
    ctx.restore();
    // The far lid covers one half of the opening when closed.
    face([A, D, P(x0 + reach, y1, z1 + rise), P(x0 + reach, y0, z1 + rise)], colors.paper2);
    face([D, C, P(x1, y1, z0), P(x0, y1, z0)], colors.paper2);
    face([B, P(x1, y0, z0), P(x1, y1, z0), C], colors.paper3);
    // The opposing lid covers the other half; both swing out on fixed hinges.
    face([B, C, P(x1 - reach, y1, z1 + rise), P(x1 - reach, y0, z1 + rise)], colors.paper);

    // Keyhole on the front wall: its position is also the fixed share destination.
    var key = keyholeCenter();
    ctx.translate(key[0], key[1]);
    ctx.transform(C30, 0.5, 0, 1, 0, 0);
    var r = box.size * unit * 0.065;
    ctx.beginPath();
    ctx.arc(0, -r * 0.6, r, 0, Math.PI * 2);
    ctx.moveTo(-r * 0.45, 0);
    ctx.lineTo(r * 0.45, 0);
    ctx.lineTo(r * 0.8, r * 1.9);
    ctx.lineTo(-r * 0.8, r * 1.9);
    ctx.closePath();
    ctx.fillStyle = keyOpen > 0 ? colors.accent : colors.ink;
    ctx.fill();
    ctx.restore();
  }

  // ----- Threshold ceremony -----
  var ceremony = null;  // { start, shares: [cells] }
  var keyOpen = 0;
  var nextCeremony = 2600;

  function startCeremony(now) {
    var pool = cells.filter(function (c) {
      return c.base >= 1 && Math.abs(c.i - center) + Math.abs(c.j - center) >= 3;
    });
    var shares = [];
    while (shares.length < T && pool.length) {
      var k = (Math.random() * pool.length) | 0;
      var pick = pool.splice(k, 1)[0];
      // Spread shares out: skip neighbours of already-picked stacks.
      if (shares.every(function (s) { return Math.abs(s.i - pick.i) + Math.abs(s.j - pick.j) > 2; })) shares.push(pick);
    }
    ceremony = { start: now, shares: shares };
  }

  // Phases (ms): light shares, travel, unlock, hold, fade.
  var PH = { light: 500, travel: 1100, unlock: 850, hold: 1700, fade: 900 };
  var SHARE_STAGGER = 125;
  var PH_TOTAL = PH.light + PH.travel + PH.unlock + PH.hold + PH.fade;

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function drawCeremonyLines(now) {
    if (!ceremony) return;
    var e = now - ceremony.start;
    var travel = clamp((e - PH.light) / PH.travel);
    var fade = 1 - clamp((e - (PH_TOTAL - PH.fade)) / PH.fade);
    if (travel <= 0) return;
    var target = keyholeCenter();
    ctx.save();
    ctx.strokeStyle = colors.accent;
    ctx.fillStyle = colors.accent;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = fade;
    ceremony.shares.forEach(function (s, idx) {
      // All T paths reach the keyhole before the unlock phase begins.
      var duration = PH.travel - (T - 1) * SHARE_STAGGER;
      var tt = ease(clamp((e - PH.light - idx * SHARE_STAGGER) / duration));
      if (tt <= 0) return;
      var from = topCenter(s);
      // Arc upward so the share visibly travels over the structure.
      var cx = (from[0] + target[0]) / 2;
      var cy = Math.min(from[1], target[1]) - unit * 1.6;
      ctx.beginPath();
      var steps = 28;
      for (var k = 0; k <= steps; k++) {
        var u = tt * k / steps;
        var x = (1 - u) * (1 - u) * from[0] + 2 * (1 - u) * u * cx + u * u * target[0];
        var y = (1 - u) * (1 - u) * from[1] + 2 * (1 - u) * u * cy + u * u * target[1];
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      if (tt < 1) {
        var hx = (1 - tt) * (1 - tt) * from[0] + 2 * (1 - tt) * tt * cx + tt * tt * target[0];
        var hy = (1 - tt) * (1 - tt) * from[1] + 2 * (1 - tt) * tt * cy + tt * tt * target[1];
        ctx.beginPath();
        ctx.arc(hx, hy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(from[0], from[1], 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function update(now) {
    var t = (now - t0) / 1000;

    // Ceremony timing
    if (!reduceMotion && !ceremony && now - t0 > nextCeremony) startCeremony(now);
    var e = ceremony ? now - ceremony.start : 0;
    if (ceremony && e > PH_TOTAL) {
      ceremony = null;
      nextCeremony = now - t0 + 2200 + Math.random() * 1800;
    }
    var shareGlow = ceremony ? Math.min(clamp(e / PH.light), 1 - clamp((e - (PH_TOTAL - PH.fade)) / PH.fade)) : 0;
    var unlockAt = PH.light + PH.travel;
    keyOpen = reduceMotion ? 1 : ceremony ? ease(Math.min(clamp((e - unlockAt) / PH.unlock), 1 - clamp((e - (PH_TOTAL - PH.fade)) / PH.fade))) : 0;

    for (var k = 0; k < cells.length; k++) {
      var c = cells[k];
      // Build-in: each stack rises into place after its delay.
      var grow = reduceMotion ? 1 : ease(clamp((now - t0 - c.delay) / 900));
      var breathe = reduceMotion ? 0 : Math.sin(t * 0.9 + (c.i + c.j) * 0.55) * 0.35;
      var d2 = (c.i + 0.5 - mouse.gx) * (c.i + 0.5 - mouse.gx) + (c.j + 0.5 - mouse.gy) * (c.j + 0.5 - mouse.gy);
      var targetLift = !reduceMotion && mouse.active ? 2.4 * Math.exp(-d2 / 2.2) : 0;
      c.lift += (targetLift - c.lift) * 0.12;
      var isShare = ceremony && ceremony.shares.indexOf(c) !== -1;
      var shareLift = isShare ? shareGlow * 0.8 : 0;
      c.h = (c.base + breathe * (c.base > 0 ? 1 : 0.4)) * grow + c.lift + shareLift;
      c.glow = isShare ? shareGlow * 0.9 : 0;
    }
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    for (var k = 0; k < cells.length; k++) drawStack(cells[k]);
    drawBox();
    drawCeremonyLines(now);
  }

  function frame(now) {
    update(now);
    draw(now);
    rafId = running ? requestAnimationFrame(frame) : null;
  }

  function start() {
    if (running || reduceMotion || motionPaused || !sceneEnabled) return;
    if (stoppedAt !== null) {
      var elapsed = performance.now() - stoppedAt;
      t0 += elapsed;
      if (ceremony) ceremony.start += elapsed;
      stoppedAt = null;
    }
    running = true;
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    if (running) stoppedAt = performance.now();
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  window.addEventListener('herofigurechange', function (e) {
    var state = e.detail;
    sceneEnabled = state.active === 'threshold';
    motionPaused = state.paused;
    reduceMotion = state.reduceMotion;
    if (!sceneEnabled) { stop(); return; }
    if (state.reset) {
      t0 = performance.now();
      stoppedAt = null;
      ceremony = null;
      nextCeremony = 2600;
      mouse.active = false;
      cells.forEach(function (c) { c.h = 0; c.lift = 0; c.glow = 0; });
    }
    if (motionPaused || reduceMotion) stop();
    resize();
    if (state.reset || reduceMotion) {
      // A paused or reduced-motion scene still conveys the completed outcome.
      var saved = reduceMotion;
      if (motionPaused) reduceMotion = true;
      if (reduceMotion) {
        stoppedAt = visualNow();
        startCeremony(stoppedAt - PH.light - PH.travel - PH.unlock);
      }
      update(visualNow());
      reduceMotion = saved;
    }
    draw(visualNow());
    if (visible && !document.hidden) start();
  });

  // Pointer → grid coordinates (inverse isometric projection on the ground plane,
  // raised a little so the lift follows the tops of the stacks).
  window.addEventListener('pointermove', function (e) {
    if (!sceneEnabled || motionPaused || !unit) return;
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (x < -40 || y < -40 || x > rect.width + 40 || y > rect.height + 40) { mouse.active = false; return; }
    var sx = (x - ox) / (C30 * unit);
    var sy = (y - oy + 2.2 * LAYER * unit) / (0.5 * unit);
    mouse.gx = (sx + sy) / 2;
    mouse.gy = (sy - sx) / 2;
    mouse.active = true;
  }, { passive: true });
  document.addEventListener('pointerleave', function () { mouse.active = false; });

  window.addEventListener('themechange', function () {
    // Custom properties update on the next style recalc.
    requestAnimationFrame(function () { readColors(); if (!running) draw(visualNow()); });
  });
  window.addEventListener('resize', resize);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && !document.hidden) start(); else stop();
    }).observe(canvas);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (visible) start();
  });

  readColors();
  resize();
  if (reduceMotion) {
    // A single still: the unlocked state.
    var stillTime = performance.now();
    stoppedAt = stillTime;
    startCeremony(stillTime - PH.light - PH.travel - PH.unlock);
    update(stillTime);
    draw(stillTime);
  } else {
    start();
  }
})();
