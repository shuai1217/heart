/**
 * 3D Heart Particle Animation
 * Renders a 3D heart shape made of twinkling particles using Canvas 2D.
 * Uses 3D parametric heart equations with perspective projection.
 * Heartbeat: particles scatter outward on each beat, then converge back
 */

(function () {
  'use strict';

  const canvas = document.getElementById('heartCanvas');
  const ctx = canvas.getContext('2d');

  // --- Configuration ---
  const CONFIG = {
    particleCount: 1500,
    innerParticleCount: 600,
    driftSpeed: 0.04,
    driftAmplitude: 1,
    twinkleSpeed: 0.012,
    twinkleRange: [0.5, 1.0],
    colorStops: [
      { r: 50,  g: 100, b: 200 },
      { r: 120, g: 60,  b: 210 },
      { r: 210, g: 70,  b: 150 },
      { r: 255, g: 140, b: 170 },
      { r: 90,  g: 80,  b: 190 },
    ],
    glowSize: 5,
    heartbeatSpeed: 0.0008,
    scatterRadius: 35,
    scatterRecover: 30,
    // 3D rendering
    heartScale: 12,
    focalLength: 400,
    rotationSpeed: 0.0003,
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

  // --- 3D heart parametric equation ---
  function heartPosition3D(t, u) {
    const sinT = Math.sin(t);
    const cosT = Math.cos(t);
    const sinU = Math.sin(u);
    const cosU = Math.cos(u);

    const x = 16 * Math.pow(sinT, 3) * sinU;
    const y = -(13 * cosT - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * Math.pow(sinU, 2);
    const z = (12 * cosU + 3 * Math.cos(2 * u) + 2 * Math.cos(3 * u)) * 0.5;

    return { x, y, z };
  }

  // --- 3D rotation helper ---
  function rotateY(x, y, z, angle) {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    return {
      x: x * cosA + z * sinA,
      y: y,
      z: -x * sinA + z * cosA,
    };
  }

  function rotateX(x, y, z, angle) {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    return {
      x: x,
      y: y * cosA - z * sinA,
      z: y * sinA + z * cosA,
    };
  }

  // --- Perspective projection ---
  function project(x, y, z) {
    const scale = CONFIG.focalLength / (CONFIG.focalLength + z);
    return {
      sx: x * scale,
      sy: y * scale,
      scale: scale,
    };
  }

  // --- Heartbeat detection ---
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
  let rotationAngle = 0;

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

  // --- Sort particles by Z-depth for painter's algorithm ---
  function sortByDepth(a, b) {
    return (a.zDepth || 0) - (b.zDepth || 0);
  }

  // --- Outer heart particles (surface + slight scatter) ---
  class HeartParticle {
    constructor() {
      this.reset();
    }

    reset() {
      const t = Math.random() * Math.PI * 2;
      const u = Math.random() * Math.PI;
      const pos = heartPosition3D(t, u);

      // Small random offset to scatter particles slightly off the surface
      const offset = (Math.random() - 0.5) * 0.15;
      this.targetX = pos.x * (heartSize / CONFIG.heartScale) * (1 + offset);
      this.targetY = pos.y * (heartSize / CONFIG.heartScale) * (1 + offset);
      this.targetZ = pos.z * (heartSize / CONFIG.heartScale) * (1 + offset);

      this.x = this.targetX;
      this.y = this.targetY;
      this.z = this.targetZ;

      this.driftPhase = Math.random() * Math.PI * 2;
      this.driftAngle = Math.random() * Math.PI * 2;
      this.twinklePhase = Math.random() * Math.PI * 2;
      this.twinkleSpeed = CONFIG.twinkleSpeed * (0.5 + Math.random());

      // Color based on 3D position
      const colorT = (Math.atan2(this.targetY, this.targetX) / (Math.PI * 2) + 1) % 1;
      this.color = lerpColor(CONFIG.colorStops, colorT);
      this.size = 1 + Math.random() * 2.5;

      // Scatter direction: outward in 3D using spherical coordinates
      const dist = Math.sqrt(
        this.targetX * this.targetX +
        this.targetY * this.targetY +
        this.targetZ * this.targetZ
      );
      if (dist > 0) {
        this.scatterVx = this.targetX / dist;
        this.scatterVy = this.targetY / dist;
        this.scatterVz = this.targetZ / dist;
      } else {
        this.scatterVx = 0;
        this.scatterVy = 0;
        this.scatterVz = 1;
      }

      // Depth for sorting
      this.zDepth = this.targetZ;
    }

    update(time, scatter) {
      // Drift in 3D
      const driftX = Math.sin(time * CONFIG.driftSpeed + this.driftPhase) * CONFIG.driftAmplitude;
      const driftY = Math.cos(time * CONFIG.driftSpeed * 0.7 + this.driftPhase) * CONFIG.driftAmplitude;
      const driftZ = Math.sin(time * CONFIG.driftSpeed * 0.5 + this.driftPhase + Math.PI) * CONFIG.driftAmplitude * 0.5;

      this.x = this.targetX + Math.cos(this.driftAngle) * driftX;
      this.y = this.targetY + Math.sin(this.driftAngle) * driftY;
      this.z = this.targetZ + Math.cos(this.driftAngle * 0.7) * driftZ;

      // Scatter outward in 3D
      if (scatter > 0) {
        this.x += this.scatterVx * CONFIG.scatterRadius * scatter;
        this.y += this.scatterVy * CONFIG.scatterRadius * scatter;
        this.z += this.scatterVz * CONFIG.scatterRadius * scatter * 0.5;
      }
    }

    draw(ctx) {
      // Rotate particle position
      const rotated = rotateY(this.x, this.y, this.z, rotationAngle);
      const rotated2 = rotateX(rotated.x, rotated.y, rotated.z, 0.15);

      // Project to 2D
      const projected = project(rotated2.x, rotated2.y, rotated2.z);

      const screenX = centerX + projected.sx;
      const screenY = centerY + projected.sy;
      const scaledSize = this.size * projected.scale;

      // Twinkle
      const twinkle = Math.sin(time * this.twinkleSpeed + this.twinklePhase);
      const alpha = CONFIG.twinkleRange[0] +
        ((twinkle + 1) / 2) * (CONFIG.twinkleRange[1] - CONFIG.twinkleRange[0]);

      // Adjust alpha based on depth for atmosphere
      const depthAlpha = 0.4 + 0.6 * ((rotated2.z + 100) / 200);
      const finalAlpha = Math.max(0.1, Math.min(1, alpha * depthAlpha));

      ctx.beginPath();
      ctx.arc(screenX, screenY, scaledSize, 0, Math.PI * 2);
      ctx.fillStyle = colorStr(this.color, finalAlpha);
      ctx.fill();

      if (scaledSize > 2) {
        ctx.beginPath();
        ctx.arc(screenX, screenY, scaledSize + CONFIG.glowSize * projected.scale, 0, Math.PI * 2);
        ctx.fillStyle = colorStr(this.color, finalAlpha * 0.15);
        ctx.fill();
      }
    }
  }

  // --- Inner fill particles (3D volume fill) ---
  class InnerParticle {
    constructor() {
      this.reset();
    }

    reset() {
      const t = Math.random() * Math.PI * 2;
      const u = Math.random() * Math.PI;
      const pos = heartPosition3D(t, u);

      // Multiply by pow(random, 0.6) to fill the interior volume
      const scale = Math.pow(Math.random(), 0.6);
      this.targetX = pos.x * (heartSize / CONFIG.heartScale) * scale;
      this.targetY = pos.y * (heartSize / CONFIG.heartScale) * scale;
      this.targetZ = pos.z * (heartSize / CONFIG.heartScale) * scale;

      this.x = this.targetX;
      this.y = this.targetY;
      this.z = this.targetZ;

      this.driftPhase = Math.random() * Math.PI * 2;
      this.driftAngle = Math.random() * Math.PI * 2;
      this.twinklePhase = Math.random() * Math.PI * 2;
      this.twinkleSpeed = CONFIG.twinkleSpeed * (0.3 + Math.random() * 0.7);

      // Color: warm pink/rose/magenta scheme
      const innerColorT = Math.random();
      if (innerColorT < 0.33) {
        this.color = { r: 255, g: 120, b: 160 };   // Warm pink
      } else if (innerColorT < 0.66) {
        this.color = { r: 240, g: 80,  b: 140 };   // Rose
      } else {
        this.color = { r: 220, g: 60,  b: 180 };   // Magenta
      }

      this.size = 0.8 + Math.random() * 1.8;

      // Scatter direction in 3D
      const dist = Math.sqrt(
        this.targetX * this.targetX +
        this.targetY * this.targetY +
        this.targetZ * this.targetZ
      );
      if (dist > 0) {
        this.scatterVx = this.targetX / dist;
        this.scatterVy = this.targetY / dist;
        this.scatterVz = this.targetZ / dist;
      } else {
        this.scatterVx = 0;
        this.scatterVy = 0;
        this.scatterVz = 1;
      }

      this.zDepth = this.targetZ;
    }

    update(time, scatter) {
      const driftX = Math.sin(time * CONFIG.driftSpeed + this.driftPhase) * CONFIG.driftAmplitude;
      const driftY = Math.cos(time * CONFIG.driftSpeed * 0.7 + this.driftPhase) * CONFIG.driftAmplitude;
      const driftZ = Math.sin(time * CONFIG.driftSpeed * 0.5 + this.driftPhase + Math.PI) * CONFIG.driftAmplitude * 0.5;

      this.x = this.targetX + Math.cos(this.driftAngle) * driftX;
      this.y = this.targetY + Math.sin(this.driftAngle) * driftY;
      this.z = this.targetZ + Math.cos(this.driftAngle * 0.7) * driftZ;

      if (scatter > 0) {
        this.x += this.scatterVx * CONFIG.scatterRadius * scatter * 0.8;
        this.y += this.scatterVy * CONFIG.scatterRadius * scatter * 0.8;
        this.z += this.scatterVz * CONFIG.scatterRadius * scatter * 0.8 * 0.5;
      }
    }

    draw(ctx) {
      // Rotate particle position
      const rotated = rotateY(this.x, this.y, this.z, rotationAngle);
      const rotated2 = rotateX(rotated.x, rotated.y, rotated.z, 0.15);

      // Project to 2D
      const projected = project(rotated2.x, rotated2.y, rotated2.z);

      const screenX = centerX + projected.sx;
      const screenY = centerY + projected.sy;
      const scaledSize = this.size * projected.scale;

      const twinkle = Math.sin(time * this.twinkleSpeed + this.twinklePhase);
      const alpha = CONFIG.twinkleRange[0] +
        ((twinkle + 1) / 2) * (CONFIG.twinkleRange[1] - CONFIG.twinkleRange[0]);

      const depthAlpha = 0.4 + 0.6 * ((rotated2.z + 100) / 200);
      const finalAlpha = Math.max(0.1, Math.min(1, alpha * depthAlpha));

      ctx.beginPath();
      ctx.arc(screenX, screenY, scaledSize, 0, Math.PI * 2);
      ctx.fillStyle = colorStr(this.color, finalAlpha);
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
    rotationAngle += CONFIG.rotationSpeed * width;
    const { scatter } = heartbeatState(time);
    ctx.clearRect(0, 0, width, height);

    // Draw stars
    for (const star of stars) {
      star.draw(ctx, time);
    }

    // Sort particles by Z-depth for proper layering
    particles.sort(sortByDepth);

    // Draw particles
    for (const p of particles) {
      p.update(time, scatter);
      p.draw(ctx);
    }

    requestAnimationFrame(animate);
  }

  resize();
  animate();
})();
