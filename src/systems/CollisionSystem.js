// ============================================================
// CRYPT RAIDER — Collision System
// ============================================================

import { TILE } from '../engine/constants.js';
import { SCORE } from '../engine/constants.js';

export class CollisionSystem {
  constructor() {
    this.enabled = true;
  }

  update(dt, { player, grid, session, events, enemyManager }) {
    const { x, y } = player.position;
    const tile = grid.get(x, y);

    // ── Collectibles ─────────────────────────────
    if (tile === TILE.CRYSTAL) {
      grid.clear(x, y);
      session.addScore(SCORE.CRYSTAL);
      events.emit('crystal_collected', { x, y });
    }

    if (tile === TILE.KEY) {
      grid.clear(x, y);
      player.inventory.keys++;
      events.emit('key_collected', { x, y });
    }

    // ── Exit condition ───────────────────────────
    if (tile === TILE.PORTAL_OPEN) {
      events.emit('level_complete');
      session.nextLevel();
    }

    // ── Enemy collision ──────────────────────────
    enemyManager.killAt(x, y);
  }
}