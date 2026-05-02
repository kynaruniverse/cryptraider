// ============================================================
// CRYPT RAIDER — Evolved Elite Physics System
// ============================================================

import { TILE, GRAVITY_INTERVAL_MS } from './constants.js';

export class Physics {
  constructor(grid, eventBus) {
    this.grid      = grid;
    this.events    = eventBus;
    this._elapsed  = 0;
    // Pending deferred actions — drained each update() instead of using setTimeout.
    // Each entry: { delay: ms remaining, fn: () => void }
    this._pending        = [];
    this._processedSet   = new Set(); // pre-allocated; cleared each gravity tick

    // Define "Rules" for how tiles respond to impact
    this.impactRules = {
      [TILE.PLAYER]: (tx, ty, fallingType) => {
        // Only kill the player if the falling object is a BOULDER (Weighted Physics)
        if (fallingType === TILE.BOULDER) {
          this.events.emit('player_crushed', { x: tx, y: ty });
        }
      },

      [TILE.ENEMY_M]: (tx, ty) => this.events.emit('enemy_crushed', { x: tx, y: ty, type: TILE.ENEMY_M }),
      [TILE.ENEMY_F]: (tx, ty) => this.events.emit('enemy_crushed', { x: tx, y: ty, type: TILE.ENEMY_F }),
      [TILE.DYNAMITE]: (tx, ty) => this.explode(tx, ty, 2)
    };
  }

  update(dt) {
    // Drain pending deferred actions (replaces setTimeout)
    for (let i = this._pending.length - 1; i >= 0; i--) {
      this._pending[i].delay -= dt;
      if (this._pending[i].delay <= 0) {
        this._pending[i].fn();
        this._pending.splice(i, 1);
      }
    }

    this._elapsed += dt;
    if (this._elapsed >= GRAVITY_INTERVAL_MS) {
      this._elapsed = 0;
      this._tickGravity();
    }
  }

  _defer(fn, delayMs) {
    this._pending.push({ delay: delayMs, fn });
  }

  /**
   * Main Gravity Loop: Processes the grid from bottom to top
   * to ensure stable falling and prevent clumping.
   */
  _tickGravity() {
    const { rows, cols } = this.grid;
    const processedThisTick = this._processedSet;
    processedThisTick.clear();

    for (let y = rows - 1; y >= 0; y--) {
      for (let x = 0; x < cols; x++) {
        const idx = y * cols + x;
        if (processedThisTick.has(idx)) continue;

        if (!this.grid.isGravityAffected(x, y)) {
          // If a non-gravity tile was marked as falling, reset it
          const meta = this.grid.getMeta(x, y);
          if (meta?.falling) meta.falling = false;
          continue;
        }

        // Logical Priority: 1. Fall Down | 2. Slide Left | 3. Slide Right
        const moved = this._tryMove(x, y, 0, 1, processedThisTick) || 
                      this._trySlide(x, y, -1, processedThisTick) || 
                      this._trySlide(x, y, 1, processedThisTick);

        if (!moved) {
          // If it didn't move, it's resting.
          const i = idx;
          const meta = this.grid.meta[i];
          if (meta && meta.falling) {
            meta.falling = false;
            meta.fallAnim = 0;
            this.grid.dirtyCells.add(i); // Force renderer to update the resting position
          }
        }
      }
    }
  }

  _trySlide(x, y, dx, processedSet) {
    const type = this.grid.get(x, y);
    // Only Boulders and Gems roll off surfaces
    if (type !== TILE.BOULDER && type !== TILE.GEM) return false;

    // Check if resting on a "rounded" or "slippery" surface
    const below = this.grid.get(x, y + 1);
    const slippery = [TILE.BOULDER, TILE.GEM, TILE.STONE, TILE.MACHINE].includes(below);
    if (!slippery) return false;

    // Must have air to the side AND air diagonally below
    if (this.grid.get(x + dx, y) === TILE.EMPTY && 
        this.grid.get(x + dx, y + 1) === TILE.EMPTY) {
      return this._tryMove(x, y, dx, 1, processedSet);
    }
    return false;
  }

  _tryMove(fx, fy, dx, dy, processedSet) {
    const tx = fx + dx, ty = fy + dy;
    if (!this.grid.inBounds(tx, ty)) return false;

    const type = this.grid.get(fx, fy);
    const occupant = this.grid.get(tx, ty);
    const meta = this.grid.getMeta(fx, fy) || {};

    // Condition: Target must be Empty OR an entity we can impact
    const isTargetEmpty = occupant === TILE.EMPTY;
    const canImpact = !!this.impactRules[occupant];

    // TRICK: Only trigger impact if we were already "falling" or if moving directly down
    if (isTargetEmpty || (canImpact && (meta.falling || dy > 0))) {
      
      if (canImpact) {
        this.impactRules[occupant](tx, ty, type);
      }

      // Re-verify space is clear (in case impact didn't clear it yet)
      if (this.grid.get(tx, ty) === TILE.EMPTY) {
        meta.falling = true;
        this.grid.moveEntity(fx, fy, tx, ty);
        
        // Mark new index as processed so it doesn't move again this tick
        processedSet.add(ty * this.grid.cols + tx);
        
        this.events.emit('object_fell', { from: { x: fx, y: fy }, to: { x: tx, y: ty }, type });
        return true;
      }
    }
    return false;
  }

  explode(cx, cy, radius = 2) {
    const destroyed = [];
    const r2 = radius * radius;
    const currentGrid = this.grid;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        
        const ex = cx + dx, ey = cy + dy;
        if (!this.grid.inBounds(ex, ey)) continue;

        const tile = this.grid.get(ex, ey);
        
        // Unbreakable tiles
        if (tile === TILE.STONE || tile === TILE.EMPTY || tile === TILE.PORTAL_OPEN) continue;

        // Reactive logic
        if (tile === TILE.PLAYER) this.events.emit('player_crushed', { x: ex, y: ey });
        if (tile === TILE.CRYSTAL) {
          this.events.emit('crystal_destroyed', { x: ex, y: ey });
          this.events.emit('item_collected', { type: TILE.CRYSTAL, points: 0 });
        }

        // Chain Reaction
        if (tile === TILE.DYNAMITE) {
          this.grid.clear(ex, ey);
          this._defer(() => {
            if (this.grid === currentGrid) this.explode(ex, ey, 2);
          }, 100);
        }

        destroyed.push({ x: ex, y: ey, type: tile });
        
        // Visualization
        this.grid.set(ex, ey, TILE.EXPLOSION);
        this.grid.setMeta(ex, ey, { ttl: 500 });

        this._defer(() => {
          if (this.grid === currentGrid && this.grid.get(ex, ey) === TILE.EXPLOSION) {
            this.grid.clear(ex, ey);
          }
        }, 400);
      }
    }

    this.events.emit('explosion', { x: cx, y: cy, radius, destroyed });
    this.shake(15);
  }

  shake(amount = 10) {
    this.events.emit('camera_shake', { amount });
  }

  /** Cancel all pending deferred actions (call before discarding this instance). */
  destroy() {
    this._pending.length = 0;
  }
}
