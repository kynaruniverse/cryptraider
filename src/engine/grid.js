// ============================================================
// CRYPT RAIDER — AAA Spatial Grid Engine
// Optimized for memory locality, fast queries, and delta tracking
// ============================================================
// UPGRADE 4: dirtyCells is now a Uint8Array bit-field (0|1).
//   • Zero allocation per dirty-mark (no Set object growth/shrink).
//   • O(n) scan in clearDirty() is cache-hot — sequential Uint8Array read.
//   • fill(0) reset is a single typed-array memset — far cheaper than
//     Set.clear() which must hash-drain all entries.
//   • External code calling .add(i) / .has(i) / for-of / .clear() still
//     works unchanged via the DirtyField compatibility shim below.
// ============================================================

import { TILE, COLS, ROWS } from './constants.js';

// Bitwise flags for ultra-fast property checking
const FLAG = {
  SOLID:    1 << 0,
  DIGGABLE: 1 << 1,
  PASSABLE: 1 << 2,
  GRAVITY:  1 << 3,
  COLLECT:  1 << 4,
  DANGEROUS:1 << 5,
  CLIMBABLE:1 << 6,  // tile is a ladder — player can be on it without falling
};

// Optimization: Property Lookup Table (O(1) access)
const TILE_PROPS = new Uint8Array(256);
const define = (tile, flags) => TILE_PROPS[tile] = flags;

define(TILE.STONE,    FLAG.SOLID);
define(TILE.BOULDER,  FLAG.SOLID | FLAG.GRAVITY);
define(TILE.GRAVEL,   FLAG.SOLID | FLAG.GRAVITY);
define(TILE.DIRT,     FLAG.DIGGABLE);
define(TILE.SAND,     FLAG.DIGGABLE | FLAG.PASSABLE);
define(TILE.EMPTY,    FLAG.PASSABLE);
define(TILE.LADDER,   FLAG.PASSABLE | FLAG.CLIMBABLE);
define(TILE.CRYSTAL,  FLAG.GRAVITY | FLAG.COLLECT);
define(TILE.GEM,      FLAG.GRAVITY | FLAG.COLLECT);
define(TILE.DYNAMITE, FLAG.GRAVITY | FLAG.DANGEROUS);
define(TILE.ENEMY_M,  FLAG.DANGEROUS);
define(TILE.ENEMY_F,  FLAG.DANGEROUS);
define(TILE.KEY,         FLAG.COLLECT);
define(TILE.DOOR,        FLAG.SOLID); 
define(TILE.PORTAL,      FLAG.PASSABLE);
define(TILE.PORTAL_OPEN, FLAG.PASSABLE); // Ensure portal remains passable when open
define(TILE.MACHINE,     FLAG.SOLID);
define(TILE.EXPLOSION,   FLAG.DANGEROUS); // Explosions should kill entities

// ── DirtyField ─────────────────────────────────────────────
// Wraps a Uint8Array(size) with a Set-compatible API so all existing
// call sites (.add / .has / for-of / .clear / .fill) work unchanged
// while gaining the GC and cache advantages of a typed array.
class DirtyField {
  constructor(size) {
    this._buf   = new Uint8Array(size);
    this._dirty = []; // index list rebuilt lazily for for-of iteration
    this._stale = false;
  }

  get size() {
    // Bit-count — only used in renderer cache invalidation (rare path).
    let n = 0;
    for (let i = 0; i < this._buf.length; i++) if (this._buf[i]) n++;
    return n;
  }

  /** Zero-allocation hot-path dirty mark. */
  add(i) {
    if (i >= 0 && i < this._buf.length && !this._buf[i]) {
      this._buf[i] = 1;
      this._stale  = true;
    }
  }

  has(i) { return i >= 0 && i < this._buf.length && this._buf[i] !== 0; }

  /** Reset all dirty bits — single memset, no per-entry work. */
  clear() { this._buf.fill(0); this._dirty.length = 0; this._stale = false; }

  /** fill(0) alias used by UndoManager restore path. */
  fill(v) {
    this._buf.fill(v ? 1 : 0);
    if (!v) { this._dirty.length = 0; this._stale = false; }
    else     { this._stale = true; }
  }

  _rebuild() {
    this._dirty.length = 0;
    for (let i = 0; i < this._buf.length; i++) {
      if (this._buf[i]) this._dirty.push(i);
    }
    this._stale = false;
  }

  /** for-of iteration: rebuilds index list only when stale (amortised). */
  [Symbol.iterator]() {
    if (this._stale) this._rebuild();
    let idx = 0;
    const arr = this._dirty;
    return {
      next() {
        if (idx < arr.length) return { value: arr[idx++], done: false };
        return { value: undefined, done: true };
      }
    };
  }
}

export class Grid {
  constructor(cols = COLS, rows = ROWS) {
    this.cols = cols;
    this.rows = rows;
    const size = cols * rows;

    this.cells = new Uint8Array(size);
    // null sentinel — avoids allocating a live object for every empty cell.
    this.meta  = new Array(size).fill(null);
    
    // UPGRADE 4: Uint8Array-backed dirty field — zero GC allocation per mark.
    this.dirtyCells = new DirtyField(size);
    this.fullClearRequested = true;
  }

  // ── High-Speed Indexing ──────────────────────────────────
  idx(x, y)      { return y * this.cols + x; }
  inBounds(x, y) { return x >= 0 && x < this.cols && y >= 0 && y < this.rows; }

  // ── Core IO (with Change Tracking) ────────────────────────
  get(x, y) {
    // 1. Boundary Check: Return STONE for anything outside the map
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return TILE.STONE;
    
    // 2. Index Safety: Ensure we don't return 'undefined' which causes crashes
    const val = this.cells[y * this.cols + x];
    return (val === undefined || val === null) ? TILE.EMPTY : val;
  }

  set(x, y, type) {
    if (!this.inBounds(x, y)) return;
    const i = this.idx(x, y);
    if (this.cells[i] !== type) {
      this.cells[i] = type;
      this.dirtyCells.add(i); // Mark for renderer
    }
  }

  getMeta(x, y)    { return this.inBounds(x, y) ? (this.meta[this.idx(x, y)] ?? null) : null; }
  setMeta(x, y, v) {
    if (this.inBounds(x, y)) {
      const i = this.idx(x, y);
      this.meta[i] = v;
      this.dirtyCells.add(i);
    }
  }

  clear(x, y) {
    if (!this.inBounds(x, y)) return;
    const i = this.idx(x, y);
    this.cells[i] = TILE.EMPTY;
    this.meta[i]  = null;
    this.dirtyCells.add(i);
  }


  // ── Bitmask Query System (AAA Performance) ────────────────
  // These replace multiple if/else chains with a single bitwise &
  check(x, y, flag)      { return (TILE_PROPS[this.get(x, y)] & flag) !== 0; }
  
  isSolid(x, y)          { return this.check(x, y, FLAG.SOLID); }
  isDiggable(x, y)       { return this.check(x, y, FLAG.DIGGABLE); }
  isPassable(x, y)       { return this.check(x, y, FLAG.PASSABLE); }
  isGravityAffected(x, y){ return this.check(x, y, FLAG.GRAVITY); }
  isDangerous(x, y)      { return this.check(x, y, FLAG.DANGEROUS); }
  isClimbable(x, y)      { return this.check(x, y, FLAG.CLIMBABLE); }

  // ── Advanced Spatial Logic ────────────────────────────────
  
  /** Moves an entity and its metadata atomically */
  moveEntity(fx, fy, tx, ty) {
    const type    = this.get(fx, fy);
    const srcMeta = this.getMeta(fx, fy);
    // Shallow-clone only when there is meta to clone; otherwise start fresh.
    const meta    = srcMeta ? { ...srcMeta } : {};
    
    // Auto-detect vertical movement
    if (ty > fy) {
      meta.falling = true;
      meta.fallAnim = (meta.fallAnim || 0); 
    } else {
      meta.falling = false;
      meta.fallAnim = 0;
    }

    // Atomic Swap
    this.clear(fx, fy); 
    this.set(tx, ty, type);
    this.setMeta(tx, ty, meta);
    
    // Mark both spots as dirty for the renderer
    this.dirtyCells.add(this.idx(fx, fy));
    this.dirtyCells.add(this.idx(tx, ty));
  }

  /** Iterator for surrounding tiles (useful for explosions/AI) */
  forEachNeighbor(x, y, callback) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (this.inBounds(nx, ny)) callback(this.get(nx, ny), nx, ny);
      }
    }
  }

// ── Spatial Query Methods ─────────────────────────────────

  /** Count all cells matching a tile type */
  count(type) {
    let n = 0;
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] === type) n++;
    }
    return n;
  }

  /** Return [{x, y}] for every cell matching a tile type */
  findAll(type) {
    const results = [];
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] === type) {
        results.push({ x: i % this.cols, y: Math.floor(i / this.cols) });
      }
    }
    return results;
  }

  /** Return {x, y} for the first matching cell, or null */
  findFirst(type) {
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] === type) {
        return { x: i % this.cols, y: Math.floor(i / this.cols) };
      }
    }
    return null;
  }

  // ── State Management ──────────────────────────────────────
  
  clearDirty() {
    // UPGRADE 4: fill(0) is a single memset — no per-entry hash drain.
    this.dirtyCells.fill(0);
    this.fullClearRequested = false;
    for (let i = 0; i < this.meta.length; i++) {
      if (this.meta[i]?.falling) this.dirtyCells.add(i);
    }
  }

  /** Returns a Set covering every cell index; used by renderer on full-clear frames.
   *  Reuses a cached Set instead of allocating a new one each call. */
  allCells() {
    if (!this._allCellsCache || this._allCellsCache.size !== this.cells.length) {
      this._allCellsCache = new Set();
      for (let i = 0; i < this.cells.length; i++) this._allCellsCache.add(i);
    }
    return this._allCellsCache;
  }

  serialize() {
    // Shallow-clone each meta entry; null cells serialise as null.
    const metaClone = this.meta.map(m => m ? { ...m } : null);
    return {
      cols:  this.cols,
      rows:  this.rows,
      cells: Array.from(this.cells),
      meta:  metaClone,
    };
  }

  deserialize(data) {
    this.cols = data.cols;
    this.rows = data.rows;
    this.cells.set(data.cells);
    this.meta = data.meta;
    this.fullClearRequested = true;
  }

  /**
   * AAA Loader: Converts a LevelData object into a playable grid
   * @param {Object} level - From levels/levelData.js
   */
  loadArray(level) {
    // Standardize the dimensions from the level object
    this.cols = level.width || 11; 
    this.rows = level.height || 17;
    const size = this.cols * this.rows;

    // UPGRADE 4: Resize DirtyField to match the new grid dimensions.
    this.dirtyCells = new DirtyField(size);

    const mapData = level.map || level;

    this.cells = new Uint8Array(size);
    this.meta  = new Array(size).fill(null);
    
    for (let i = 0; i < size; i++) {
      // Fallback to DIRT (1) if the level data is truncated to prevent void-crashes
      const tile = mapData[i];
      this.cells[i] = (tile !== undefined && tile !== null) ? tile : TILE.DIRT;
    }
    
    this.fullClearRequested = true;
    this.dirtyCells.fill(0);
    this._allCellsCache = null; // invalidate cached full-cell set on level load
    // console.log only in explicit debug builds — not in production.
    if (typeof DEBUG_MODE !== 'undefined' && DEBUG_MODE) {
      console.log(`Grid loaded: ${this.cols}x${this.rows}, Name: ${level.name || 'Unknown'}`);
    }
  }

}

