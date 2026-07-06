/**
 * Heart Particle Animation
 * Renders a heart shape made of twinkling particles using Canvas 2D.
 * Parametric heart equation: x = 16sin^3(t), y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
 * Heartbeat: particles scatter outward on each beat, then converge back
 */

(function () {
  'use strict';

  const canvas = document.getElementById('heartCanvas');
  const ctx = canvas.getContext('2d');

  // --- Configuration ---
  const CONFIG = {
    particleCount: 1500,
    heartScale: 12,
    driftSpeed: 0.06,
    driftAmplitude: 1,
    twinkleSpeed: 0.012,
    twinkleRange: [0.5, 1.0],
    colorStops: [
      { r: 50,  g: 100, b: 200 },   // Deep blue
      { r: 120, g: 60,  b: 210 },   // Purple
      { r: 210, g: 70,  b: 150 },   // Pink
      { r: 255, g: 140, b: 170 },   // Light pink
      { r: 90,  g: 80,  b: 190 },   // Indigo
    ],
    glowSize: 5,
    heartbeatSpeed: 0.0015,
    scatterRadius: 35,             // How far particles scatter on beat
    scatterDuration: 12,           // Frames for scatter to peak
    scatterRecover: 30,            // Frames to recover to heart shape
    innerParticleCount: 600,       // Extra particles filling the center
  };

  // --- Color utility ---
  function lerpColor(colors, t) {
    t = Math.max(0, Math.min(1, t));
    const idx = t * (colors.length - 1);
    const i = Math.floor(idx);
    const frac = idx - i;
    if (i >= colors.length - 1) {
      return colors[colors.length - 1];
    }
    const c1 = colors[i];
    const c2 = colors[i + 1];
    return {
      r: Math.round(c1.r + (c2.r - c1.r) * frac),
      g: Math.round(c1.g + (c2.g - c1.g) * frac),
      b: Math.round(c1.b + (c2.b - c1.b) * frac),
    };
  }

  function colorStr(c, alpha) {
    return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
  }

  // --- Heart parametric equation ---
  function heartPosition(t) {
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    return { x, y };
  }

  // --- Heartbeat detection ---
  // Returns a scatter factor: 0 = fully converged, 1 = maximum scattered
  // Tracks the double-pulse heartbeat and triggers scatter on peaks
  let lastBeatPhase = 0;
  let scatterFactor = 0;
  let scatterFrame = 0;
  let recovering = false;

  function heartbeatState(time) {
    const t = (time * CONFIG.heartbeatSpeed) % (Math.PI * 2);
    // Double-pulse
    const beat1 = Math.exp(-3 * Math.pow(Math.sin(t * 0.5), 2));
    const beat2 = Math.exp(-5 * Math.pow(Math.sin((t - Math.PI * 0.4) * 0.5), 2)) * 0.6;
    const intensity = beat1 + beat2;

    // Detect beat peak: if intensity crosses threshold going up
    if (intensity > 0.5 && !recovering) {
      scatterFactor = 1.0;
      scatterFrame = 0;
      recovering = true;
    }

    // Recover: ease back to 0 over scatterRecover frames
    if (recovering) {
      scatterFrame++;
      scatterFactor = 1.0 - (scatterFrame / CONFIG.scatterRecover);
      if (scatterFrame >= CONFIG.scatterRecover) {
        scatterFactor = 0;
        recovering = false;
      }
    }

    return { intensity, scatter: scatterFactor };
  }

  // --- Resize handling ---
  let width, height, centerX, centerY, heartSize;
  let particles = [];
  let stars = [];

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    centerX = width / 2;
    centerY = height / 2;
    heartSize = Math.min(width, height) * 0.35;

    particles.length = 0;
    for (let i = 0; i < CONFIG.particleCount; i++) {
      particles.push(new HeartParticle());
    }
    // Add inner fill particles
    for (let i = 0; i < CONFIG.innerParticleCount; i++) {
      particles.push(new InnerParticle());
    }

    stars.length = 0;
    for (let i = 0; i < 80; i++) {
      stars.push(new Star());
    }
  }

  window.addEventListener('resize', resize);

  // --- Outer heart particles (outline + some interior) ---
  class HeartParticle {
    constructor() {
      this.reset();
    }

    reset() {
      const t = Math.random() * Math.PI * 2;
      const pos = heartPosition(t);

      this.baseX = pos.x * (heartSize / 12);
      this.baseY = pos.y * (heartSize / 12);

      const fillFactor = Math.random();
      if (fillFactor < 0.55) {
        const band = (Math.random() - 0.5) * 3;
        this.targetX = this.baseX + band;
        this.targetY = this.baseY + band;
      } else {
        const innerT = Math.random() * Math.PI * 2;
        const innerPos = heartPosition(innerT);
        const innerScale = Math.pow(Math.random(), 2);
        this.targetX = innerPos.x * (heartSize / 12) * innerScale;
        this.targetY = innerPos.y * (heartSize / 12) * innerScale;
      }

      this.x = this.targetX;
      this.y = this.targetY;

      this.driftPhase = Math.random() * Math.PI * 2;
      this.driftAngle = Math.random() * Math.PI * 2;
      this.twinklePhase = Math.random() * Math.PI * 2;
      this.twinkleSpeed = CONFIG.twinkleSpeed * (0.5 + Math.random());

      const colorT = (Math.atan2(this.targetY, this.targetX) / (Math.PI * 2) + 1) % 1;
      this.color = lerpColor(CONFIG.colorStops, colorT);
      this.size = 1 + Math.random() * 2.5;

      // Scatter direction: outward from heart center
      const angle = Math.atan2(this.targetY, this.targetX) + (Math.random() - 0.5) * 1.2;
      this.scatterVx = Math.cos(angle);
      this.scatterVy = Math.sin(angle);
    }

    update(time, scatter) {
      // Drift
      const driftX = Math.sin(time * CONFIG.driftSpeed + this.driftPhase) * CONFIG.driftAmplitude;
      const driftY = Math.cos(time * CONFIG.driftSpeed * 0.7 + this.driftPhase) * CONFIG.driftAmplitude;
      this.x = this.targetX + Math.cos(this.driftAngle) * driftX;
      this.y = this.targetY + Math.sin(this.driftAngle) * driftY;

      // Scatter outward
      if (scatter > 0) {
        this.x += this.scatterVx * CONFIG.scatterRadius * scatter;
        this.y += this.scatterVy * CONFIG.scatterRadius * scatter;
      }
    }

    draw(ctx) {
      // Twinkle
      const twinkle = Math.sin(time * this.twinkleSpeed + this.twinklePhase);
      const alpha = CONFIG.twinkleRange[0] +
        ((twinkle + 1) / 2) * (CONFIG.twinkleRange[1] - CONFIG.twinkleRange[0]);

      ctx.beginPath();
      ctx.arc(centerX + this.x, centerY + this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = colorStr(this.color, alpha);
      ctx.fill();

      if (this.size > 2) {
        ctx.beginPath();
        ctx.arc(centerX + this.x, centerY + this.y, this.size + CONFIG.glowSize, 0, Math.PI * 2);
        ctx.fillStyle = colorStr(this.color, alpha * 0.15);
        ctx.fill();
      }
    }
  }

  // --- Inner fill particles (dense gradient filling the heart interior) ---
  class InnerParticle {
    constructor() {
      this.reset();
    }

    reset() {
      // Pick a random point inside the heart
      const t = Math.random() * Math.PI * 2;
      const pos = heartPosition(t);
      const scale = Math.pow(Math.random(), 0.6); // Bias toward edges for even fill
      this.targetX = pos.x * (heartSize / 12) * scale;
      this.targetY = pos.y * (heartSize / 12) * scale;

      this.x = this.targetX;
      this.y = this.targetY;

      this.driftPhase = Math.random() * Math.PI * 2;
      this.driftAngle = Math.random() * Math.PI * 2;
      this.twinklePhase = Math.random() * Math.PI * 2;
      this.twinkleSpeed = CONFIG.twinkleSpeed * (0.3 + Math.random() * 0.7);

      // Color: inner particles use a warmer gradient (pink → magenta → rose)
      const innerColorT = Math.random();
      if (innerColorT < 0.33) {
        this.color = { r: 255, g: 120, b: 160 };   // Warm pink
      } else if (innerColorT < 0.66) {
        this.color = { r: 240, g: 80,  b: 140 };   // Rose
      } else {
        this.color = { r: 220, g: 60,  b: 180 };   // Magenta
      }

      this.size = 0.8 + Math.random() * 1.8;

      // Scatter direction
      const angle = Math.atan2(this.targetY, this.targetX) + (Math.random() - 0.5) * 1.5;
      this.scatterVx = Math.cos(angle);
      this.scatterVy = Math.sin(angle);
    }

    update(time, scatter) {
      const driftX = Math.sin(time * CONFIG.driftSpeed + this.driftPhase) * CONFIG.driftAmplitude;
      const driftY = Math.cos(time * CONFIG.driftSpeed * 0.7 + this.driftPhase) * CONFIG.driftAmplitude;
      this.x = this.targetX + Math.cos(this.driftAngle) * driftX;
      this.y = this.targetY + Math.sin(this.driftAngle) * driftY;

      if (scatter > 0) {
        this.x += this.scatterVx * CONFIG.scatterRadius * scatter * 0.8;
        this.y += this.scatterVy * CONFIG.scatterRadius * scatter * 0.8;
      }
    }

    draw(ctx) {
      const twinkle = Math.sin(time * this.twinkleSpeed + this.twinklePhase);
      const alpha = CONFIG.twinkleRange[0] +
        ((twinkle + 1) / 2) * (CONFIG.twinkleRange[1] - CONFIG.twinkleRange[0]);

      ctx.beginPath();
      ctx.arc(centerX + this.x, centerY + this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = colorStr(this.color, alpha);
      ctx.fill();
    }
  }

  // --- Background stars ---
  class Star {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.size = 0.5 + Math.random() * 1;
      this.phase = Math.random() * Math.PI * 2;
      this.speed = 0.005 + Math.random() * 0.01;
      this.alpha = 0.2 + Math.random() * 0.4;
    }

    draw(ctx, time) {
      const a = this.alpha * (0.5 + 0.5 * Math.sin(time * this.speed + this.phase));
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 200, 255, ${a})`;
      ctx.fill();
    }
  }

  // --- Animation loop ---
  let time = 0;

  function animate() {
    time++;
    const { scatter } = heartbeatState(time);
    ctx.clearRect(0, 0, width, height);

    for (const star of stars) {
      star.draw(ctx, time);
    }

    for (const p of particles) {
      p.update(time, scatter);
      p.draw(ctx);
    }

    requestAnimationFrame(animate);
  }

  resize();
  animate();
})();
