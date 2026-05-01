// ============================================================
// CRYPT RAIDER — AAA Spatial Grid Engine
// Optimized for memory locality, fast queries, and delta tracking
// ============================================================

import { TILE, COLS, ROWS } from './constants.js';

// Bitwise flags for ultra-fast property checking
const FLAG = {
  SOLID:    1 << 0,
  DIGGABLE: 1 << 1,
  PASSABLE: 1 << 2,
  GRAVITY:  1 << 3,
  COLLECT:  1 << 4,
  DANGEROUS:1 << 5
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
define(TILE.LADDER,   FLAG.PASSABLE);
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

export class Grid {
  constructor(cols = COLS, rows = ROWS) {
    this.cols = cols;
    this.rows = rows;
    const size = cols * rows;

    this.cells = new Uint8Array(size); 
    // Initialize with empty objects to prevent null-pointer exceptions in systems
    this.meta  = Array.from({ length: size }, () => ({}));

    
    // AAA Feature: Dirty tracking for rendering optimization
    this.dirtyCells = new Set();
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

  getMeta(x, y)    { return this.inBounds(x, y) ? this.meta[this.idx(x, y)] : null; }
  setMeta(x, y, v) { 
    if (this.inBounds(x, y)) {
      this.meta[this.idx(x, y)] = v;
      this.dirtyCells.add(this.idx(x, y));
    }
  }

  clear(x, y) {
    if (!this.inBounds(x, y)) return;
    const i = this.idx(x, y);
    this.cells[i] = TILE.EMPTY;
    this.meta[i]  = {}; // Reset to empty object
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

  // ── Advanced Spatial Logic ────────────────────────────────
  
  /** Moves an entity and its metadata atomically */
  moveEntity(fx, fy, tx, ty) {
    const type = this.get(fx, fy);
    // Use structuredClone or spread to ensure we aren't passing by reference
    const meta = { ...(this.getMeta(fx, fy) || {}) };
    
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
    this.dirtyCells.clear(); 
    this.fullClearRequested = false; 

    // Re-add cells that have ongoing animations so the renderer doesn't skip them
    for (let i = 0; i < this.meta.length; i++) {
      if (this.meta[i]?.falling) this.dirtyCells.add(i);
    }
  }

  serialize() {
    return {
      cols: this.cols,
      rows: this.rows,
      cells: Array.from(this.cells),
      meta: JSON.parse(JSON.stringify(this.meta)) // Deep clone
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

    // Use standard Array if Uint8Array causes ID mismatch, 
    // and ensure we handle the 'map' property correctly
    const mapData = level.map || level; 
    
    this.cells = new Uint8Array(size);
    this.meta = Array.from({ length: size }, () => ({}));
    
    for (let i = 0; i < size; i++) {
      // Fallback to DIRT (1) if the level data is truncated to prevent void-crashes
      const tile = mapData[i];
      this.cells[i] = (tile !== undefined && tile !== null) ? tile : TILE.DIRT;
    }
    
    this.fullClearRequested = true;
    this.dirtyCells.clear();
    console.log(`Grid loaded: ${this.cols}x${this.rows}, Name: ${level.name || 'Unknown'}`);
  }

}

