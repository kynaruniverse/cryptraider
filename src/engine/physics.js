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
      // 1. Trigger the impact rule first (before the move overwrites the occupant)
      if (this.impactRules[occupant]) {
        this.impactRules[occupant](tx, ty);
        // If we hit something like TNT, it might disappear or explode, 
        // re-verify if the spot is now available.
      }

      // 2. Use the Grid's atomic move to handle meta and dirty-tracking
      const type = this.grid.get(fx, fy);
      this.grid.moveEntity(fx, fy, tx, ty);
      
      this.events.emit('object_fell', { from: { x: fx, y: fy }, to: { x: tx, y: ty }, type });
      return true;
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
        if (tile === TILE.CRYSTAL) this.events.emit('crystal_destroyed', { x: ex, y: ey });
        
        // Chain reaction: Set to EMPTY immediately so it doesn't double-explode
        if (tile === TILE.DYNAMITE) {
          this.grid.clear(ex, ey);
            const g = this.grid;
          setTimeout(() => { if (this.grid === g) this.explode(ex, ey, 2); }, 100);
        }


        destroyed.push({ x: ex, y: ey, type: tile });
        
        // EVOLUTION: Leave an "Explosion" tile briefly for the Renderer
        this.grid.set(ex, ey, TILE.EXPLOSION);
        this.grid.setMeta(ex, ey, { ttl: 500 }); // Time To Live: 500ms
        
        // Auto-clear explosion tile after TTL
        const g2 = this.grid;
        setTimeout(() => {
          if (this.grid === g2 && this.grid.get(ex, ey) === TILE.EXPLOSION)
            this.grid.clear(ex, ey);
        }, 500);
      }
    }

    this.events.emit('explosion', { x: cx, y: cy, radius, destroyed });
  }
}
