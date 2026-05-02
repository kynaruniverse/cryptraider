// ============================================================
// CRYPT RAIDER — Enemy Entities
// Mummy: grid BFS pathfinding toward player
// Fly:   direct 8-direction chase, ignores terrain
// ============================================================

import { TILE, ENEMY_MOVE_INTERVAL_MS, ENEMY_FLY_INTERVAL_MS, SCORE, COLS, ROWS } from '../engine/constants.js';

const MAX_CELLS = COLS * ROWS; // 187 for an 11×17 grid

// ─────────────────────────────────────────────
//  Base Enemy
// ─────────────────────────────────────────────
class Enemy {
  constructor(x, y, type, grid, eventBus) {
    this.x       = x;
    this.y       = y;
    this.type    = type;
    this.grid    = grid;
    this.events  = eventBus;
    this.alive   = true;
    this._timer  = 0;
    this.interval = ENEMY_MOVE_INTERVAL_MS;
  }

  update(dt, playerX, playerY) {
    if (!this.alive) return;
    this._timer += dt;
    if (this._timer < this.interval) return;
    this._timer = 0;
    this._think(playerX, playerY);
  }

  _think() {}

  _moveTo(nx, ny) {
    const target = this.grid.get(nx, ny);

    if (target === TILE.PLAYER) {
      // Impact logic: Don't move into the player, just trigger the event
      this.events.emit('enemy_touched_player', { x: nx, y: ny, type: this.type });
      return;
    }

    // Use our optimized atomic move
    this.grid.moveEntity(this.x, this.y, nx, ny);
    this.x = nx;
    this.y = ny;
  }



  kill() {
    if (!this.alive) return;
    this.alive = false;
    this.grid.clear(this.x, this.y);
    this.events.emit('enemy_killed', { x: this.x, y: this.y, type: this.type, points: SCORE.ENEMY });
  }
}

// ─────────────────────────────────────────────
//  Mummy — BFS pathfinding through open/dirt
// ─────────────────────────────────────────────
export class Mummy extends Enemy {
  constructor(x, y, grid, eventBus) {
    super(x, y, TILE.ENEMY_M, grid, eventBus);
    this.interval = ENEMY_MOVE_INTERVAL_MS;
  }

  _think(px, py) {
    const next = this._bfsStep(px, py);
    if (!next) return;
    this._moveTo(next.x, next.y);
  }

    // Pre-allocated static structures to prevent Garbage Collection stutters
  static _queue     = new Int16Array(MAX_CELLS);     // one slot per grid cell
  static _parentMap = new Int16Array(MAX_CELLS);     // one slot per grid cell
  static _dirs = [0, -1, 0, 1, -1, 0, 1, 0]; 

  _bfsStep(px, py) {
    const g = this.grid;
    const cols = g.cols;
    const startIdx = this.y * cols + this.x;
    const targetIdx = py * cols + px;

    Mummy._parentMap.fill(-1);
    let head = 0, tail = 0;
    
    Mummy._queue[tail++] = startIdx;
    Mummy._parentMap[startIdx] = -2; // Mark start

    while (head < tail) {
      const curr = Mummy._queue[head++];
      const cx = curr % cols;
      const cy = (curr / cols) | 0;

      for (let i = 0; i < 8; i += 2) {
        const nx = cx + Mummy._dirs[i];
        const ny = cy + Mummy._dirs[i+1];
        const nIdx = ny * cols + nx;

        if (!g.inBounds(nx, ny) || Mummy._parentMap[nIdx] !== -1) continue;

        const t = g.get(nx, ny);
        
        if (nx === px && ny === py) {
          // Reconstruct first step
          let step = nIdx;
          let last = nIdx;
          while (step !== startIdx && step !== -2) {
            last = step;
            step = Mummy._parentMap[step];
          }
          // Reset shared buffers before returning so the next call starts clean.
          Mummy._queue.fill(0, 0, tail);
          Mummy._parentMap.fill(-1);
          return { x: last % cols, y: (last / cols) | 0 };
        }

        if (t === TILE.EMPTY || t === TILE.DIRT || t === TILE.SAND || t === TILE.LADDER) {
          Mummy._parentMap[nIdx] = curr;
          Mummy._queue[tail++] = nIdx;
        }
      }
      // SAFETY: If the search space gets too large or unreachable, 
      // stop the search to prevent the browser from freezing.
      if (tail >= MAX_CELLS || head >= MAX_CELLS) break;
    }

    // Reset only the portion of the queue that was actually used.
    Mummy._queue.fill(0, 0, tail);
    return null;

  }

}

// ─────────────────────────────────────────────
//  Fly — direct chase, passes through terrain
// ─────────────────────────────────────────────
export class Fly extends Enemy {
  constructor(x, y, grid, eventBus) {
    super(x, y, TILE.ENEMY_F, grid, eventBus);
    this.interval = ENEMY_FLY_INTERVAL_MS;
  }

  _think(px, py) {
    let dx = px - this.x;
    let dy = py - this.y;

    // Normalize to single step
    if (Math.abs(dx) >= Math.abs(dy)) {
      dx = Math.sign(dx); dy = 0;
    } else {
      dy = Math.sign(dy); dx = 0;
    }

    const nx = this.x + dx;
    const ny = this.y + dy;

    if (!this.grid.inBounds(nx, ny)) return;

    // Evolution: Flies use the Grid's bitmask to see what is TRULY solid
    if (this.grid.isSolid(nx, ny)) return;

    this._moveTo(nx, ny);

  }
}

// ─────────────────────────────────────────────
//  Enemy Manager
// ─────────────────────────────────────────────
export class EnemyManager {
  constructor(grid, eventBus) {
    this.grid   = grid;
    this.events = eventBus;
    this.enemies = [];
  }

  spawnFromGrid() {
    this.enemies = [];
    const g = this.grid;
    for (let y = 0; y < g.rows; y++) {
      for (let x = 0; x < g.cols; x++) {
        const t = g.get(x, y);
        if (t === TILE.ENEMY_M) this.enemies.push(new Mummy(x, y, g, this.events));
        if (t === TILE.ENEMY_F) this.enemies.push(new Fly  (x, y, g, this.events));
      }
    }
  }

  update(dt, playerX, playerY) {
    let hasDeadEnemy = false;
    for (const e of this.enemies) {
      if (e.alive) {
        e.update(dt, playerX, playerY);
      } else {
        hasDeadEnemy = true;
      }
    }
    // Prune only when necessary — avoids allocating a new array every tick.
    if (hasDeadEnemy) {
      this.enemies = this.enemies.filter(e => e.alive);
    }
  }

  killAt(x, y) {
    // Look for any enemy at these coordinates and kill it
    const victim = this.enemies.find(e => e.alive && e.x === x && e.y === y);
    if (victim) {
      victim.kill();
      return true;
    }
    return false;
  }


  getAlive() {
    return this.enemies;
  }
}
