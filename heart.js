/**
 * Three-Phase Heart Animation
 * Phase 1: Starlight convergence + typing text (~6s)
 * Phase 2: Slow rotation + color transition to rose + text heartbeat (~20s)
 * Phase 3: Petal explosion + falling rose petals + couple silhouette (~8s)
 */

(function () {
  'use strict';

  const canvas = document.getElementById('heartCanvas');
  const ctx = canvas.getContext('2d');

  // --- Configuration ---
  const CONFIG = {
    surfaceParticleCount: 2000,
    innerParticleCount: 1000,
    driftSpeed: 0.04,
    driftAmplitude: 1,
    twinkleSpeed: 0.012,
    twinkleRange: [0.5, 1.0],
    glowSize: 5,
    heartbeatSpeed: 0.0008,
    scatterRadius: 35,
    scatterRecover: 30,
    heartScale: 12,
    focalLength: 400,
    rotationSpeed: 0.00005,

    // Phase timings (in frames at 60fps)
    convergenceDuration: 360,    // Phase 1: ~6s
    phase2Duration: 1200,        // Phase 2: ~20s
    phase3Duration: 480,         // Phase 3: ~8s

    // Original color palette (Phase 1)
    colorStops: [
      { r: 80,  g: 50,  b: 180 },
      { r: 160, g: 40,  b: 160 },
      { r: 220, g: 60,  b: 130 },
      { r: 255, g: 100, b: 140 },
      { r: 180, g: 50,  b: 170 },
    ],
  };

  // --- Rose color palette for Phase 2 ---
  const ROSE_COLORS = [
    { r: 200, g: 40,  b: 100 },
    { r: 230, g: 60,  b: 120 },
    { r: 255, g: 90,  b: 140 },
    { r: 255, g: 120, b: 160 },
    { r: 180, g: 30,  b: 90  },
  ];

  // --- Phase tracking ---
  let currentPhase = 0; // 0=converging, 1=rotating, 2=exploding
  let phaseTime = 0;
  let convergenceProgress = 0;
  let colorTransitionProgress = 0;
  let explosionProgress = 0;

  // --- Drag interaction state ---
  let isDragging = false;
  let dragStartX = 0;
  let dragRotationX = 0;
  let dragVelocity = 0;

  // --- Easing functions ---
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOutCubic(t) { return t < 0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }
  function easeOutQuad(t) { return 1 - (1-t)*(1-t); }

  // --- Color utility ---
  function lerpColor(colors, t) {
    t = Math.max(0, Math.min(1, t));
    const idx = t * (colors.length - 1);
    const i = Math.floor(idx);
    const frac = idx - i;
    if (i >= colors.length - 1) return colors[colors.length - 1];
    const c1 = colors[i], c2 = colors[i + 1];
    return {
      r: Math.round(c1.r + (c2.r - c1.r) * frac),
      g: Math.round(c1.g + (c2.g - c1.g) * frac),
      b: Math.round(c1.b + (c2.b - c1.b) * frac),
    };
  }

  function lerpColorObj(c1, c2, t) {
    return {
      r: Math.round(c1.r + (c2.r - c1.r) * t),
      g: Math.round(c1.g + (c2.g - c1.g) * t),
      b: Math.round(c1.b + (c2.b - c1.b) * t),
    };
  }

  function colorStr(c, alpha) { return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`; }

  // --- 3D heart parametric equation ---
  function heartPosition3D(t, u) {
    const sinT = Math.sin(t), cosT = Math.cos(t);
    const sinU = Math.sin(u), cosU = Math.cos(u);
    return {
      x: 16 * Math.pow(sinT, 3) * sinU,
      y: -(13 * cosT - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) * Math.pow(sinU, 2),
      z: (12 * cosU + 3 * Math.cos(2*u) + 2 * Math.cos(3*u)),
    };
  }

  // --- 3D rotation ---
  function rotateY(x, y, z, angle) {
    const cosA = Math.cos(angle), sinA = Math.sin(angle);
    return { x: x*cosA + z*sinA, y: y, z: -x*sinA + z*cosA };
  }
  function rotateX(x, y, z, angle) {
    const cosA = Math.cos(angle), sinA = Math.sin(angle);
    return { x: x, y: y*cosA - z*sinA, z: y*sinA + z*cosA };
  }

  // --- Perspective projection ---
  function project(x, y, z) {
    const scale = Math.max(0.1, CONFIG.focalLength / (CONFIG.focalLength + z));
    return { sx: x*scale, sy: y*scale, scale: scale };
  }

  // --- Heartbeat detection ---
  let scatterFactor = 0, scatterFrame = 0, recovering = false;

  function heartbeatState(time) {
    const t = (time * CONFIG.heartbeatSpeed) % (Math.PI * 2);
    const beat1 = Math.exp(-3 * Math.pow(Math.sin(t * 0.5), 2));
    const beat2 = Math.exp(-5 * Math.pow(Math.sin((t - Math.PI * 0.4) * 0.5), 2)) * 0.6;
    const intensity = beat1 + beat2;
    if (intensity > 0.5 && !recovering) {
      scatterFactor = 1.0; scatterFrame = 0; recovering = true;
    }
    if (recovering) {
      scatterFrame++;
      scatterFactor = 1.0 - (scatterFrame / CONFIG.scatterRecover);
      if (scatterFrame >= CONFIG.scatterRecover) { scatterFactor = 0; recovering = false; }
    }
    return { intensity, scatter: scatterFactor };
  }

  // --- Resize handling ---
  let width, height, centerX, centerY, heartSize;
  let particles = [];
  let stars = [];
  let rotationAngle = 0;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    centerX = width / 2;
    centerY = height / 2;
    heartSize = Math.min(width, height) * 0.35;

    particles.length = 0;
    for (let i = 0; i < CONFIG.surfaceParticleCount; i++) particles.push(new HeartParticle());
    for (let i = 0; i < CONFIG.innerParticleCount; i++) particles.push(new InnerParticle());
    stars.length = 0;
    for (let i = 0; i < 80; i++) stars.push(new Star());
  }

  let resizeTimeout;
  window.addEventListener('resize', () => { clearTimeout(resizeTimeout); resizeTimeout = setTimeout(resize, 200); });

  // --- Mouse/touch drag ---
  canvas.addEventListener('mousedown', (e) => { isDragging = true; dragStartX = e.clientX; });
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    dragVelocity = dx * 0.005;
    rotationAngle += dx * 0.005;
    dragRotationX += dx * 0.003;
    dragStartX = e.clientX;
  });
  window.addEventListener('mouseup', () => { isDragging = false; });
  canvas.addEventListener('touchstart', (e) => { isDragging = true; dragStartX = e.touches[0].clientX; e.preventDefault(); }, { passive: false });
  window.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const dx = e.touches[0].clientX - dragStartX;
    dragVelocity = dx * 0.005;
    rotationAngle += dx * 0.005;
    dragRotationX += dx * 0.003;
    dragStartX = e.touches[0].clientX;
    e.preventDefault();
  }, { passive: false });
  window.addEventListener('touchend', () => { isDragging = false; });

  // --- Particle classes ---
  class HeartParticle {
    constructor() { this.reset(); }
    reset() {
      const t = Math.random() * Math.PI * 2, u = Math.random() * Math.PI;
      const pos = heartPosition3D(t, u);
      const offset = (Math.random() - 0.5) * 0.15;
      const sc = heartSize / CONFIG.heartScale;
      this.targetX = pos.x * sc * (1 + offset);
      this.targetY = pos.y * sc * (1 + offset);
      this.targetZ = pos.z * sc * (1 + offset);
      this.x = this.targetX; this.y = this.targetY; this.z = this.targetZ;

      this.driftPhase = Math.random() * Math.PI * 2;
      this.driftAngle = Math.random() * Math.PI * 2;
      this.twinklePhase = Math.random() * Math.PI * 2;
      this.twinkleSpeed = CONFIG.twinkleSpeed * (0.5 + Math.random());

      const colorT = (Math.atan2(this.targetY, this.targetX) / (Math.PI * 2) + 1) % 1;
      this.origColor = lerpColor(CONFIG.colorStops, colorT);
      this.roseColor = lerpColor(ROSE_COLORS, Math.random());
      this.color = { ...this.origColor };
      this.size = 1.2 + Math.random() * 2.8;

      const dist = Math.sqrt(this.targetX*this.targetX + this.targetY*this.targetY + this.targetZ*this.targetZ);
      if (dist > 0) { this.scatterVx = this.targetX/dist; this.scatterVy = this.targetY/dist; this.scatterVz = this.targetZ/dist; }
      else { this.scatterVx = 0; this.scatterVy = 0; this.scatterVz = 1; }

      this.scatteredX = (Math.random() - 0.5) * width * 2;
      this.scatteredY = (Math.random() - 0.5) * height * 2;
      this.scatteredZ = (Math.random() - 0.5) * 200;

      // For explosion: random velocity outward
      this.explodeVx = (Math.random() - 0.5) * 4;
      this.explodeVy = (Math.random() - 0.5) * 4 - 2; // bias upward
      this.explodeVz = (Math.random() - 0.5) * 2;
    }

    update(time, scatter, convProgress, explodeProgress) {
      if (explodeProgress > 0) {
        // Instant explosion: fly outward fast then slow down
        const t = explodeProgress;
        this.x = this.targetX + this.explodeVx * t * 300;
        this.y = this.targetY + this.explodeVy * t * 300 - t * t * 400;
        this.z = this.targetZ + this.explodeVz * t * 100;
        return;
      }

      const easedConv = easeOutCubic(convProgress);
      this.x = this.scatteredX + (this.targetX - this.scatteredX) * easedConv;
      this.y = this.scatteredY + (this.targetY - this.scatteredY) * easedConv;
      this.z = this.scatteredZ + (this.targetZ - this.scatteredZ) * easedConv;

      if (convProgress > 0.5) {
        const df = (convProgress - 0.5) * 2;
        this.x += Math.cos(this.driftAngle) * Math.sin(time * CONFIG.driftSpeed + this.driftPhase) * CONFIG.driftAmplitude * df;
        this.y += Math.sin(this.driftAngle) * Math.cos(time * CONFIG.driftSpeed * 0.7 + this.driftPhase) * CONFIG.driftAmplitude * df;
        this.z += Math.cos(this.driftAngle * 0.7) * Math.sin(time * CONFIG.driftSpeed * 0.5 + this.driftPhase + Math.PI) * CONFIG.driftAmplitude * 0.5 * df;
      }

      if (scatter > 0 && convProgress >= 1) {
        this.x += this.scatterVx * CONFIG.scatterRadius * scatter;
        this.y += this.scatterVy * CONFIG.scatterRadius * scatter;
        this.z += this.scatterVz * CONFIG.scatterRadius * scatter * 0.5;
      }
    }

    draw(ctx, time, pulseScale, tiltX, convProgress, colorProgress) {
      const fadeIn = Math.min(1, convProgress * 2);
      if (fadeIn <= 0) return;

      // Color transition: blend from original to rose
      const c = lerpColorObj(this.origColor, this.roseColor, colorProgress);

      const rotated = rotateY(this.x, this.y, this.z, rotationAngle);
      const rx = rotated.x * pulseScale, ry = rotated.y * pulseScale, rz = rotated.z * pulseScale;
      const rotated2 = rotateX(rx, ry, rz, tiltX || 0);
      const sx = rotated2.x, sy = rotated2.y, sz = rotated2.z;
      this.rotatedZ = sz;

      const projected = project(sx, sy, sz);
      const screenX = centerX + projected.sx;
      const screenY = centerY + projected.sy;
      const scaledSize = this.size * projected.scale;

      const twinkle = Math.sin(time * this.twinkleSpeed + this.twinklePhase);
      const alpha = CONFIG.twinkleRange[0] + ((twinkle + 1) / 2) * (CONFIG.twinkleRange[1] - CONFIG.twinkleRange[0]);
      const depthAlpha = 0.4 + 0.6 * ((this.rotatedZ + 100) / 200);
      const finalAlpha = Math.max(0.1, Math.min(1, alpha * depthAlpha)) * fadeIn;

      ctx.beginPath();
      ctx.arc(screenX, screenY, scaledSize, 0, Math.PI * 2);
      ctx.fillStyle = colorStr(c, finalAlpha);
      ctx.fill();

      if (scaledSize > 2) {
        ctx.beginPath();
        ctx.arc(screenX, screenY, scaledSize + CONFIG.glowSize * projected.scale, 0, Math.PI * 2);
        ctx.fillStyle = colorStr(c, finalAlpha * 0.15);
        ctx.fill();
      }
    }
  }

  class InnerParticle {
    constructor() { this.reset(); }
    reset() {
      const t = Math.random() * Math.PI * 2, u = Math.random() * Math.PI;
      const pos = heartPosition3D(t, u);
      const scale = Math.pow(Math.random(), 0.6);
      const sc = heartSize / CONFIG.heartScale;
      this.targetX = pos.x * sc * scale;
      this.targetY = pos.y * sc * scale;
      this.targetZ = pos.z * sc * scale;
      this.x = this.targetX; this.y = this.targetY; this.z = this.targetZ;

      this.driftPhase = Math.random() * Math.PI * 2;
      this.driftAngle = Math.random() * Math.PI * 2;
      this.twinklePhase = Math.random() * Math.PI * 2;
      this.twinkleSpeed = CONFIG.twinkleSpeed * (0.3 + Math.random() * 0.7);

      const innerColorT = Math.random();
      if (innerColorT < 0.33) { this.origColor = { r: 255, g: 120, b: 160 }; }
      else if (innerColorT < 0.66) { this.origColor = { r: 240, g: 80, b: 140 }; }
      else { this.origColor = { r: 220, g: 60, b: 180 }; }
      this.roseColor = { r: 200 + Math.random()*55, g: 40 + Math.random()*40, b: 80 + Math.random()*60 };
      this.color = { ...this.origColor };
      this.size = 0.8 + Math.random() * 1.8;

      const dist = Math.sqrt(this.targetX*this.targetX + this.targetY*this.targetY + this.targetZ*this.targetZ);
      if (dist > 0) { this.scatterVx = this.targetX/dist; this.scatterVy = this.targetY/dist; this.scatterVz = this.targetZ/dist; }
      else { this.scatterVx = 0; this.scatterVy = 0; this.scatterVz = 1; }

      this.scatteredX = (Math.random() - 0.5) * width * 2;
      this.scatteredY = (Math.random() - 0.5) * height * 2;
      this.scatteredZ = (Math.random() - 0.5) * 200;

      this.explodeVx = (Math.random() - 0.5) * 3;
      this.explodeVy = (Math.random() - 0.5) * 3 - 1;
      this.explodeVz = (Math.random() - 0.5) * 1.5;
    }

    update(time, scatter, convProgress, explodeProgress) {
      if (explodeProgress > 0) {
        const t = explodeProgress;
        this.x = this.targetX + this.explodeVx * t * 250;
        this.y = this.targetY + this.explodeVy * t * 250 - t * t * 350;
        this.z = this.targetZ + this.explodeVz * t * 80;
        return;
      }
      const easedConv = easeOutCubic(convProgress);
      this.x = this.scatteredX + (this.targetX - this.scatteredX) * easedConv;
      this.y = this.scatteredY + (this.targetY - this.scatteredY) * easedConv;
      this.z = this.scatteredZ + (this.targetZ - this.scatteredZ) * easedConv;

      if (convProgress > 0.5) {
        const df = (convProgress - 0.5) * 2;
        this.x += Math.cos(this.driftAngle) * Math.sin(time * CONFIG.driftSpeed + this.driftPhase) * CONFIG.driftAmplitude * df;
        this.y += Math.sin(this.driftAngle) * Math.cos(time * CONFIG.driftSpeed * 0.7 + this.driftPhase) * CONFIG.driftAmplitude * df;
        this.z += Math.cos(this.driftAngle * 0.7) * Math.sin(time * CONFIG.driftSpeed * 0.5 + this.driftPhase + Math.PI) * CONFIG.driftAmplitude * 0.5 * df;
      }
      if (scatter > 0 && convProgress >= 1) {
        this.x += this.scatterVx * CONFIG.scatterRadius * scatter * 0.8;
        this.y += this.scatterVy * CONFIG.scatterRadius * scatter * 0.8;
        this.z += this.scatterVz * CONFIG.scatterRadius * scatter * 0.8 * 0.5;
      }
    }

    draw(ctx, time, pulseScale, tiltX, convProgress, colorProgress) {
      const fadeIn = Math.min(1, convProgress * 2);
      if (fadeIn <= 0) return;
      const c = lerpColorObj(this.origColor, this.roseColor, colorProgress);

      const rotated = rotateY(this.x, this.y, this.z, rotationAngle);
      const rx = rotated.x * pulseScale, ry = rotated.y * pulseScale, rz = rotated.z * pulseScale;
      const rotated2 = rotateX(rx, ry, rz, tiltX || 0);
      const sx = rotated2.x, sy = rotated2.y, sz = rotated2.z;
      this.rotatedZ = sz;

      const projected = project(sx, sy, sz);
      const screenX = centerX + projected.sx;
      const screenY = centerY + projected.sy;
      const scaledSize = this.size * projected.scale;

      const twinkle = Math.sin(time * this.twinkleSpeed + this.twinklePhase);
      const alpha = CONFIG.twinkleRange[0] + ((twinkle + 1) / 2) * (CONFIG.twinkleRange[1] - CONFIG.twinkleRange[0]);
      const depthAlpha = 0.4 + 0.6 * ((this.rotatedZ + 100) / 200);
      const finalAlpha = Math.max(0.1, Math.min(1, alpha * depthAlpha)) * fadeIn;

      ctx.beginPath();
      ctx.arc(screenX, screenY, scaledSize, 0, Math.PI * 2);
      ctx.fillStyle = colorStr(c, finalAlpha);
      ctx.fill();
    }
  }

  // --- Rose petal class for Phase 3 ---
  class RosePetal {
    constructor() {
      // Default: start from heart position (fallback)
      const t = Math.random() * Math.PI * 2, u = Math.random() * Math.PI;
      const pos = heartPosition3D(t, u);
      const sc = heartSize / CONFIG.heartScale;
      this.x = pos.x * sc;
      this.y = pos.y * sc;
      this.z = pos.z * sc;

      // Explode outward with gravity
      const angle = Math.atan2(this.y, this.x) + (Math.random() - 0.5) * 1;
      const speed = 2 + Math.random() * 5;
      this.vx = Math.cos(angle) * speed + (Math.random() - 0.5) * 2;
      this.vy = Math.sin(angle) * speed - 2 - Math.random() * 3; // bias upward
      this.vz = (Math.random() - 0.5) * 3;

      this.gravity = 0.02 + Math.random() * 0.03;
      this.wind = (Math.random() - 0.5) * 0.05;
      this.rotation = Math.random() * Math.PI * 2;
      this.rotSpeed = (Math.random() - 0.5) * 0.05;
      this.size = 3 + Math.random() * 6;
      this.alpha = 0.7 + Math.random() * 0.3;
      this.fadeSpeed = 0.002 + Math.random() * 0.003;

      // Rose petal colors
      const petalColors = [
        { r: 220, g: 50,  b: 90  },
        { r: 240, g: 80,  b: 120 },
        { r: 255, g: 120, b: 150 },
        { r: 200, g: 40,  b: 80  },
        { r: 255, g: 100, b: 130 },
      ];
      this.color = petalColors[Math.floor(Math.random() * petalColors.length)];
      this.life = 1;
    }

    update() {
      this.vy += this.gravity;
      this.vx += this.wind;
      this.vy *= 0.999;
      this.x += this.vx;
      this.y += this.vy;
      this.z += this.vz;
      this.rotation += this.rotSpeed;
      this.life -= this.fadeSpeed;
    }

    draw(ctx) {
      if (this.life <= 0) return;
      ctx.save();
      ctx.translate(centerX + this.x, centerY + this.y);
      ctx.rotate(this.rotation);
      ctx.globalAlpha = this.life * this.alpha;

      // Draw rose petal shape
      ctx.beginPath();
      const s = this.size;
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.8, -s * 0.8, s, -s * 0.2, 0, s * 0.5);
      ctx.bezierCurveTo(-s, -s * 0.2, -s * 0.8, -s * 0.8, 0, -s);
      ctx.fillStyle = `rgb(${this.color.r}, ${this.color.g}, ${this.color.b})`;
      ctx.fill();
      ctx.restore();
    }
  }

  // --- Background stars ---
  class Star {
    constructor() {
      this.scatteredX = (Math.random() - 0.5) * width * 3;
      this.scatteredY = (Math.random() - 0.5) * height * 3;
      this.targetX = (Math.random() - 0.5) * width * 0.5;
      this.targetY = (Math.random() - 0.5) * height * 0.5;
      this.size = 0.5 + Math.random() * 1;
      this.phase = Math.random() * Math.PI * 2;
      this.speed = 0.005 + Math.random() * 0.01;
      this.alpha = 0.2 + Math.random() * 0.4;
    }

    draw(ctx, time, convProgress) {
      const fadeIn = 1 - Math.min(1, convProgress * 1.5);
      if (fadeIn <= 0) return;
      const a = this.alpha * fadeIn * (0.5 + 0.5 * Math.sin(time * this.speed + this.phase));
      const easedConv = easeOutCubic(convProgress);
      const sx = this.scatteredX + (this.targetX - this.scatteredX) * easedConv;
      const sy = this.scatteredY + (this.targetY - this.scatteredY) * easedConv;
      ctx.beginPath();
      ctx.arc(centerX + sx, centerY + sy, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 200, 255, ${a})`;
      ctx.fill();
    }
  }

  // --- Couple silhouette drawing ---
  function drawCoupleSilhouette(ctx, time, progress) {
    if (progress <= 0 || progress > 1) return;
    const alpha = Math.min(1, progress * 2) * 0.8;
    const sway = Math.sin(time * 0.02) * 2; // gentle sway
    const cx = centerX + sway;
    const cy = centerY + 30;
    const s = heartSize * 0.25; // scale

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#c060a0';

    // Left figure (boy)
    ctx.beginPath();
    // Head
    ctx.arc(cx - s*0.3, cy - s*1.2, s*0.25, 0, Math.PI*2);
    // Body
    ctx.moveTo(cx - s*0.3, cy - s*0.9);
    ctx.lineTo(cx - s*0.35, cy + s*0.3);
    ctx.lineTo(cx - s*0.5, cy + s*0.8);
    ctx.lineTo(cx - s*0.2, cy + s*0.8);
    ctx.lineTo(cx - s*0.15, cy + s*0.3);
    ctx.lineTo(cx - s*0.1, cy - s*0.9);
    ctx.fill();

    // Right figure (girl)
    ctx.beginPath();
    // Head
    ctx.arc(cx + s*0.3, cy - s*1.2, s*0.23, 0, Math.PI*2);
    // Hair bun
    ctx.arc(cx + s*0.35, cy - s*1.5, s*0.1, 0, Math.PI*2);
    // Body (dress shape)
    ctx.moveTo(cx + s*0.3, cy - s*0.9);
    ctx.lineTo(cx + s*0.25, cy + s*0.1);
    ctx.quadraticCurveTo(cx + s*0.5, cy + s*0.8, cx + s*0.6, cy + s*0.9);
    ctx.lineTo(cx + s*0.0, cy + s*0.9);
    ctx.quadraticCurveTo(cx + s*0.1, cy + s*0.3, cx + s*0.15, cy - s*0.9);
    ctx.fill();

    // Arms reaching toward each other (hug)
    ctx.lineWidth = s * 0.08;
    ctx.strokeStyle = '#c060a0';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - s*0.15, cy - s*0.5);
    ctx.quadraticCurveTo(cx + s*0.05, cy - s*0.7, cx + s*0.15, cy - s*0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + s*0.15, cy - s*0.5);
    ctx.quadraticCurveTo(cx - s*0.05, cy - s*0.7, cx - s*0.15, cy - s*0.4);
    ctx.stroke();

    ctx.restore();
  }

  // --- Animation loop ---
  let time = 0;
  let petals = [];
  let petalSpawned = false;

  function animate() {
    time++;
    phaseTime++;

    // Phase transitions
    if (currentPhase === 0) {
      convergenceProgress = Math.min(1, phaseTime / CONFIG.convergenceDuration);
      if (convergenceProgress >= 1) {
        currentPhase = 1;
        phaseTime = 0;
        colorTransitionProgress = 0;
      }
    } else if (currentPhase === 1) {
      convergenceProgress = 1;
      colorTransitionProgress = Math.min(1, phaseTime / (CONFIG.phase2Duration * 0.4));
      if (phaseTime > CONFIG.phase2Duration) {
        currentPhase = 2;
        phaseTime = 0;
        explosionProgress = 0;
        petalSpawned = false;
        petals = [];
      }
    } else if (currentPhase === 2) {
      explosionProgress = Math.min(1, phaseTime / 60); // Instant explosion over 1 second
      if (!petalSpawned && phaseTime >= 5) {
        // Spawn rose petals from actual particle positions
        for (const p of particles) {
          const petal = new RosePetal();
          // Use actual particle position, not heart center
          petal.x = p.x;
          petal.y = p.y;
          petal.z = p.z;
          petals.push(petal);
        }
        petalSpawned = true;
      }
      // Update and draw petals
      for (const p of petals) p.update();
      if (phaseTime > CONFIG.phase3Duration) {
        // Loop back to phase 1
        currentPhase = 0;
        phaseTime = 0;
        convergenceProgress = 0;
        colorTransitionProgress = 0;
        explosionProgress = 0;
        petals = [];
        petalSpawned = false;
        resize();
      }
    }

    // Inertia
    if (!isDragging) {
      rotationAngle += dragVelocity;
      dragVelocity *= 0.95;
      if (Math.abs(dragVelocity) < 0.0001) dragVelocity = 0;
    }
    rotationAngle += (currentPhase === 1 ? CONFIG.rotationSpeed : 0) * width;

    const { intensity, scatter } = heartbeatState(time);
    const pulseScale = 1 + intensity * 0.08;
    const tiltX = dragRotationX;

    ctx.clearRect(0, 0, width, height);

    // Draw stars (only in phase 0)
    if (currentPhase === 0) {
      for (const star of stars) star.draw(ctx, time, convergenceProgress);
    }

    // Update and sort particles
    for (const p of particles) {
      p.update(time, scatter, convergenceProgress, explosionProgress);
      const rotated = rotateY(p.x, p.y, p.z, rotationAngle);
      const rx = rotated.x * pulseScale, ry = rotated.y * pulseScale, rz = rotated.z * pulseScale;
      const rotated2 = rotateX(rx, ry, rz, tiltX);
      p.rotatedZ = rotated2.z;
    }
    particles.sort((a, b) => b.rotatedZ - a.rotatedZ);

    // Draw particles
    for (const p of particles) {
      p.draw(ctx, time, pulseScale, tiltX, convergenceProgress, colorTransitionProgress);
    }

    // Draw rose petals in phase 3
    if (currentPhase === 2 && petals.length > 0) {
      for (const p of petals) p.draw(ctx);
    }

    // Draw couple silhouette in late phase 3
    if (currentPhase === 2 && explosionProgress > 0.7) {
      drawCoupleSilhouette(ctx, time, (explosionProgress - 0.7) / 0.3);
    }

    // Notify HTML for text effects
    if (window.onConvergenceProgress) window.onConvergenceProgress(convergenceProgress);
    if (window.onPhaseChange) window.onPhaseChange(currentPhase, colorTransitionProgress);

    requestAnimationFrame(animate);
  }

  resize();
  animate();
})();
