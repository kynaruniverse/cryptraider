// ============================================================
// CRYPT RAIDER v2 — Input System  ·  ELITE REWRITE
// ============================================================
//
// Design philosophy
// ─────────────────
// Most swipe systems read start→end displacement. That's wrong
// for games. What the player *intends* is encoded in the first
// 8-15ms of finger motion, not the full arc. A fast flick lifts
// before 3 pointermove events have fired. A slow deliberate push
// generates 20+ events but should still register cleanly.
//
// This system runs TWO parallel recognisers every move event:
//
//   1. VELOCITY recogniser  — reads instantaneous speed from a
//      rolling 3-sample window. Fires direction the moment speed
//      exceeds FLICK_VEL_PX_MS (0.45 px/ms). Catches fast flicks
//      before they have enough displacement to trip the other one.
//      Direction read from velocity vector, not displacement,
//      which is more accurate for diagonal-drifting fast flicks.
//
//   2. DISPLACEMENT recogniser — axis-lock on raw distance.
//      Fires when one axis exceeds LOCK_THRESHOLD (10px). Catches
//      slow deliberate pushes that never build speed.
//
//   Whichever fires first wins. Once committed (_ptCommitted),
//   the other is ignored for that stroke.
//
// Other improvements over previous version
// ─────────────────────────────────────────
//  ✔ Instant axis commit — lock + emit happen in ONE event,
//    not split across two (the old version had a dead frame)
//  ✔ Velocity-weighted cooldown — fast flicks: 60ms cooldown;
//    slow pushes: 140ms. Expert players can queue rapid moves.
//  ✔ Stale queue expiry — queued directions older than 400ms
//    are silently dropped; no phantom moves after a pause
//  ✔ Haptic pulse on swipe (18ms) and bomb (45ms) via
//    Vibration API — no-op everywhere it's unsupported
//  ✔ State-aware single tap — 'confirm' only fires when the
//    provided stateGetter() returns something other than PLAYING,
//    preventing accidental menu triggers during gameplay
//  ✔ pointerleave treated as stroke-end (not a zero-dist tap)
//    so dragging off canvas edge still registers the swipe
//  ✔ Pointer Events primary, Touch Events automatic fallback
//  ✔ touch-action + user-select locked in JS, not just CSS
//  ✔ Keyboard unchanged for desktop / hardware keyboard
// ============================================================

import { DIR } from '../engine/constants.js';

// ── Tuning constants ──────────────────────────────────────
const LOCK_THRESHOLD   = 6;     // PRO FIX: More sensitive initial movement
const FLICK_VEL_PX_MS  = 0.25;  // PRO FIX: Lower threshold for "flick" detection
const VEL_WINDOW       = 3;     
const SWIPE_MIN_DIST   = 4;     // PRO FIX: Register tiny swipes
const SWIPE_MAX_TIME   = 700;   
const DOUBLE_TAP_MS    = 280;   
const TAP_MAX_DIST     = 12;    
const COOLDOWN_FAST    = 40;    // Allow faster successive moves on flicks
const COOLDOWN_SLOW    = 125;   // MUST be >= PLAYER_MOVE_INTERVAL_MS (120ms) — if lower,
                                // a queued swipe is consumed before the player move timer
                                // has elapsed and the move is silently dropped.

const DIR_QUEUE_MAX    = 6;     // entries  — max buffered directions
const DIR_QUEUE_TTL    = 400;   // ms       — discard entries older than this
const HAPTIC_SWIPE_MS  = 18;    // ms       — vibration on swipe
const HAPTIC_BOMB_MS   = 45;    // ms       — vibration on bomb

export class InputSystem {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {() => string} [stateGetter]
   *   Optional callback returning the current game STATE string.
   *   Used to prevent single-tap 'confirm' firing during gameplay.
   */
  constructor(canvas, stateGetter = null) {
    this.canvas      = canvas;
    this.stateGetter = stateGetter;

    // ── Public ────────────────────────────────────────────
    this.action = null; // 'bomb' | 'pause' | 'confirm'

    // ── Private ───────────────────────────────────────────
    this._keys         = new Set();
    this._dirQueue     = [];       // { dir, ts } timestamped entries
    this._lastTapPos   = { x: 0, y: 0 }; // Normalized 0.0 - 1.0
    this._lastSwipeAt  = 0;
    this._lastVelocity = 0;        // speed of last committed swipe (px/ms)

    // Active stroke
    this._ptId         = null;     // pointerId or touch identifier
    this._ptStart      = null;     // { x, y, time } in CSS px
    this._ptAxis       = null;     // 'h' | 'v' once locked
    this._ptCommitted  = false;

    // Velocity rolling window: [{ x, y, t }, ...]
    this._velSamples   = [];

    // Double-tap state machine
    this._tapState     = 'idle';   // 'idle' | 'one'
    this._tapTimer     = null;

    // Lock browser gestures on the canvas
    canvas.style.touchAction      = 'none';
    canvas.style.userSelect       = 'none';
    canvas.style.webkitUserSelect = 'none';

    this._init();
  }

  // ──────────────────────────────────────────────────────────
  //  Utility
  // ──────────────────────────────────────────────────────────

  _dist(ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
  }

  _haptic(ms) {
    try { navigator.vibrate?.(ms); } catch (_) {}
  }

  // Instantaneous velocity vector from rolling sample window
  _computeVelocity() {
    const s = this._velSamples;
    if (s.length < 2) return { vx: 0, vy: 0, speed: 0 };
    const a  = s[0], b = s[s.length - 1];
    const dt = b.t - a.t;
    if (dt <= 0) return { vx: 0, vy: 0, speed: 0 };
    const vx    = (b.x - a.x) / dt;
    const vy    = (b.y - a.y) / dt;
    return { vx, vy, speed: Math.sqrt(vx * vx + vy * vy) };
  }

  // ──────────────────────────────────────────────────────────
  //  Init
  // ──────────────────────────────────────────────────────────

  _init() {
    if (window.PointerEvent) {
      this._initPointerEvents();
    } else {
      this._initTouchEvents();
    }

    window.addEventListener('keydown', e => {
      this._keys.add(e.code);
      if (e.code === 'Space' || e.code === 'KeyB') {
        this._emitAction('bomb');
        e.preventDefault();
      }
      if (e.code === 'Escape' || e.code === 'KeyP') this._emitAction('pause');
      if (e.code === 'Enter')                        this._emitAction('confirm');
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))
        e.preventDefault();
    });
    window.addEventListener('keyup', e => this._keys.delete(e.code));
  }

  // ──────────────────────────────────────────────────────────
  //  Core move processor — called on every pointermove/touchmove
  //  Returns true if a direction was committed this call.
  // ──────────────────────────────────────────────────────────
  _processMove(cx, cy) {
    if (!this._ptStart || this._ptCommitted) return false;

    const now = Date.now();

    // Feed velocity window
    this._velSamples.push({ x: cx, y: cy, t: now });
    if (this._velSamples.length > VEL_WINDOW) this._velSamples.shift();

    const dx  = cx - this._ptStart.x;
    const dy  = cy - this._ptStart.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    // ── RECOGNISER 1 : Velocity (fast flick) ──────────────
    const { vx, vy, speed } = this._computeVelocity();
    if (speed >= FLICK_VEL_PX_MS) {
      const cooldown = speed > FLICK_VEL_PX_MS * 1.5 ? COOLDOWN_FAST : COOLDOWN_SLOW;
      
      if (now - this._lastSwipeAt >= cooldown) {
        const avx = Math.abs(vx), avy = Math.abs(vy);
        let dir = null;

        // PRO FIX: Reduced bias (1.1) and removed the 'dist > 4' hard-gate for velocities.
        // If the finger is moving fast enough, the intent is clear regardless of distance.
        if (avx > avy * 1.1) {
          dir = vx > 0 ? DIR.RIGHT : DIR.LEFT;
        } else if (avy > avx * 1.1) {
          dir = vy > 0 ? DIR.DOWN : DIR.UP;
        }

        if (dir) {
          this._commitDir(dir, speed, now);
          return true;
        }
      }
    }


    // ── RECOGNISER 2 : Displacement (slow deliberate push) ─
    // Axis lock + emit in a SINGLE step — no dead frame between events
    if (!this._ptAxis) {
      if (adx < LOCK_THRESHOLD && ady < LOCK_THRESHOLD) return false;
      this._ptAxis = adx >= ady ? 'h' : 'v';
    }
    const onAxis = this._ptAxis === 'h' ? adx : ady;
    if (onAxis < LOCK_THRESHOLD) return false;
    if (now - this._lastSwipeAt < COOLDOWN_SLOW) return false;

    const dir = this._ptAxis === 'h'
      ? (dx > 0 ? DIR.RIGHT : DIR.LEFT)
      : (dy > 0 ? DIR.DOWN  : DIR.UP);
    this._commitDir(dir, speed, now);
    return true;
  }

  _commitDir(dir, speed, now) {
    this._emitDir(dir);
    this._ptCommitted  = true;
    this._lastSwipeAt  = now;
    this._lastVelocity = speed;
    this._haptic(HAPTIC_SWIPE_MS);
  }

  // ──────────────────────────────────────────────────────────
  //  Stroke end processor
  //  isLeave = true when pointer left canvas (not a clean lift)
  // ──────────────────────────────────────────────────────────
  _processEnd(ex, ey, isLeave) {
    const start     = this._ptStart;
    const committed = this._ptCommitted;
    if (!start) return;

    const dx   = ex - start.x;
    const dy   = ey - start.y;
    const dt   = Date.now() - start.time;
    const dist = this._dist(start.x, start.y, ex, ey);

    start.endX = ex;
    start.endY = ey;

    if (isLeave) {
      if (!committed && dist >= SWIPE_MIN_DIST && dt <= SWIPE_MAX_TIME) {
        const now = Date.now();
        if (now - this._lastSwipeAt >= COOLDOWN_SLOW) {
          const adx = Math.abs(dx), ady = Math.abs(dy);
          const dir = adx >= ady ? (dx > 0 ? DIR.RIGHT : DIR.LEFT) : (dy > 0 ? DIR.DOWN : DIR.UP);
          this._commitDir(dir, 0, now);
        }
      }
      this._resetStrokeState();
      return;
    }

    if (dist < TAP_MAX_DIST) {
      this._handleTap();
    } else if (!committed && dist >= SWIPE_MIN_DIST && dt <= SWIPE_MAX_TIME) {
      const now = Date.now();
      if (now - this._lastSwipeAt >= COOLDOWN_SLOW) {
        const adx = Math.abs(dx), ady = Math.abs(dy);
        const dir = adx >= ady ? (dx > 0 ? DIR.RIGHT : DIR.LEFT) : (dy > 0 ? DIR.DOWN : DIR.UP);
        this._commitDir(dir, 0, now);
      }
    }

    this._resetStrokeState();
  }

  _resetStrokeState() {
    this._ptId        = null;
    this._ptStart     = null;
    this._ptAxis      = null;
    this._ptCommitted = false;
    this._velSamples  = [];
  }


  // ──────────────────────────────────────────────────────────
  //  POINTER EVENTS  (primary — Android Chrome 57+, all modern)
  // ──────────────────────────────────────────────────────────
  _initPointerEvents() {
    const el = this.canvas;

    el.addEventListener('pointerdown', e => {
      if (this._ptId !== null) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      this._ptId        = e.pointerId;
      this._ptStart     = { x: e.clientX, y: e.clientY, time: Date.now() };
      this._ptAxis      = null;
      this._ptCommitted = false;
      this._velSamples  = [{ x: e.clientX, y: e.clientY, t: Date.now() }];

      el.setPointerCapture(e.pointerId);
      e.preventDefault();
    }, { passive: false });

    el.addEventListener('pointermove', e => {
      if (e.pointerId !== this._ptId) return;
      e.preventDefault();
      this._processMove(e.clientX, e.clientY);
    }, { passive: false });

    el.addEventListener('pointerup', e => {
      if (e.pointerId !== this._ptId) return;
      e.preventDefault();
      this._processEnd(e.clientX, e.clientY, false);
    }, { passive: false });

    // Cancel = browser took over (e.g. screenshot gesture, notification swipe)
    // Still extract direction if possible
    el.addEventListener('pointercancel', e => {
      if (e.pointerId !== this._ptId) return;
      this._processEnd(e.clientX, e.clientY, true);
    }, { passive: false });

    // Leave = finger dragged off canvas edge — not a tap
    el.addEventListener('pointerleave', e => {
      if (e.pointerId !== this._ptId || !this._ptStart) return;
      this._processEnd(e.clientX, e.clientY, true);
    }, { passive: false });
  }

  // ──────────────────────────────────────────────────────────
  //  TOUCH EVENTS  (fallback — older Android WebViews)
  // ──────────────────────────────────────────────────────────
  _initTouchEvents() {
    const el = this.canvas;

    el.addEventListener('touchstart', e => {
      if (this._ptId !== null) return;
      const t = e.changedTouches[0];
      this._ptId        = t.identifier;
      this._ptStart     = { x: t.clientX, y: t.clientY, time: Date.now() };
      this._ptAxis      = null;
      this._ptCommitted = false;
      this._velSamples  = [{ x: t.clientX, y: t.clientY, t: Date.now() }];
      e.preventDefault();
    }, { passive: false });

    // CRITICAL: preventDefault here stops Android Chrome from issuing
    // touchcancel the moment it suspects a scroll gesture.
    // Without this, fast up/down swipes vanish silently.
    el.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = Array.from(e.changedTouches).find(c => c.identifier === this._ptId);
      if (!t) return;
      this._processMove(t.clientX, t.clientY);
    }, { passive: false });

    const onEnd = (e, isCancel) => {
      const t = Array.from(e.changedTouches).find(c => c.identifier === this._ptId);
      if (!t) return;
      e.preventDefault();
      this._processEnd(t.clientX, t.clientY, isCancel);
    };

    el.addEventListener('touchend',    e => onEnd(e, false), { passive: false });
    el.addEventListener('touchcancel', e => onEnd(e, true),  { passive: false });
  }

  // ──────────────────────────────────────────────────────────
  //  DOUBLE-TAP STATE MACHINE
  //
  //  idle ──[tap]──▶ one ──[2nd tap < DOUBLE_TAP_MS]──▶ idle + bomb
  //                      ──[timer expires]─────────────▶ idle + confirm
  //
  //  Single tap fires 'confirm' only when stateGetter() ≠ 'PLAYING'
  //  (prevents accidental menu triggers during active gameplay)
  // ──────────────────────────────────────────────────────────
  _handleTap() {
    const state = typeof this.stateGetter === 'function' ? this.stateGetter() : null;

    // IF WE ARE IN A MENU: Trigger confirm immediately and stop.
    // We don't want to wait for double-tap logic in the menu.
    if (state !== 'PLAYING') {
      const start = this._ptStart;
      if (start) {
        const rect = this.canvas.getBoundingClientRect();
        // Use the release position (endX) for more accurate button clicking
        const tapX = (start.endX !== undefined ? start.endX : start.x);
        const tapY = (start.endY !== undefined ? start.endY : start.y);
        
        this.setLastTapPosition(
          (tapX - rect.left) / rect.width,
          (tapY - rect.top) / rect.height
        );
      }
      this._emitAction('confirm');
      this._tapState = 'idle';
      return; 
    }

    // IF WE ARE PLAYING: Standard Double-tap vs Single-tap logic
    if (this._tapState === 'idle') {
      this._tapState = 'one';
      
      const start = this._ptStart;
      if (start) {
        const rect = this.canvas.getBoundingClientRect();
        this.setLastTapPosition(
          (start.x - rect.left) / rect.width,
          (start.y - rect.top) / rect.height
        );
      }

      this._tapTimer = setTimeout(() => {
        this._tapState = 'idle';
        this._tapTimer = null;
        // In playing state, a single tap doesn't do much, 
        // but we keep the timer for the double-tap window.
      }, DOUBLE_TAP_MS);

    } else {
      // Double-tap = bomb (Only works while playing)
      clearTimeout(this._tapTimer);
      this._tapTimer = null;
      this._tapState = 'idle';
      this._emitAction('bomb');
      this._haptic([HAPTIC_BOMB_MS, 30, HAPTIC_BOMB_MS]); 
    }
  }


  // ──────────────────────────────────────────────────────────
  //  Emit helpers
  // ──────────────────────────────────────────────────────────

  _emitDir(dir) {
    const now = Date.now();
    // Drop stale head entries (shift is O(n) but queue max is 6 — acceptable;
    // keep for clarity over a ring buffer given the tiny fixed size).
    while (this._dirQueue.length > 0 && now - this._dirQueue[0].ts > DIR_QUEUE_TTL) {
      this._dirQueue.shift();
    }
    // Evict oldest if at capacity before pushing.
    if (this._dirQueue.length >= DIR_QUEUE_MAX) this._dirQueue.shift();
    // Reuse a pooled entry object to avoid per-swipe allocation.
    if (!this._dirEntryPool) this._dirEntryPool = Array.from({ length: DIR_QUEUE_MAX }, () => ({ dir: null, ts: 0 }));
    const entry = this._dirEntryPool[this._dirQueue.length] || { dir: null, ts: 0 };
    entry.dir = dir;
    entry.ts  = now;
    this._dirQueue.push(entry);
  }

  _emitAction(a) {
    this.action = a;
  }

  // External trigger (e.g. UI overlay tap in main.js)
  triggerAction(a) { this.action = a; }

  /** Sets normalized tap coordinates (called by main.js) */
  setLastTapPosition(x, y) {
    this._lastTapPos.x = x;
    this._lastTapPos.y = y;
  }

  /** Gets the last tap coordinates for menu hit-testing */
  getLastTapPosition() {
    return this._lastTapPos;
  }

  // ──────────────────────────────────────────────────────────
  //  POLL API  (called every game loop frame)
  // ──────────────────────────────────────────────────────────

  pollDir() {
    // 1. Keyboard priority (for PC/Laptop users)
    const k = this._keys;
    if (k.has('ArrowUp')    || k.has('KeyW')) return DIR.UP;
    if (k.has('ArrowDown')  || k.has('KeyS')) return DIR.DOWN;
    if (k.has('ArrowLeft')  || k.has('KeyA')) return DIR.LEFT;
    if (k.has('ArrowRight') || k.has('KeyD')) return DIR.RIGHT;

    // 2. Consume swipe queue
    const now = Date.now();
    while (this._dirQueue.length > 0) {
      const entry = this._dirQueue.shift();
      // Drop inputs if they've been sitting in the buffer too long
      if (now - entry.ts <= DIR_QUEUE_TTL) {
        return entry.dir;
      }
    }

    return DIR.NONE;
  }


  pollAction() {
    const a = this.action;
    this.action = null;
    return a;
  }

  destroy() {
    if (this._tapTimer) clearTimeout(this._tapTimer);
  }
}
