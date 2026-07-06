/**
 * Heart Particle Animation
 * Renders a heart shape made of twinkling particles using Canvas 2D.
 * Parametric heart equation: x = 16sin^3(t), y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
 */

(function () {
  'use strict';

  const canvas = document.getElementById('heartCanvas');
  const ctx = canvas.getContext('2d');

  // --- Configuration ---
  const CONFIG = {
    particleCount: 800,       // Number of particles forming the heart
    heartScale: 12,           // Size multiplier for the heart shape
    driftSpeed: 0.15,         // How fast particles drift (pixels/frame)
    driftAmplitude: 2,        // How far particles drift from center
    twinkleSpeed: 0.015,      // Speed of opacity oscillation
    twinkleRange: [0.4, 1.0], // Min/max opacity during twinkle
    colorStops: [
      { r: 50,  g: 100, b: 200 },   // Richer deep blue
      { r: 120, g: 60,  b: 210 },   // Vivid purple
      { r: 210, g: 70,  b: 150 },   // Bright pink
      { r: 255, g: 140, b: 170 },   // Soft light pink
      { r: 90,  g: 80,  b: 190 },   // Deep indigo
    ],
    glowSize: 5,              // Particle glow radius
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
  // Returns (x, y) on the heart outline for parameter t in [0, 2pi]
  function heartPosition(t) {
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    return { x, y };
  }

  // --- Resize handling ---
  let width, height, centerX, centerY, heartSize;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    centerX = width / 2;
    centerY = height / 2;
    // Heart size scales with the smaller screen dimension
    heartSize = Math.min(width, height) * 0.35;

    // Recreate particles and stars with new scale
    particles.length = 0;
    for (let i = 0; i < CONFIG.particleCount; i++) {
      particles.push(new Particle());
    }
    stars.length = 0;
    for (let i = 0; i < 80; i++) {
      stars.push(new Star());
    }
  }

  window.addEventListener('resize', resize);

  // --- Particle class ---
  class Particle {
    constructor() {
      this.reset();
    }

    reset() {
      // Random parameter on the heart curve [0, 2pi]
      const t = Math.random() * Math.PI * 2;
      const pos = heartPosition(t);

      // Base position on heart outline, scaled
      this.baseX = pos.x * (heartSize / 12);
      this.baseY = pos.y * (heartSize / 12);

      // Random fill: some particles on the outline, some inside
      const fillFactor = Math.random();
      if (fillFactor < 0.7) {
        // 70% on the outline (within a band)
        const band = (Math.random() - 0.5) * 4;
        this.targetX = this.baseX + band;
        this.targetY = this.baseY + band;
      } else {
        // 30% randomly distributed inside the heart
        const innerT = Math.random() * Math.PI * 2;
        const innerPos = heartPosition(innerT);
        const innerScale = Math.pow(Math.random(), 2); // Bias toward center
        this.targetX = innerPos.x * (heartSize / 12) * innerScale;
        this.targetY = innerPos.y * (heartSize / 12) * innerScale;
      }

      this.x = this.targetX;
      this.y = this.targetY;

      // Drift offsets
      this.driftPhase = Math.random() * Math.PI * 2;
      this.driftAngle = Math.random() * Math.PI * 2;

      // Twinkle
      this.twinklePhase = Math.random() * Math.PI * 2;
      this.twinkleSpeed = CONFIG.twinkleSpeed * (0.5 + Math.random());

      // Color: pick from gradient based on position angle
      const colorT = (Math.atan2(this.targetY, this.targetX) / (Math.PI * 2) + 1) % 1;
      this.color = lerpColor(CONFIG.colorStops, colorT);

      // Size
      this.size = 1 + Math.random() * 2.5;
    }

    update(time) {
      // Drift motion
      const driftX = Math.sin(time * CONFIG.driftSpeed + this.driftPhase) * CONFIG.driftAmplitude;
      const driftY = Math.cos(time * CONFIG.driftSpeed * 0.7 + this.driftPhase) * CONFIG.driftAmplitude;
      this.x = this.targetX + Math.cos(this.driftAngle) * driftX;
      this.y = this.targetY + Math.sin(this.driftAngle) * driftY;

      // Twinkle
      const twinkle = Math.sin(time * this.twinkleSpeed + this.twinklePhase);
      this.alpha = CONFIG.twinkleRange[0] +
        ((twinkle + 1) / 2) * (CONFIG.twinkleRange[1] - CONFIG.twinkleRange[0]);
    }

    draw(ctx) {
      ctx.beginPath();
      ctx.arc(centerX + this.x, centerY + this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = colorStr(this.color, this.alpha);
      ctx.fill();

      // Glow effect
      if (this.size > 2) {
        ctx.beginPath();
        ctx.arc(centerX + this.x, centerY + this.y, this.size + CONFIG.glowSize, 0, Math.PI * 2);
        ctx.fillStyle = colorStr(this.color, this.alpha * 0.15);
        ctx.fill();
      }
    }
  }

  // --- Background stars (ambient sparkle) ---
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

  // --- Create particles and stars ---
  const particles = [];
  const stars = [];

  // --- Animation loop ---
  let time = 0;

  function animate() {
    time++;
    ctx.clearRect(0, 0, width, height);

    // Draw ambient stars
    for (const star of stars) {
      star.draw(ctx, time);
    }

    // Draw particles
    for (const p of particles) {
      p.update(time);
      p.draw(ctx);
    }

    requestAnimationFrame(animate);
  }

  // Initialize after everything is defined
  resize();
  animate();
})();
