// ============================================================
// CRYPT RAIDER — Player Entity
// ============================================================

import { TILE, DIR, PLAYER_MOVE_INTERVAL_MS, CONFIG, SCORE } from '../engine/constants.js';

export class Player {
  constructor(grid, eventBus) {
    this.grid   = grid;
    this.events = eventBus;
    this.reset();
  }

  reset() {
    const start  = this.grid.findFirst(TILE.PLAYER);
    this.x       = start ? start.x : 1;
    this.y       = start ? start.y : 1;
    this.dir     = DIR.DOWN;
    this.energy  = CONFIG.MAX_ENERGY;
    this.alive   = true;
    this.moving  = false;
    this._moveTimer = 0;
    this.hasDynamite = 0;
    this.hasKey      = false;
    // Mark player on grid
    this.grid.set(this.x, this.y, TILE.PLAYER);
  }

  update(dt, inputSystem) {
    if (!this.alive) return;

    this._moveTimer += dt;
    
    // 1. Check if we are ready to move
    if (this._moveTimer < PLAYER_MOVE_INTERVAL_MS) return;

    // 2. ONLY poll the direction if the timer has cleared.
    // This ensures swipes stay in the buffer until the player is ready.
    const inputDir = inputSystem.pollDir();
    if (!inputDir || (inputDir.x === 0 && inputDir.y === 0)) return;

    // 3. Reset timer only after we confirmed there is an actual move to make
    this._moveTimer = 0;

    const nx = this.x + inputDir.x;
    const ny = this.y + inputDir.y;


    // Update facing direction
    if      (inputDir.y < 0) this.dir = DIR.UP;
    else if (inputDir.y > 0) this.dir = DIR.DOWN;
    else if (inputDir.x < 0) this.dir = DIR.LEFT;
    else                      this.dir = DIR.RIGHT;

    if (!this.grid.inBounds(nx, ny)) return;

    const target = this.grid.get(nx, ny);

    // Use bitwise property checks from our Elite Grid for faster collision
    const isPassable = this.grid.isPassable(nx, ny);
    
    switch (target) {
      case TILE.EMPTY:
      case TILE.LADDER:
        this._move(nx, ny);
        break;
      case TILE.PORTAL_OPEN:
        this.events.emit('player_entered_portal', { x: nx, y: ny });
        break;

      case TILE.DIRT:
      case TILE.GRAVEL:
      case TILE.SAND:
        this._dig(nx, ny);
        break;


      case TILE.CRYSTAL:
      case TILE.GEM:
        this._collect(nx, ny, target);
        break;


      case TILE.KEY:
        this.hasKey = true;
        this.grid.clear(nx, ny);
        this.events.emit('key_collected', { x: nx, y: ny });
        this._move(nx, ny);
        break;

      case TILE.DYNAMITE:
        this.hasDynamite++;
        this.grid.clear(nx, ny);
        this.events.emit('dynamite_picked', { x: nx, y: ny });
        this._move(nx, ny);
        break;

      case TILE.MACHINE:
        // deposit crystal into machine — handled by GameSession
        this.events.emit('player_at_machine', { x: nx, y: ny });
        break;

      case TILE.PORTAL:
        this.events.emit('player_entered_portal', { x: nx, y: ny });
        break;

      case TILE.DOOR:
        if (this.hasKey) {
          this.hasKey = false;
          this.grid.set(nx, ny, TILE.EMPTY);
          this.events.emit('door_opened', { x: nx, y: ny });
          this._move(nx, ny);
        }
        break;

      case TILE.BOULDER:
        // Push boulder horizontally only
        if (inputDir.y === 0) this._pushBoulder(nx, ny, inputDir.x);
        break;

      case TILE.ENEMY_M:
      case TILE.ENEMY_F:
        this._hit();
        break;

      default:
        break; // solid / impassable
    }
  }

  // ── Place dynamite at player position ──────────────────────
  placeDynamite() {
    if (!this.alive || this.hasDynamite <= 0) return false;
    this.hasDynamite--;
    // Place dynamite tile on the grid
    this.grid.set(this.x, this.y, TILE.DYNAMITE);
    this.events.emit('dynamite_placed', { x: this.x, y: this.y });
    return true;
  }

  // ── Internal movement helpers ──────────────────────────────
  _move(nx, ny) {
    // 1. Use atomic moveEntity for better performance and rendering sync
    this.grid.moveEntity(this.x, this.y, nx, ny);
    this.x = nx;
    this.y = ny;

    // 2. Emit event for camera/sounds
    this.events.emit('player_moved', { x: nx, y: ny, dir: this.dir });
  }


  _dig(nx, ny) {
    this.grid.clear(nx, ny); // Clear dirt first
    this._move(nx, ny);
    this.events.emit('tile_dug', { x: nx, y: ny });
  }

  _collect(nx, ny, type) {
    this.grid.clear(nx, ny); // Clear item
    const pts = type === TILE.CRYSTAL ? SCORE.CRYSTAL : SCORE.GEM;
    this.events.emit('item_collected', { x: nx, y: ny, type, points: pts });
    this._move(nx, ny);
  }

  _pushBoulder(bx, by, dx) {
    const tx = bx + dx;
    if (!this.grid.inBounds(tx, by)) return;
    if (this.grid.get(tx, by) !== TILE.EMPTY) return;

    // Use atomic move to push boulder and follow it
    this.grid.moveEntity(bx, by, tx, by);
    this._move(bx, by);
    this.events.emit('boulder_pushed', { from: { x: bx, y: by }, to: { x: tx, y: by } });
  }


  _hit() {
    this.energy -= CONFIG.ENERGY_LOSS;
    this.events.emit('player_hit', { energy: this.energy });
    if (this.energy <= 0) this.die();
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.grid.set(this.x, this.y, TILE.EMPTY);
    this.events.emit('player_died', { x: this.x, y: this.y });
  }

  crush() {
    this.die();
  }
}
