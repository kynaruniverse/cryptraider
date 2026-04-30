// ============================================================
// CRYPT RAIDER — Elite Physics System (Reactive Pattern)
// ============================================================

import { TILE, GRAVITY_INTERVAL_MS } from './constants.js';

export class Physics {
  constructor(grid, eventBus) {
    this.grid     = grid;
    this.events   = eventBus;
    this._elapsed = 0;

    // Define "Rules" for how tiles respond to impact
    this.impactRules = {
      [TILE.PLAYER]:    (x, y) => this.events.emit('player_crushed', { x, y }),
      [TILE.ENEMY_M]:   (x, y) => this.events.emit('enemy_crushed',  { x, y, type: TILE.ENEMY_M }),
      [TILE.ENEMY_F]:   (x, y) => this.events.emit('enemy_crushed',  { x, y, type: TILE.ENEMY_F }),
      [TILE.DYNAMITE]: (x, y) => this.explode(x, y, 2)
    };
  }

  update(dt) {
    this._elapsed += dt;
    if (this._elapsed >= GRAVITY_INTERVAL_MS) {
      this._elapsed = 0;
      this._tickGravity();
    }
  }

  _tickGravity() {
    const { rows, cols } = this.grid;
    // Process bottom-up to ensure stable falling
    for (let y = rows - 2; y >= 0; y--) {
      for (let x = 0; x < cols; x++) {
        if (!this.grid.isGravityAffected(x, y)) continue;

        // Try Fall -> Try Slide Left -> Try Slide Right
        const moved = this._tryMove(x, y, 0, 1) || 
                      this._trySlide(x, y, -1) || 
                      this._trySlide(x, y, 1);
      }
    }
  }

  _trySlide(x, y, dx) {
    const type = this.grid.get(x, y);
    if (type !== TILE.BOULDER && type !== TILE.GEM) return false;

    // EVOLUTION: Only slide if resting on a slippery surface (Boulder, Gem, Stone)
    const below = this.grid.get(x, y + 1);
    const isSlippery = [TILE.BOULDER, TILE.GEM, TILE.STONE].includes(below);
    if (!isSlippery) return false;
    
    // Check clearance for the "diagonal" move
    if (this.grid.get(x + dx, y) === TILE.EMPTY && this.grid.get(x + dx, y + 1) === TILE.EMPTY) {
      return this._tryMove(x, y, dx, 1);
    }
    return false;
  }


  _tryMove(fx, fy, dx, dy) {
    const tx = fx + dx, ty = fy + dy;
    const occupant = this.grid.get(tx, ty);

    // If target is empty or reactive (player/enemy/tnt), we can move there
    if (occupant === TILE.EMPTY || this.impactRules[occupant]) {
      // 1. Trigger impact rules (Crush player, trigger TNT, etc.)
      if (this.impactRules[occupant]) {
        this.impactRules[occupant](tx, ty);
      }

      // 2. RE-CHECK: If we just crushed a player/enemy, the tile might still be occupied 
      // by their "death" state. Only move if the tile is now EMPTY.
      if (this.grid.get(tx, ty) === TILE.EMPTY) {
        const type = this.grid.get(fx, fy);
        this.grid.moveEntity(fx, fy, tx, ty);
        this.events.emit('object_fell', { from: { x: fx, y: fy }, to: { x: tx, y: ty }, type });
        return true;
      }
    }

    return false;
  }

  explode(cx, cy, radius = 2) {
    const destroyed = [];
    const r2 = radius * radius;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        
        const ex = cx + dx, ey = cy + dy;
        if (!this.grid.inBounds(ex, ey)) continue;

        const tile = this.grid.get(ex, ey);
        if (tile === TILE.STONE || tile === TILE.EMPTY) continue;

        // Special behavior for specific tiles during explosion
        if (tile === TILE.PLAYER) this.events.emit('player_crushed', { x: ex, y: ey });
        if (tile === TILE.CRYSTAL) {
          this.events.emit('crystal_destroyed', { x: ex, y: ey });
          this.events.emit('item_collected', { type: TILE.CRYSTAL, points: 0 }); // Alert GameSession count changed
        }

        // Chain reaction: Set to EMPTY immediately, then trigger next explosion.
        // We use a safer reference check to prevent errors on level exit.
        if (tile === TILE.DYNAMITE) {
          this.grid.clear(ex, ey);
          const currentGrid = this.grid;
          setTimeout(() => { 
            if (this.grid && this.grid === currentGrid) this.explode(ex, ey, 2); 
          }, 60); // Faster chain reaction (60ms) feels more "Elite"
        }


        destroyed.push({ x: ex, y: ey, type: tile });
        
        // EVOLUTION: Leave an "Explosion" tile briefly for the Renderer
        this.grid.set(ex, ey, TILE.EXPLOSION);
        this.grid.setMeta(ex, ey, { ttl: 500 }); // Time To Live: 500ms
        
        // PRO FIX: Only clear the tile if it's STILL an explosion.
        // This prevents the "Ghost Deletion" bug where players/gems 
        // moving into the blast zone get deleted by the timer.
        const targetGrid = this.grid;
        setTimeout(() => {
          if (this.grid && this.grid === targetGrid) {
            if (this.grid.get(ex, ey) === TILE.EXPLOSION) {
              this.grid.clear(ex, ey);
            }
          }
        }, 450); // Slightly faster clear for better visual snap
      }
    }

    this.events.emit('explosion', { x: cx, y: cy, radius, destroyed });
  }

  shake(amount = 10) {
    // This allows other systems to trigger a screen shake through the physics engine
    this.events.emit('explosion', { x: -1, y: -1, radius: 0, amount });
  }
}
