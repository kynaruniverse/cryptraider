// ============================================================
// CRYPT RAIDER — Player Entity (PURE ECS DATA)
// Single source of truth
// ============================================================

import { TILE, DIR, CONFIG } from '../engine/constants.js';

export function createPlayerEntity(grid) {
  const start = grid.findFirst(TILE.PLAYER);

  return {
    // ── Identity ─────────────────────────────
    id: 'player',

    // ── Position Component ───────────────────
    position: {
      x: start?.x ?? 1,
      y: start?.y ?? 1
    },

    previousPosition: {
      x: start?.x ?? 1,
      y: start?.y ?? 1
    },

    direction: DIR.DOWN,

    // ── Movement Intent (InputSystem writes here) ──
    intent: {
      moveX: 0,
      moveY: 0,
      action: null
    },

    // ── Physics Component ─────────────────────
    physics: {
      falling: false,
      fallProgress: 0,
      grounded: true
    },

    // ── Gameplay Stats ────────────────────────
    energy: CONFIG.MAX_ENERGY,
    alive: true,

    // ── Inventory ─────────────────────────────
    inventory: {
      dynamite: 0,
      keys: 0
    },

    // ── Bomb State ────────────────────────────
    bomb: {
      x: null,
      y: null,
      armed: false,
      timer: 0
    },

    // ── Dirty Flags (ECS optimization) ───────
    dirty: {
      position: true,
      physics: true,
      render: true
    }
  };
}