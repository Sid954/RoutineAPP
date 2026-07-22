import { DOM } from '../core/dom.js';
import { CONFIG } from '../core/config.js';
import { State } from '../core/state.js';
import { setParticlesRef } from '../modals/modal.js';

export const Particles = {
  ctx: DOM.canvas.getContext('2d'),
  items: [],
  rafId: null,
  _lastFrameTime: 0,
  _touchPaused: false,
  _touchResumeTimer: null,

  init() {
    DOM.canvas.width = window.innerWidth;
    DOM.canvas.height = window.innerHeight;
    this.items = [];
    const count = window.innerWidth < 500 ? CONFIG.particles.countMobile : CONFIG.particles.countDesktop;
    for (let i = 0; i < count; i++) {
      this.items.push({
        x: Math.random() * DOM.canvas.width,
        y: Math.random() * DOM.canvas.height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.5 + 0.5,
        c: CONFIG.particles.colors[Math.floor(Math.random() * CONFIG.particles.colors.length)],
        a: Math.random() * 0.35 + 0.08
      });
    }
    this._bindTouchPause();
  },

  // Auto-pause during touch/scroll to free main thread for UI animations
  _bindTouchPause() {
    const pause = () => {
      if (this._touchResumeTimer) clearTimeout(this._touchResumeTimer);
      if (!this._touchPaused && this.rafId) {
        this._touchPaused = true;
        this.stop();
      }
    };
    const resume = () => {
      this._touchResumeTimer = setTimeout(() => {
        this._touchPaused = false;
        if (!State.isModalOpen && !document.hidden) this.start();
      }, 300);
    };
    window.addEventListener('touchstart', pause, { passive: true });
    window.addEventListener('touchmove', pause, { passive: true });
    window.addEventListener('touchend', resume, { passive: true });
    window.addEventListener('touchcancel', resume, { passive: true });
  },

  render(timestamp) {
    // Stop rendering loop when modal is open, tab is hidden, or touch-paused
    if (State.isModalOpen || document.hidden || this._touchPaused) {
      this.stop();
      return;
    }

    const { ctx, items } = this;
    const w = DOM.canvas.width;
    const h = DOM.canvas.height;
    const maxDistSq = CONFIG.particles.maxDistance * CONFIG.particles.maxDistance;

    // Frame-skip: measure delta time, skip line drawing if FPS < 50
    const dt = timestamp - this._lastFrameTime;
    this._lastFrameTime = timestamp;
    const skipLines = dt > 20; // frame took >20ms = below 50fps

    ctx.clearRect(0, 0, w, h);

    // Batch all particle dots into one path per color group
    const colorGroups = {};
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;

      const key = `${p.c},${p.a}`;
      if (!colorGroups[key]) colorGroups[key] = [];
      colorGroups[key].push(p);
    }

    // Draw all dots batched by color (single beginPath per color)
    for (const key in colorGroups) {
      ctx.beginPath();
      const group = colorGroups[key];
      for (let i = 0; i < group.length; i++) {
        const p = group[i];
        ctx.moveTo(p.x + p.r, p.y);
        ctx.arc(p.x, p.y, Math.max(0.5, p.r), 0, Math.PI * 2);
      }
      ctx.fillStyle = `rgba(${key})`;
      ctx.fill();
    }

    // Draw connection lines in single batched stroke (skip if FPS is low)
    if (!skipLines) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(56,189,248,0.04)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < items.length; i++) {
        const p = items[i];
        for (let j = i + 1; j < items.length; j++) {
          const q = items[j];
          const dx = p.x - q.x, dy = p.y - q.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < maxDistSq) {
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
          }
        }
      }
      ctx.stroke();
    }

    this.rafId = requestAnimationFrame((t) => this.render(t));
  },

  start() { if (!this.rafId && !this._touchPaused) this.render(performance.now()); },
  stop() { cancelAnimationFrame(this.rafId); this.rafId = null; }
};

// Register Particles with the modal module so openModal/closeModal can stop/start it
setParticlesRef(Particles);
