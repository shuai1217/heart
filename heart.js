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
    surfaceParticleCount: 1500,
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
    rotationSpeed: 0.00005,
    // Phase 1: Starlight Convergence
    convergenceDuration: 360, // frames (~6 seconds at 60fps)
    convergenceStartTime: 0, // when convergence started (in animation frames)
  };

  // --- Phase tracking ---
  let currentPhase = 0; // 0=converging, 1=rotating, 2=exploding
  let convergenceProgress = 0;
  let convergenceElapsed = 0;

  // --- Drag interaction state ---
  let isDragging = false;
  let dragStartX = 0;
  let dragRotationX = 0;
  let dragVelocity = 0;

  // --- Easing functions ---
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

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
    for (let i = 0; i < CONFIG.surfaceParticleCount; i++) {
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

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(resize, 200);
  });

  // --- Mouse/touch drag interaction ---
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStartX = e.clientX;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    dragVelocity = dx * 0.005;
    rotationAngle += dx * 0.005;
    dragRotationX += dx * 0.003;
    dragStartX = e.clientX;
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  canvas.addEventListener('touchstart', (e) => {
    isDragging = true;
    dragStartX = e.touches[0].clientX;
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const dx = e.touches[0].clientX - dragStartX;
    dragVelocity = dx * 0.005;
    rotationAngle += dx * 0.005;
    dragRotationX += dx * 0.003;
    dragStartX = e.touches[0].clientX;
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('touchend', () => {
    isDragging = false;
  });

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

      // Scattered (stardust) initial positions
      this.scatteredX = (Math.random() - 0.5) * width * 2;
      this.scatteredY = (Math.random() - 0.5) * height * 2;
      this.scatteredZ = (Math.random() - 0.5) * 200;
    }

    update(time, scatter, convProgress) {
      // Starlight convergence: lerp from scattered to target
      const easedConv = easeOutCubic(convProgress);
      this.x = this.scatteredX + (this.targetX - this.scatteredX) * easedConv;
      this.y = this.scatteredY + (this.targetY - this.scatteredY) * easedConv;
      this.z = this.scatteredZ + (this.targetZ - this.scatteredZ) * easedConv;

      // Drift in 3D (only applies when converged)
      if (convProgress > 0.5) {
        const driftFactor = (convProgress - 0.5) * 2; // 0→1 as conv goes 0.5→1
        const driftX = Math.sin(time * CONFIG.driftSpeed + this.driftPhase) * CONFIG.driftAmplitude;
        const driftY = Math.cos(time * CONFIG.driftSpeed * 0.7 + this.driftPhase) * CONFIG.driftAmplitude;
        const driftZ = Math.sin(time * CONFIG.driftSpeed * 0.5 + this.driftPhase + Math.PI) * CONFIG.driftAmplitude * 0.5;

        this.x += Math.cos(this.driftAngle) * driftX * driftFactor;
        this.y += Math.sin(this.driftAngle) * driftY * driftFactor;
        this.z += Math.cos(this.driftAngle * 0.7) * driftZ * driftFactor;
      }

      // Scatter outward in 3D (only applies when converged)
      if (scatter > 0 && convProgress >= 1) {
        this.x += this.scatterVx * CONFIG.scatterRadius * scatter;
        this.y += this.scatterVy * CONFIG.scatterRadius * scatter;
        this.z += this.scatterVz * CONFIG.scatterRadius * scatter * 0.5;
      }
    }

    draw(ctx, time, pulseScale, tiltX, convProgress) {
      // Fade in particles as convergence progresses
      const fadeIn = Math.min(1, convProgress * 2); // fully visible by 0.5 convergence

      // Rotate particle position
      const rotated = rotateY(this.x, this.y, this.z, rotationAngle);
      const rx = rotated.x * pulseScale;
      const ry = rotated.y * pulseScale;
      const rz = rotated.z * pulseScale;
      const rotated2 = rotateX(rx, ry, rz, tiltX || 0);

      const sx = rotated2.x;
      const sy = rotated2.y;
      const sz = rotated2.z;

      // Store rotated Z for depth-based alpha
      this.rotatedZ = sz;

      // Project to 2D
      const projected = project(sx, sy, sz);

      const screenX = centerX + projected.sx;
      const screenY = centerY + projected.sy;
      const scaledSize = this.size * projected.scale;

      // Twinkle
      const twinkle = Math.sin(time * this.twinkleSpeed + this.twinklePhase);
      const alpha = CONFIG.twinkleRange[0] +
        ((twinkle + 1) / 2) * (CONFIG.twinkleRange[1] - CONFIG.twinkleRange[0]);

      // Adjust alpha based on depth for atmosphere
      const depthAlpha = 0.4 + 0.6 * ((this.rotatedZ + 100) / 200);
      const finalAlpha = Math.max(0.1, Math.min(1, alpha * depthAlpha)) * fadeIn;

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

      // Scattered (stardust) initial positions
      this.scatteredX = (Math.random() - 0.5) * width * 2;
      this.scatteredY = (Math.random() - 0.5) * height * 2;
      this.scatteredZ = (Math.random() - 0.5) * 200;
    }

    update(time, scatter, convProgress) {
      // Starlight convergence: lerp from scattered to target
      const easedConv = easeOutCubic(convProgress);
      this.x = this.scatteredX + (this.targetX - this.scatteredX) * easedConv;
      this.y = this.scatteredY + (this.targetY - this.scatteredY) * easedConv;
      this.z = this.scatteredZ + (this.targetZ - this.scatteredZ) * easedConv;

      // Drift in 3D (only applies when converged)
      if (convProgress > 0.5) {
        const driftFactor = (convProgress - 0.5) * 2;
        const driftX = Math.sin(time * CONFIG.driftSpeed + this.driftPhase) * CONFIG.driftAmplitude;
        const driftY = Math.cos(time * CONFIG.driftSpeed * 0.7 + this.driftPhase) * CONFIG.driftAmplitude;
        const driftZ = Math.sin(time * CONFIG.driftSpeed * 0.5 + this.driftPhase + Math.PI) * CONFIG.driftAmplitude * 0.5;

        this.x += Math.cos(this.driftAngle) * driftX * driftFactor;
        this.y += Math.sin(this.driftAngle) * driftY * driftFactor;
        this.z += Math.cos(this.driftAngle * 0.7) * driftZ * driftFactor;
      }

      if (scatter > 0 && convProgress >= 1) {
        this.x += this.scatterVx * CONFIG.scatterRadius * scatter * 0.8;
        this.y += this.scatterVy * CONFIG.scatterRadius * scatter * 0.8;
        this.z += this.scatterVz * CONFIG.scatterRadius * scatter * 0.8 * 0.5;
      }
    }

    draw(ctx, time, pulseScale, tiltX, convProgress) {
      // Fade in particles as convergence progresses
      const fadeIn = Math.min(1, convProgress * 2);

      // Rotate particle position
      const rotated = rotateY(this.x, this.y, this.z, rotationAngle);
      const rx = rotated.x * pulseScale;
      const ry = rotated.y * pulseScale;
      const rz = rotated.z * pulseScale;
      const rotated2 = rotateX(rx, ry, rz, tiltX || 0);

      const sx = rotated2.x;
      const sy = rotated2.y;
      const sz = rotated2.z;

      // Store rotated Z for depth-based alpha
      this.rotatedZ = sz;

      // Project to 2D
      const projected = project(sx, sy, sz);

      const screenX = centerX + projected.sx;
      const screenY = centerY + projected.sy;
      const scaledSize = this.size * projected.scale;

      const twinkle = Math.sin(time * this.twinkleSpeed + this.twinklePhase);
      const alpha = CONFIG.twinkleRange[0] +
        ((twinkle + 1) / 2) * (CONFIG.twinkleRange[1] - CONFIG.twinkleRange[0]);

      const depthAlpha = 0.4 + 0.6 * ((this.rotatedZ + 100) / 200);
      const finalAlpha = Math.max(0.1, Math.min(1, alpha * depthAlpha)) * fadeIn;

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
      // Scattered position far from center
      this.scatteredX = (Math.random() - 0.5) * width * 3;
      this.scatteredY = (Math.random() - 0.5) * height * 3;
    }

    draw(ctx, time, convProgress) {
      // Stars fade out as heart converges
      const fadeIn = 1 - Math.min(1, convProgress * 1.5);
      if (fadeIn <= 0) return;
      const a = this.alpha * fadeIn * (0.5 + 0.5 * Math.sin(time * this.speed + this.phase));
      ctx.beginPath();
      ctx.arc(centerX + this.scatteredX * (1 - easeOutCubic(convProgress)),
              centerY + this.scatteredY * (1 - easeOutCubic(convProgress)),
              this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 200, 255, ${a})`;
      ctx.fill();
    }
  }

  // --- Animation loop ---
  let time = 0;

  function animate() {
    time++;

    // Phase 1: Track convergence progress
    if (currentPhase === 0) {
      convergenceElapsed++;
      convergenceProgress = Math.min(1, convergenceElapsed / CONFIG.convergenceDuration);
      if (convergenceProgress >= 1) {
        currentPhase = 1; // Transition to Phase 2 (rotating)
      }
    }

    // Inertia: keep rotating after drag release
    if (!isDragging) {
      rotationAngle += dragVelocity;
      dragVelocity *= 0.95;
      if (Math.abs(dragVelocity) < 0.0001) dragVelocity = 0;
    }

    // Auto-rotation
    rotationAngle += CONFIG.rotationSpeed * width;

    const { intensity, scatter } = heartbeatState(time);
    // 3D pulse scale: heart expands slightly on beat
    const pulseScale = 1 + intensity * 0.08;

    // Apply X-axis tilt from drag
    const tiltX = dragRotationX;

    ctx.clearRect(0, 0, width, height);

    // Draw stars
    for (const star of stars) {
      star.draw(ctx, time, convergenceProgress);
    }

    // Sort particles by Z-depth for proper layering
    for (const p of particles) {
      p.update(time, scatter, convergenceProgress);
      const rotated = rotateY(p.x, p.y, p.z, rotationAngle);
      const rx = rotated.x * pulseScale;
      const ry = rotated.y * pulseScale;
      const rz = rotated.z * pulseScale;
      const rotated2 = rotateX(rx, ry, rz, tiltX);
      const sx = rotated2.x;
      const sy = rotated2.y;
      const sz = rotated2.z;
      p.rotatedZ = sz;
    }
    particles.sort((a, b) => b.rotatedZ - a.rotatedZ);

    // Draw particles
    for (const p of particles) {
      p.draw(ctx, time, pulseScale, tiltX, convergenceProgress);
    }

    // Notify HTML of convergence progress for typing text
    if (window.onConvergenceProgress) {
      window.onConvergenceProgress(convergenceProgress);
    }

    requestAnimationFrame(animate);
  }

  resize();
  animate();
})();
