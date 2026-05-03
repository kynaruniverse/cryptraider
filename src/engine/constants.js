// ============================================================
// CRYPT RAIDER v2 — Constants & Configuration
// Portrait-first mobile layout
// ============================================================

// Portrait grid: narrower, taller
// Target: fits ~375px wide phone with tiles of 32px → 11 cols × 17 rows
// We keep TILE_SIZE=32 and derive canvas at runtime in main.js
export const TILE_SIZE = 32;
export const COLS = 11;
export const ROWS = 17;
export const CANVAS_W = TILE_SIZE * COLS; // 352
// Calculate HUD based on a percentage of the play area for better mobile scaling
export const HUD_OFFSET = 44; // single source of truth — matches renderer and resizeCanvas
export const CANVAS_H   = (TILE_SIZE * ROWS) + HUD_OFFSET;

// --- Tile Type IDs ---
export const TILE = Object.freeze({
  EMPTY:          0,
  DIRT:           1,
  STONE:          2,
  GRAVEL:         3,
  BOULDER:        4,
  CRYSTAL:        5,
  DYNAMITE:       6,
  PORTAL:         7,
  MACHINE:        8,
  ENEMY_M:        9,   // Mummy
  ENEMY_F:        10,  // Fly
  PLAYER:         11,
  LADDER:         12,
  GEM:            13,
  DOOR:           14,
  KEY:            15,
  SAND:           16,
  PORTAL_OPEN:    17,  // Added for logic-renderer sync
  EXPLOSION:      18,  // Added for visual feedback logic
  GHOST_PLAYER:   19   // For death animations
});


// --- Game States ---
export const STATE = Object.freeze({
  BOOT:       'BOOT',
  MENU:       'MENU',
  STORY:      'STORY',
  PLAYING:    'PLAYING',
  PAUSED:     'PAUSED',
  LEVEL_WIN:  'LEVEL_WIN',
  LEVEL_FAIL: 'LEVEL_FAIL',
  GAME_OVER:  'GAME_OVER',
  GAME_WIN:   'GAME_WIN',
  CODE_ENTRY:   'CODE_ENTRY',
  HIGH_SCORES:  'HIGH_SCORES',
  LEVEL_START:  'LEVEL_START',});


// --- Directions ---
export const DIR = Object.freeze({
  UP:    { x:  0, y: -1, name: 'UP'    },
  DOWN:  { x:  0, y:  1, name: 'DOWN'  },
  LEFT:  { x: -1, y:  0, name: 'LEFT'  },
  RIGHT: { x:  1, y:  0, name: 'RIGHT' },
  NONE:  { x:  0, y:  0, name: 'NONE'  },
});

// --- Physics ---
// Standardizing intervals to divisors of 1000ms for smoother animation loops
export const GRAVITY_INTERVAL_MS      = 140; 
export const PLAYER_MOVE_INTERVAL_MS  = 120; // Slight buffer to prevent "jitter" on touch
export const INPUT_BUFFER_MS          = 200; // Time a swipe stays "active" in the queue


export const ENEMY_MOVE_INTERVAL_MS   = 400;
export const ENEMY_FLY_INTERVAL_MS    = 250;

// --- Scoring ---
export const SCORE = Object.freeze({
  CRYSTAL:  500,
  GEM:      200,
  ENEMY:    300,
  TIME_BONUS_PER_SEC: 10,
});

// --- Game Config ---
export const CONFIG = Object.freeze({
  STARTING_LIVES: 3,
  MAX_ENERGY:     100,
  ENERGY_LOSS:    34,
  LEVEL_TIME:     300,
  TOTAL_LEVELS:   100,
  SAFE_FALL_TILES: 2,
});

// --- Level Code Salt ---
export const CODE_SALT = 'CRYPTRAIDER2003';
