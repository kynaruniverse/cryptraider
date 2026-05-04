// ============================================================
// CRYPT RAIDER — Gravity System (ECS System)
// ============================================================

import { TILE } from '../constants.js';

export class GravitySystem {
  constructor(player) {
    this.p = player;
    this.grid = player.grid;
  }

  update() {
    if (!this.p.alive) return;

    if (!this.isSupported()) {
      this.p.onFallStart();
      this.stepFall();
    }
  }

  evaluate() {
    if (this.isSupported()) {
      this.p.physics.falling = false;
    }
  }

  isSupported() {
    const x = this.p.x;
    const y = this.p.y;

    if (this.grid.isClimbable(x, y)) return true;

    const ny = y + 1;

    if (!this.grid.inBounds(x, ny)) return true;

    const below = this.grid.get(x, ny);

    return below !== TILE.EMPTY;
  }

  stepFall() {
    const x = this.p.x;
    const y = this.p.y + 1;

    if (!this.grid.inBounds(x, y)) {
      this.land();
      return;
    }

    const tile = this.grid.get(x, y);

    if (tile === TILE.EMPTY) {
      this.p.onFallStep();
      this.grid.moveEntity(this.p.x, this.p.y, x, y);
      this.p.onMove(x, y, this.p.dir);
      return;
    }

    if (tile === TILE.LADDER) {
      this.grid.set(this.p.x, this.p.y, TILE.LADDER);
      this.p.x = x;
      this.p.y = y;
      this.land();
      return;
    }

    this.land();
  }

  land() {
    const count = this.p.physics.fallCount;

    this.p.onLand(count);
  }
}