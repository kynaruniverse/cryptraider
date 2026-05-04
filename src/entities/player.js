// ============================================================
// CRYPT RAIDER — Player Entity (ECS Root State Only)
// ============================================================

import { TILE, DIR, CONFIG } from '../engine/constants.js';
import { MovementResolver } from '../systems/MovementResolver.js';
import { GravitySystem } from '../systems/GravitySystem.js';

export class Player {
  constructor(grid, eventBus, session = null) {
    this.grid = grid;
    this.events = eventBus;
    this.session = session;

    // ── Systems ─────────────────────────────
    this.movement = new MovementResolver(this);
    this.gravity = new GravitySystem(this);

    // ── Input buffer (pure intent model) ────
    this.intent = null;

    this.reset();
  }

  reset() {
    const start = this.grid.findFirst(TILE.PLAYER);

    this.x = start ? start.x : 1;
    this.y = start ? start.y : 1;

    this.dir = DIR.DOWN;

    this.energy = CONFIG.MAX_ENERGY;
    this.alive = true;

    this.hasDynamite = 0;
    this.hasKey = false;

    this.bombX = null;
    this.bombY = null;

    // ECS-owned physics state
    this.physics = {
      falling: false,
      fallCount: 0
    };

    this.grid.set(this.x, this.y, TILE.PLAYER);
  }

  applyIntent(intent) {
    this.intent = intent;
  }

  update(dt) {
    if (!this.alive) return;

    // 1. Gravity system always runs first
    this.gravity.update(dt);

    // 2. If falling → movement locked
    if (this.physics.falling) return;

    // 3. Consume intent
    const intent = this.intent;
    this.intent = null;

    if (!intent?.move) return;

    this.movement.resolve(intent);
  }

  // ─────────────────────────────
  // SYSTEM CALLBACKS (used by systems)
  // ─────────────────────────────

  onMove(x, y, dir) {
    this.x = x;
    this.y = y;
    this.dir = dir;

    this.events.emit('player_moved', { x, y, dir });
  }

  onFallStep() {
    this.physics.fallCount++;
  }

  onLand(fallCount) {
    this.physics.falling = false;
    this.physics.fallCount = 0;

    if (fallCount > CONFIG.SAFE_FALL_TILES) {
      this.die('fall');
    }
  }

  onFallStart() {
    this.physics.falling = true;
  }

  onHit() {
    this.energy -= CONFIG.ENERGY_LOSS;

    this.events.emit('player_hit', { energy: this.energy });

    if (this.energy <= 0) this.die('damage');
  }

  die(reason = 'unknown') {
    if (!this.alive) return;

    this.alive = false;

    this.grid.set(
      this.x,
      this.y,
      this.grid.isClimbable(this.x, this.y) ? TILE.LADDER : TILE.EMPTY
    );

    this.events.emit('player_died', {
      x: this.x,
      y: this.y,
      reason
    });
  }

  crush() {
    this.die('crush');
  }
}