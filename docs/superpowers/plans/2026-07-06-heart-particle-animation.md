# Heart Particle Animation Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a romantic single-page heart particle animation with the name "尹湘清" centered inside.

**Architecture:** Single HTML file with embedded CSS and vanilla JavaScript. Uses Canvas 2D to render hundreds of particles arranged in a heart shape using parametric equations. Particles drift softly and twinkle like fireflies against a midnight blue gradient background.

**Tech Stack:** HTML5 Canvas, vanilla JavaScript (ES6+), CSS3 gradients, Google Fonts (Ma Shan Zheng for Chinese handwriting style)

---

### Task 1: Project scaffolding — create index.html with canvas setup

**Files:**
- Create: `D:\angent\index.html`

- [ ] **Step 1: Create the HTML file with full structure**

Create `D:\angent\index.html` with the following complete content:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>尹湘清 · Heart</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: linear-gradient(135deg, #0a0015 0%, #0d1b3e 35%, #1a0a3c 65%, #0a0015 100%);
    }

    canvas {
      display: block;
      position: absolute;
      top: 0;
      left: 0;
    }

    .heart-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-family: 'Ma Shan Zheng', cursive, sans-serif;
      font-size: clamp(2rem, 6vw, 5rem);
      color: #ffffff;
      text-shadow:
        0 0 10px rgba(255, 255, 255, 0.8),
        0 0 30px rgba(180, 140, 255, 0.5),
        0 0 60px rgba(120, 80, 220, 0.3);
      letter-spacing: 0.15em;
      z-index: 10;
      pointer-events: none;
      white-space: nowrap;
      opacity: 0;
      animation: textFadeIn 3s ease-out 2s forwards;
    }

    @keyframes textFadeIn {
      0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
      100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
  </style>
</head>
<body>
  <canvas id="heartCanvas"></canvas>
  <div class="heart-text">尹湘清</div>
  <script src="heart.js"></script>
</body>
</html>
```

Key points:
- Midnight blue gradient background (`#0a0015` → `#0d1b3e` → `#1a0a3c`)
- Google Font "Ma Shan Zheng" for elegant Chinese handwriting
- Canvas fills the viewport absolutely positioned
- Text overlay centered with `transform: translate(-50%, -50%)`, white with purple glow shadow
- Text fades in after 2 seconds with a scale animation
- Responsive font size using `clamp()`

- [ ] **Step 2: Verify the HTML loads correctly**

Open `D:\angent\index.html` in a browser. Confirm:
- Page loads with midnight blue gradient background
- "尹湘清" text appears centered, white with purple glow
- Text fades in smoothly after ~2 seconds
- No console errors

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "chore: scaffold HTML with canvas, gradient bg, and centered text"
```

---

### Task 2: Core heart particle engine — heart.js with parametric heart

**Files:**
- Create: `D:\angent\heart.js`

- [ ] **Step 1: Create the particle system module**

Create `D:\angent\heart.js` with the following complete content:

```javascript
/**
 * Heart Particle Animation
 * Renders a heart shape made of twinkling particles using Canvas 2D.
 * Parametric heart equation: x = 16sin³(t), y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
 */

(function () {
  'use strict';

  const canvas = document.getElementById('heartCanvas');
  const ctx = canvas.getContext('2d');

  // --- Configuration ---
  const CONFIG = {
    particleCount: 600,       // Number of particles forming the heart
    heartScale: 12,           // Size multiplier for the heart shape
    driftSpeed: 0.3,          // How fast particles drift (pixels/frame)
    driftAmplitude: 3,        // How far particles drift from center
    twinkleSpeed: 0.02,       // Speed of opacity oscillation
    twinkleRange: [0.3, 1.0], // Min/max opacity during twinkle
    colorStops: [
      { r: 70,  g: 130, b: 220 },  // Deep blue
      { r: 138, g: 70,  b: 220 },  // Purple
      { r: 200, g: 80,  b: 160 },  // Pink
      { r: 255, g: 150, b: 180 },  // Light pink
      { r: 100, g: 100, b: 200 },  // Indigo
    ],
    glowSize: 4,              // Particle glow radius
    bgColor: null,            // Computed at runtime
  };

  // --- Resize handling ---
  let width, height, centerX, centerY, heartSize;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    centerX = width / 2;
    centerY = height / 2;
    // Heart size scales with the smaller screen dimension
    heartSize = Math.min(width, height) * 0.35;
    CONFIG.heartScale = heartSize / 12;
  }

  window.addEventListener('resize', resize);
  resize();

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
  // Returns (x, y) on the heart outline for parameter t in [0, 2π]
  function heartPosition(t) {
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    return { x, y };
  }

  // --- Particle class ---
  class Particle {
    constructor() {
      this.reset();
    }

    reset() {
      // Random parameter on the heart curve [0, 2π]
      const t = Math.random() * Math.PI * 2;
      const pos = heartPosition(t);

      // Base position on heart outline, scaled
      this.baseX = pos.x * CONFIG.heartScale;
      this.baseY = pos.y * CONFIG.heartScale;

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
        const innerScale = Math.pow(Math.random(), 0.5); // Bias toward center
        this.targetX = innerPos.x * CONFIG.heartScale * innerScale;
        this.targetY = innerPos.y * CONFIG.heartScale * innerScale;
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

  // --- Create particles ---
  const particles = [];
  for (let i = 0; i < CONFIG.particleCount; i++) {
    particles.push(new Particle());
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

  const stars = [];
  for (let i = 0; i < 80; i++) {
    stars.push(new Star());
  }

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

  animate();
})();
```

Key design decisions:
- **IIFE wrapper** — no global pollution, vanilla JS compatible
- **Config object** — all tunable parameters centralized in one place
- **Parametric heart** — uses the classic equation `x = 16sin³(t)`, `y = -(13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t))`
- **Particle distribution** — 70% on outline, 30% filled inside, biased toward center for natural look
- **Color gradient** — 5-stop palette interpolated by particle angular position: deep blue → purple → pink → light pink → indigo
- **Drift** — sinusoidal wobble gives organic floating feel
- **Twinkle** — each particle oscillates opacity independently
- **Glow** — larger particles get a soft halo
- **Background stars** — 80 tiny ambient sparkles for extra atmosphere
- **Responsive** — heart scales with viewport, particles recalculate on resize

- [ ] **Step 2: Verify the animation works**

Open `D:\angent\index.html` in a browser. Confirm:
- Canvas fills the entire viewport
- A heart shape made of particles is visible in the center
- Particles drift gently and twinkle at different rates
- Colors transition from blue to purple to pink across the heart
- Small ambient stars sparkle in the background
- "尹湘清" text is visible in the center, glowing white/purple
- Everything looks smooth at 60fps (check browser DevTools Performance tab)

- [ ] **Step 3: Commit**

```bash
git add heart.js
git commit -m "feat: add heart particle animation with drifting, twinkling, and starfield"
```

---

### Task 3: Polish and final tuning

**Files:**
- Modify: `D:\angent\index.html`
- Modify: `D:\angent\heart.js`

- [ ] **Step 1: Fine-tune visual parameters**

In `heart.js`, adjust these CONFIG values based on visual inspection:
- If heart is too big/small: tweak `particleCount` (range 400–800) or the `heartSize` calculation
- If colors are too bright/dark: adjust the `colorStops` RGB values
- If drift is too subtle/strong: adjust `driftSpeed` and `driftAmplitude`
- If twinkle is too fast/slow: adjust `twinkleSpeed`

Also in `index.html`, adjust the text shadow in `.heart-text`:
- Increase/decrease `text-shadow` blur radius for stronger/weaker glow
- Adjust `animation-delay` if text appears too early/late

- [ ] **Step 2: Add mobile responsiveness**

In `index.html`, ensure the CSS handles small screens:
```css
@media (max-width: 600px) {
  .heart-text {
    font-size: clamp(1.5rem, 8vw, 3rem);
    letter-spacing: 0.1em;
  }
}
```

Test on various viewport sizes (use Chrome DevTools device emulation).

- [ ] **Step 3: Final verification**

Open the page in Chrome/Firefox/Safari. Confirm:
- Heart particles form a recognizable, beautiful heart shape
- Blue-purple-pink gradient flows naturally across the heart
- Particles drift and twinkle organically (not robotic)
- Text "尹湘清" is readable and elegantly centered
- Background stars add atmosphere without distraction
- Page is responsive and works on mobile viewports
- Smooth 60fps animation

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "polish: tune particle animation, add mobile responsiveness, finalize visuals"
```

---

## Testing Checklist

- [ ] Heart shape is clearly recognizable
- [ ] Color gradient spans blue → purple → pink smoothly
- [ ] Particles drift with organic, non-repetitive motion
- [ ] Twinkle effect varies per particle
- [ ] Text is centered, readable, with purple glow
- [ ] Background stars add atmosphere
- [ ] No console errors or warnings
- [ ] Works on mobile viewports (320px+)
- [ ] 60fps on modern hardware

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `index.html` | Create | Page structure, CSS styles, text overlay |
| `heart.js` | Create | Particle system, heart geometry, animation loop |
