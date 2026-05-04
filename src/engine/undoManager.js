// ============================================================
// CRYPT RAIDER — UndoManager
// Snapshot-based undo stack using Uint8Array clones.
// Stores full grid state + player position. O(1) push/pop.
// Max stack depth capped to avoid memory runaway.
// ============================================================

const MAX_UNDO = 64; // ~64 × 187 bytes = ~12 KB — negligible

/**
 * A single saved moment in time.
 * @typedef {Object} Snapshot
 * @property {Uint8Array} cells   - Clone of grid.cells
 * @property {number}     px      - Player x
 * @property {number}     py      - Player y
 * @property {boolean}    hasKey  - Player key state
 * @property {number}     hasDynamite
 * @property {number}     crystalsCollected
 * @property {number}     score
 * @property {number}     timeLeft
 * @property {boolean}    portalOpen
 */

export class UndoManager {
  constructor() {
    /** @type {Snapshot[]} */
    this._stack = [];
  }

  /** How many undo steps are currently available. */
  get size() { return this._stack.length; }

  /**
   * Capture the current game state BEFORE a move or physics chain.
   * Call this from Player._move(), Player._dig(), Player._pushBoulder(),
   * and at the start of Physics._tickGravity() when gravity causes a move.
   *
   * @param {import('./grid.js').Grid}        grid
   * @param {import('../entities/player.js').Player} player
   * @param {import('./gameSession.js').GameSession} session
   */
  snapshot(grid, player, session) {
    // Evict oldest if at cap — shift is O(n) but stack is tiny (≤64)
    if (this._stack.length >= MAX_UNDO) this._stack.shift();

    this._stack.push({
      cells:             grid.cells.slice(), // Uint8Array.prototype.slice() = typed clone
      px:                player.x,
      py:                player.y,
      hasKey:            player.hasKey,
      hasDynamite:       player.hasDynamite,
      crystalsCollected: session.crystalsCollected,
      score:             session.score,
      timeLeft:          session.timeLeft,
      portalOpen:        session.portalOpen,
    });
  }

  /**
   * Pop the most recent snapshot and restore it.
   * Returns true if a restore happened, false if the stack was empty.
   *
   * @param {import('./grid.js').Grid}              grid
   * @param {import('../entities/player.js').Player} player
   * @param {import('./gameSession.js').GameSession} session
   */
  restore(grid, player, session) {
    if (this._stack.length === 0) return false;

    const snap = this._stack.pop();

    // ── Restore grid cells ──────────────────────────────────
    grid.cells.set(snap.cells);

    // Wipe all meta so no stale fall-anim or TTL state lingers
    grid.meta.fill(null);

    // Force a full redraw
    grid.fullClearRequested = true;
    grid.dirtyCells.fill(0); // works for Uint8Array dirty-field (upgrade 4)

    // ── Restore player ──────────────────────────────────────
    player.x              = snap.px;
    player.y              = snap.py;
    player.hasKey         = snap.hasKey;
    player.hasDynamite    = snap.hasDynamite;
    player.alive          = true;
    player._falling       = false;
    player._fallCount     = 0;
    player._moveTimer     = 0;
    player.bombX          = null;
    player.bombY          = null;

    // ── Restore session counters ────────────────────────────
    session.crystalsCollected = snap.crystalsCollected;
    session.score             = snap.score;
    session.timeLeft          = snap.timeLeft;

    // Re-sync portal state without triggering audio side-effects
    if (!snap.portalOpen && session.portalOpen) {
      // Portal was opened in the undone move — close it again.
      session.portalOpen = false;
      const portals = grid.findAll(17); // TILE.PORTAL_OPEN
      portals.forEach(({ x, y }) => {
        grid.cells[grid.idx(x, y)] = 7; // TILE.PORTAL
      });
      // Deactivate machines
      grid.findAll(8).forEach(({ x, y }) => { // TILE.MACHINE
        const i = grid.idx(x, y);
        grid.meta[i] = null;
      });
      if (session._machinesDirtyInterval) {
        clearInterval(session._machinesDirtyInterval);
        session._machinesDirtyInterval = null;
      }
    }

    // Clear any pending physics deferred actions (explosion timers etc.)
    if (session.physics) session.physics._pending.length = 0;

    // Flush effect queue — particles/explosions from the undone step vanish
    session.effects = [];

    return true;
  }

  /** Discard the whole stack (call on level load / game-over). */
  clear() {
    this._stack.length = 0;
  }
}
