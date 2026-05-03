// ============================================================
// CRYPT RAIDER — Player Entity
// Permanent ladder tiles + gravity / fall-death system
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
    this._moveTimer  = 0;
    this.hasDynamite = 0;
    this.hasKey      = false;
    this._falling    = false;
    this._fallCount  = 0;
    this.bombX       = null;
    this.bombY       = null;
    this.grid.set(this.x, this.y, TILE.PLAYER);
  }

  update(dt, inputSystem) {
    if (!this.alive) return;

    this._moveTimer += dt;
    if (this._moveTimer < PLAYER_MOVE_INTERVAL_MS) return;
    this._moveTimer = 0;

    // ── Gravity: player falls if unsupported and not on a ladder ──
    if (this._falling) {
      this._applyGravity();
      return; // no input while mid-fall
    }

    // ── Check for fall trigger (no floor beneath, not on ladder) ──
    if (!this._isSupported()) {
      this._falling = true;
      this._applyGravity();
      return;
    }

    // ── Normal input ──
    const inputDir = inputSystem.pollDir();
    if (!inputDir || (inputDir.x === 0 && inputDir.y === 0)) return;

    const nx = this.x + inputDir.x;
    const ny = this.y + inputDir.y;

    if      (inputDir.y < 0) this.dir = DIR.UP;
    else if (inputDir.y > 0) this.dir = DIR.DOWN;
    else if (inputDir.x < 0) this.dir = DIR.LEFT;
    else                      this.dir = DIR.RIGHT;

    if (!this.grid.inBounds(nx, ny)) return;

    const target = this.grid.get(nx, ny);

    switch (target) {
      case TILE.EMPTY:
        this._move(nx, ny);
        this._checkGravity();
        break;

      case TILE.LADDER:
        this._moveOntoLadder(nx, ny);
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
        this._checkGravity();
        break;

      case TILE.KEY:
        this.hasKey = true;
        this.grid.clear(nx, ny);
        this.events.emit('key_collected', { x: nx, y: ny });
        this._move(nx, ny);
        this._checkGravity();
        break;

      case TILE.DYNAMITE:
        // If this cell is a live placed bomb (bombX/bombY match), block movement.
        // Otherwise it's a pickup sitting in the level — collect it.
        if (this.bombX === nx && this.bombY === ny) {
          break; // live bomb — cannot walk onto it
        }
        this.hasDynamite++;
        this.grid.clear(nx, ny);
        this.events.emit('dynamite_picked', { x: nx, y: ny });
        this._move(nx, ny);
        this._checkGravity();
        break;

      case TILE.MACHINE:
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
          this._checkGravity();
        }
        break;

      case TILE.BOULDER:
        if (inputDir.y === 0) this._pushBoulder(nx, ny, inputDir.x);
        break;

      case TILE.ENEMY_M:
      case TILE.ENEMY_F:
        this._hit();
        break;

      default:
        break;
    }
  }

  // ── Gravity helpers ───────────────────────────────────────

  /**
   * Returns true if the player is currently "supported":
   * standing on a solid/diggable tile, on a ladder, or on the grid floor.
   * On a ladder tile the player is always supported regardless of below.
   */
  _isSupported() {
    // On a ladder — always supported, no fall.
    if (this.grid.isClimbable(this.x, this.y)) return true;

    const below = this.y + 1;
    if (!this.grid.inBounds(this.x, below)) return true; // bottom edge = solid floor

    const tileBelow = this.grid.get(this.x, below);
    // Supported by anything that isn't a void (empty / another ladder counts as floor
    // only if the player is on it — which is the climbable check above).
    // Empty below + not on ladder = unsupported.
    return tileBelow !== TILE.EMPTY && tileBelow !== TILE.PLAYER;
  }

  /** After any move, check whether gravity should start.
   *  NOTE: do NOT reset _fallCount here — only _land() may do that.
   *  Resetting early would let a player graze a ledge mid-fall and
   *  survive a lethal drop. */
  _checkGravity() {
    if (this._isSupported()) {
      this._falling = false;
    } else {
      this._falling = true;
    }
  }

  /** Called each timer tick while _falling === true. */
  _applyGravity() {
    const ny = this.y + 1;

    if (!this.grid.inBounds(this.x, ny)) {
      // Hit the absolute bottom — land safely.
      this._land();
      return;
    }

    const tileBelow = this.grid.get(this.x, ny);

    // Check for anything that stops the fall.
    if (tileBelow === TILE.EMPTY) {
      // Keep falling — move down one tile.
      this._fallCount++;
      this._move(this.x, ny);
      // Still nothing below after moving? Keep the _falling flag live.
      if (!this._isSupported()) return; // will continue next tick
      this._land();
    } else if (tileBelow === TILE.LADDER) {
      // Land on a ladder — safe, no fall damage.
      this._moveOntoLadder(this.x, ny);
      this._land();
    } else if (tileBelow === TILE.ENEMY_M || tileBelow === TILE.ENEMY_F) {
      // Fell onto an enemy — hit the player.
      this._fallCount++;
      this._hit();
      this._land();
    } else {
      // Solid/diggable tile below — stop here.
      this._land();
    }
  }

  /** Resolve a landing: apply fall damage if needed, reset fall state. */
  _land() {
    this._falling = false;
    if (this._fallCount > CONFIG.SAFE_FALL_TILES) {
      // Fell too far — die.
      this.events.emit('player_fall_death', { tiles: this._fallCount });
      this.die();
    } else if (this._fallCount > 0) {
      this.events.emit('player_landed', { tiles: this._fallCount });
    }
    this._fallCount = 0;
  }

  // ── Ladder movement ───────────────────────────────────────

  /**
   * Move the player onto a ladder cell WITHOUT overwriting the ladder tile.
   * The grid stores PLAYER on the old cell (via moveEntity), but we must
   * restore the ladder tile at the new cell and keep PLAYER as a visual-only
   * overlay tracked by player.x/y.
   */
  _moveOntoLadder(nx, ny) {
    // Clear old cell (restore whatever was there — ladder or empty).
    const wasOnLadder = this.grid.isClimbable(this.x, this.y);
    if (wasOnLadder) {
      // Restore ladder tile at old position.
      this.grid.set(this.x, this.y, TILE.LADDER);
    } else {
      this.grid.set(this.x, this.y, TILE.EMPTY);
    }
    this.grid.dirtyCells.add(this.grid.idx(this.x, this.y));

    // New position: ladder tile stays, player is rendered on top by renderPlayer().
    // We do NOT overwrite the ladder tile with TILE.PLAYER in the grid.
    this.x = nx;
    this.y = ny;
    // Ensure ladder tile is present (it always should be, but be defensive).
    this.grid.set(nx, ny, TILE.LADDER);
    this.grid.dirtyCells.add(this.grid.idx(nx, ny));

    this._fallCount = 0;
    this._falling   = false;
    this.events.emit('player_moved', { x: nx, y: ny, dir: this.dir });
  }

  // ── Movement helpers ─────────────────────────────────────

  /** Standard move — restores ladder tile if leaving one. */
  _move(nx, ny) {
    const wasOnLadder = this.grid.isClimbable(this.x, this.y);
    if (wasOnLadder) {
      this.grid.set(this.x, this.y, TILE.LADDER);
      this.grid.dirtyCells.add(this.grid.idx(this.x, this.y));
      this.grid.set(nx, ny, TILE.PLAYER);
      this.grid.dirtyCells.add(this.grid.idx(nx, ny));
    } else {
      this.grid.moveEntity(this.x, this.y, nx, ny);
    }
    this.x = nx;
    this.y = ny;
    this.events.emit('player_moved', { x: nx, y: ny, dir: this.dir });
  }

  /** Raw positional move used during gravity fall — no event, no ladder check. */
  _moveRaw(nx, ny) {
    const wasOnLadder = this.grid.isClimbable(this.x, this.y);
    this.grid.set(this.x, this.y, wasOnLadder ? TILE.LADDER : TILE.EMPTY);
    this.grid.dirtyCells.add(this.grid.idx(this.x, this.y));
    this.grid.set(nx, ny, TILE.PLAYER);
    this.grid.dirtyCells.add(this.grid.idx(nx, ny));
    this.x = nx;
    this.y = ny;
    this.events.emit('player_moved', { x: nx, y: ny, dir: this.dir });
  }

  _dig(nx, ny) {
    this.grid.clear(nx, ny);
    this._move(nx, ny);
    this.events.emit('tile_dug', { x: nx, y: ny });
    this._checkGravity();
  }

  _collect(nx, ny, type) {
    this.grid.clear(nx, ny);
    const pts = type === TILE.CRYSTAL ? SCORE.CRYSTAL : SCORE.GEM;
    this.events.emit('item_collected', { x: nx, y: ny, type, points: pts });
    this._move(nx, ny);
  }

  _pushBoulder(bx, by, dx) {
    const tx = bx + dx;
    if (!this.grid.inBounds(tx, by)) return;
    if (this.grid.get(tx, by) !== TILE.EMPTY) return;
    this.grid.moveEntity(bx, by, tx, by);
    this._move(bx, by);
    this.events.emit('boulder_pushed', { from: { x: bx, y: by }, to: { x: tx, y: by } });
    this._checkGravity();
  }

  // ── Place dynamite ────────────────────────────────────────
  // Places the bomb at the current cell, then retreats the player
  // one step in the opposite direction they are facing so the player
  // and the bomb tile are NEVER on the same grid cell.
  // Returns false if no safe retreat cell exists (placement refused).
  placeDynamite() {
    if (!this.alive || this.hasDynamite <= 0) return false;

    // Find a retreat cell — prefer opposite of facing direction,
    // then try all four directions.
    const retreatDirs = [
      { x: -this.dir.x, y: -this.dir.y }, // opposite of facing — natural step back
      { x:  0, y: -1 }, // up
      { x: -1, y:  0 }, // left
      { x:  1, y:  0 }, // right
      { x:  0, y:  1 }, // down
    ];

    let retreatX = null, retreatY = null;
    for (const d of retreatDirs) {
      const rx = this.x + d.x;
      const ry = this.y + d.y;
      if (!this.grid.inBounds(rx, ry)) continue;
      const t = this.grid.get(rx, ry);
      // Retreat cell must be empty or a ladder — nothing else is safe to step onto
      if (t === TILE.EMPTY || t === TILE.LADDER) {
        retreatX = rx;
        retreatY = ry;
        break;
      }
    }

    if (retreatX === null) return false; // surrounded — refuse placement

    this.hasDynamite--;

    // Record bomb coordinates for gameSession to write the tile and schedule explosion.
    this.bombX = this.x;
    this.bombY = this.y;

    // Move player to retreat cell — clears the player's old cell, marks dirty.
    // gameSession will then write TILE.DYNAMITE to (bombX, bombY).
    const wasOnLadder = this.grid.isClimbable(this.x, this.y);
    this.grid.set(this.x, this.y, wasOnLadder ? TILE.LADDER : TILE.EMPTY);
    this.grid.dirtyCells.add(this.grid.idx(this.x, this.y));
    this.grid.set(retreatX, retreatY, TILE.PLAYER);
    this.grid.dirtyCells.add(this.grid.idx(retreatX, retreatY));
    this.x = retreatX;
    this.y = retreatY;

    this.events.emit('player_moved', { x: retreatX, y: retreatY, dir: this.dir });
    this.events.emit('dynamite_placed', { x: this.bombX, y: this.bombY });
    return true;
  }

  _hit() {
    this.energy -= CONFIG.ENERGY_LOSS;
    this.events.emit('player_hit', { energy: this.energy });
    if (this.energy <= 0) this.die();
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    // Restore ladder tile if dying on one
    this.grid.set(this.x, this.y,
      this.grid.isClimbable(this.x, this.y) ? TILE.LADDER : TILE.EMPTY);
    this.events.emit('player_died', { x: this.x, y: this.y });
  }

  crush() { this.die(); }
}