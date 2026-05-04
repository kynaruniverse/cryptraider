// ============================================================
// CRYPT RAIDER — Snapshot System
// Captures full simulation state per frame
// ============================================================

export class SnapshotSystem {
  constructor(frameBuffer) {
    this.buffer = frameBuffer;
  }

  capture(dt, context) {
    const { grid, player, session, enemyManager } = context;

    const frame = {
      t: performance.now(),

      player: {
        x: player.position.x,
        y: player.position.y,
        energy: player.energy,
        alive: player.alive,
        dynamite: player.inventory.dynamite,
        keys: player.inventory.keys
      },

      session: {
        score: session.score,
        level: session.currentLevel
      },

      enemies: enemyManager.enemies.map(e => ({
        x: e.x,
        y: e.y,
        type: e.type,
        alive: e.alive
      })),

      grid: grid.cells.slice() // snapshot of world
    };

    this.buffer.push(frame);
  }
}