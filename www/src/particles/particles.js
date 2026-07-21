import { DOM } from '../core/dom.js';
import { CONFIG } from '../core/config.js';
import { State } from '../core/state.js';
import { setParticlesRef } from '../modals/modal.js';

export const Particles = {
  ctx: DOM.canvas.getContext('2d'),
  items: [],
  rafId: null,

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
  },

  render() {
    // Stop rendering loop when modal is open or tab is hidden to save CPU/battery
    if (State.isModalOpen || document.hidden) {
      this.stop();
      return;
    }

    const { ctx, items } = this;
    const w = DOM.canvas.width;
    const h = DOM.canvas.height;
    const maxDistSq = CONFIG.particles.maxDistance * CONFIG.particles.maxDistance;

    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.r), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.c},${p.a})`;
      ctx.fill();

      for (let j = i + 1; j < items.length; j++) {
        const q = items[j];
        const dx = p.x - q.x, dy = p.y - q.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < maxDistSq) {
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = `rgba(56,189,248,${0.06 * (1 - distSq / maxDistSq)})`;
          ctx.lineWidth = 0.5; ctx.stroke();
        }
      }
    }
    this.rafId = requestAnimationFrame(() => this.render());
  },

  start() { if (!this.rafId) this.render(); },
  stop() { cancelAnimationFrame(this.rafId); this.rafId = null; }
};

// Register Particles with the modal module so openModal/closeModal can stop/start it
setParticlesRef(Particles);
