// ============================================================
// CRYPT RAIDER v2 — Input System (CLEAN ECS VERSION)
// ============================================================
//
// ROLE:
// Pure input acquisition layer ONLY.
// No gameplay rules. No state interpretation.
// Emits raw commands to ECS systems.
//

import { DIR } from '../engine/constants.js';

// ── Tuning constants ──────────────────────────────────────
const DIR_QUEUE_MAX = 6;
const DIR_QUEUE_TTL  = 400;

// ──────────────────────────────────────────────────────────
// Input System
// ──────────────────────────────────────────────────────────
export class InputSystem {
  constructor(canvas, eventBus = null) {
    this.canvas   = canvas;
    this.events   = eventBus;

    // ── Public command buffer (consumed per frame) ───────
    this.commands = []; // { type: 'move'|'bomb'|'pause'|'confirm', value?, ts }

    // ── internal state ───────────────────────────────────
    this._keys     = new Set();
    this._dirQueue = [];

    this._lastTap  = { x: 0, y: 0 };

    this._ptId     = null;
    this._ptStart  = null;

    // lock browser gestures
    canvas.style.touchAction = 'none';
    canvas.style.userSelect  = 'none';

    this._init();
  }

  // ──────────────────────────────────────────────────────────
  // Core emit (ECS-friendly)
  // ──────────────────────────────────────────────────────────
  _emit(type, value = null) {
    const cmd = { type, value, ts: performance.now() };
    this.commands.push(cmd);
    this.events?.emit?.('input', cmd);
  }

  // ──────────────────────────────────────────────────────────
  // Init
  // ──────────────────────────────────────────────────────────
  _init() {
    if (window.PointerEvent) this._pointer();
    else this._touch();

    window.addEventListener('keydown', e => {
      this._keys.add(e.code);

      if (e.code === 'Space' || e.code === 'KeyB') this._emit('bomb');
      if (e.code === 'Escape' || e.code === 'KeyP') this._emit('pause');
      if (e.code === 'Enter') this._emit('confirm');

      e.preventDefault();
    });

    window.addEventListener('keyup', e => this._keys.delete(e.code));
  }

  // ──────────────────────────────────────────────────────────
  // POINTER
  // ──────────────────────────────────────────────────────────
  _pointer() {
    const el = this.canvas;

    el.addEventListener('pointerdown', e => {
      if (this._ptId !== null) return;

      this._ptId = e.pointerId;
      this._ptStart = { x: e.clientX, y: e.clientY };

      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointerup', e => {
      if (e.pointerId !== this._ptId) return;

      const dx = e.clientX - this._ptStart.x;
      const dy = e.clientY - this._ptStart.y;

      this._handleSwipe(dx, dy);
      this._handleTap(e.clientX, e.clientY);

      this._reset();
    });

    el.addEventListener('pointercancel', () => this._reset());
    el.addEventListener('pointerleave', e => {
      if (this._ptStart) this._reset();
    });
  }

  // ──────────────────────────────────────────────────────────
  // TOUCH fallback
  // ──────────────────────────────────────────────────────────
  _touch() {
    const el = this.canvas;

    el.addEventListener('touchstart', e => {
      const t = e.changedTouches[0];
      this._ptStart = { x: t.clientX, y: t.clientY };
    });

    el.addEventListener('touchend', e => {
      const t = e.changedTouches[0];

      const dx = t.clientX - this._ptStart.x;
      const dy = t.clientY - this._ptStart.y;

      this._handleSwipe(dx, dy);
      this._handleTap(t.clientX, t.clientY);

      this._reset();
    });
  }

  // ──────────────────────────────────────────────────────────
  // Gesture interpretation (NO game logic here)
  // ──────────────────────────────────────────────────────────
  _handleSwipe(dx, dy) {
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    if (Math.max(adx, ady) < 6) return;

    let dir =
      adx > ady
        ? (dx > 0 ? DIR.RIGHT : DIR.LEFT)
        : (dy > 0 ? DIR.DOWN : DIR.UP);

    this._pushDir(dir);
    this._emit('move', dir);
  }

  _handleTap(x, y) {
    this._lastTap = { x, y };
    this._emit('tap', { x, y });
  }

  _pushDir(dir) {
    const now = performance.now();

    this._dirQueue = this._dirQueue.filter(d => now - d.ts < DIR_QUEUE_TTL);

    if (this._dirQueue.length >= DIR_QUEUE_MAX) this._dirQueue.shift();

    this._dirQueue.push({ dir, ts: now });
  }

  _reset() {
    this._ptId = null;
    this._ptStart = null;
  }

  // ──────────────────────────────────────────────────────────
  // ECS polling API (kept for compatibility)
  // ──────────────────────────────────────────────────────────
  pollDir() {
    const k = this._keys;

    if (k.has('ArrowUp') || k.has('KeyW')) return DIR.UP;
    if (k.has('ArrowDown') || k.has('KeyS')) return DIR.DOWN;
    if (k.has('ArrowLeft') || k.has('KeyA')) return DIR.LEFT;
    if (k.has('ArrowRight') || k.has('KeyD')) return DIR.RIGHT;

    const now = performance.now();
    const entry = this._dirQueue.find(d => now - d.ts < DIR_QUEUE_TTL);

    return entry ? entry.dir : DIR.NONE;
  }

  pollCommands() {
    const out = this.commands;
    this.commands = [];
    return out;
  }

  getLastTapPosition() {
    return this._lastTap;
  }

  destroy() {
    this.commands.length = 0;
  }
}