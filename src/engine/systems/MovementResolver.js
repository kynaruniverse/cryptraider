// ============================================================
// CRYPT RAIDER — Movement Resolver (ECS System)
// ============================================================

import { TILE, DIR } from '../constants.js';

export class MovementResolver {
  constructor(player) {
    this.p = player;
    this.grid = player.grid;
    this.events = player.events;
  }

  resolve(intent) {
    const { x: dx, y: dy } = intent.move;

    const x = this.p.x;
    const y = this.p.y;

    const nx = x + dx;
    const ny = y + dy;

    if (!this.grid.inBounds(nx, ny)) return;

    // Direction update
    if (dy < 0) this.p.dir = DIR.UP;
    else if (dy > 0) this.p.dir = DIR.DOWN;
    else if (dx < 0) this.p.dir = DIR.LEFT;
    else this.p.dir = DIR.RIGHT;

    this.p.session?.captureSnapshot?.();

    const tile = this.grid.get(nx, ny);

    switch (tile) {
      case TILE.EMPTY:
        this.move(nx, ny);
        break;

      case TILE.LADDER:
        this.moveOntoLadder(nx, ny);
        break;

      case TILE.DIRT:
      case TILE.GRAVEL:
      case TILE.SAND:
        this.dig(nx, ny);
        break;

      case TILE.KEY:
        this.collectKey(nx, ny);
        break;

      case TILE.GEM:
      case TILE.CRYSTAL:
        this.collect(nx, ny, tile);
        break;

      case TILE.DYNAMITE:
        this.pickDynamite(nx, ny);
        break;

      case TILE.DOOR:
        this.openDoor(nx, ny);
        break;

      case TILE.ENEMY_M:
      case TILE.ENEMY_F:
        this.p.onHit();
        break;

      case TILE.PORTAL:
      case TILE.PORTAL_OPEN:
        this.events.emit('player_entered_portal', { x: nx, y: ny });
        break;
    }

    this.p.gravity.evaluate();
  }

  move(nx, ny) {
    this.grid.moveEntity(this.p.x, this.p.y, nx, ny);
    this.p.onMove(nx, ny, this.p.dir);
  }

  moveOntoLadder(nx, ny) {
    this.grid.set(this.p.x, this.p.y, TILE.LADDER);

    this.p.x = nx;
    this.p.y = ny;

    this.grid.set(nx, ny, TILE.LADDER);

    this.p.onMove(nx, ny, this.p.dir);
  }

  dig(nx, ny) {
    this.grid.clear(nx, ny);
    this.move(nx, ny);
    this.events.emit('tile_dug', { x: nx, y: ny });
  }

  collect(nx, ny, type) {
    this.grid.clear(nx, ny);

    this.events.emit('item_collected', {
      x: nx,
      y: ny,
      type
    });

    this.move(nx, ny);
  }

  collectKey(nx, ny) {
    this.p.hasKey = true;
    this.grid.clear(nx, ny);

    this.events.emit('key_collected', { x: nx, y: ny });

    this.move(nx, ny);
  }

  pickDynamite(nx, ny) {
    if (this.p.bombX === nx && this.p.bombY === ny) return;

    this.p.hasDynamite++;
    this.grid.clear(nx, ny);

    this.events.emit('dynamite_picked', { x: nx, y: ny });

    this.move(nx, ny);
  }

  openDoor(nx, ny) {
    if (!this.p.hasKey) return;

    this.p.hasKey = false;

    this.grid.set(nx, ny, TILE.EMPTY);

    this.events.emit('door_opened', { x: nx, y: ny });

    this.move(nx, ny);
  }
}