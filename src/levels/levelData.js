// ============================================================
// CRYPT RAIDER v2 — Level Definitions
// Grid: 11 cols × 17 rows = 187 tiles per level (portrait)
// Inner playfield: 9 cols × 15 rows (stone border)
// ============================================================

const _ = 0;  // EMPTY
const D = 1;  // DIRT
const S = 2;  // STONE
const G = 3;  // GRAVEL
const B = 4;  // BOULDER
const C = 5;  // CRYSTAL
const Z = 6;  // DYNAMITE
const P = 7;  // PORTAL
const M = 8;  // MACHINE
const X = 9;  // MUMMY
const F = 10; // FLY
const L = 11; // PLAYER start
const A = 12; // LADDER
const E = 13; // GEM
const O = 14; // DOOR
const K = 15; // KEY
const N = 16; // SAND

// Wrap 9×15 inner grid with stone border → 11×17
// Returns a proper level object compatible with Grid.loadArray()
function stoneFrame(inner, name = '') {
  const W = 11, H = 17;
  const IW = 9;
  const out = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x === 0 || x === W-1 || y === 0 || y === H-1) out.push(S);
      else out.push(inner[(y-1) * IW + (x-1)]);
    }
  }
  return { width: W, height: H, map: out, name };
}

// ── Seeded RNG ────────────────────────────────────────────
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateLevel(levelIndex) {
  // LevelIndex starts at 5 for the first procedural level
  const seed = levelIndex * 7919 + 42; 
  const rng = mulberry32(seed);
  
  // Difficulty scaling factors
  const difficulty = Math.min(1.0, (levelIndex - 5) / 50); 

  const IW = 9, IH = 15;
  const inner = new Array(IW * IH).fill(D);

  const place = (x, y, tile) => { inner[y * IW + x] = tile; };
  const get   = (x, y) => inner[y * IW + x];

  // Create "Crypt Chambers" — Horizontal/Vertical stone dividers
  const numWalls = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < numWalls; i++) {
    const isVert = rng() > 0.5;
    const wx = Math.floor(rng() * (IW - 2)) + 1;
    const wy = Math.floor(rng() * (IH - 4)) + 2;
    const len = 3 + Math.floor(rng() * 4);

    for (let j = 0; j < len; j++) {
      const nx = isVert ? wx : wx + j;
      const ny = isVert ? wy + j : wy;
      if (nx < IW && ny < IH) {
        // Leave "gaps" for doors/passage every 3 tiles
        if (j % 3 !== 0) place(nx, ny, S);
      }
    }
  }


  // Player — top-left area
  place(0, 0, L);

  // Crystals (2–4)
  const nc = 2 + Math.floor(rng() * 3);
  let placed = 0, attempts = 0;
  while (placed < nc && attempts < 200) {
    attempts++;
    const cx = Math.floor(rng() * IW);
    const cy = Math.floor(rng() * IH);
    if (get(cx, cy) === D) { place(cx, cy, C); placed++; }
  }

  // Machine
  attempts = 0;
  while (attempts < 200) {
    attempts++;
    const mx = Math.floor(rng() * IW);
    const my = 4 + Math.floor(rng() * (IH - 6));
    if (get(mx, my) === D) { place(mx, my, M); break; }
  }

  // Portal
  attempts = 0;
  while (attempts < 200) {
    attempts++;
    const px = Math.floor(rng() * IW);
    const py = Math.floor(rng() * IH);
    if (get(px, py) === D) { place(px, py, P); break; }
  }

  // Boulders
  const nb = 1 + Math.floor(rng() * 2);
  for (let b = 0; b < nb; b++) {
    attempts = 0;
    while (attempts < 100) {
      attempts++;
      const bx = 1 + Math.floor(rng() * (IW - 2));
      const by = Math.floor(rng() * (IH - 2));
      if (get(bx, by) === D && get(bx, by + 1) === D) { place(bx, by, B); break; }
    }
  }

  // Gem (optional)
  if (rng() > 0.4) {
    attempts = 0;
    while (attempts < 100) {
      attempts++;
      const gx = Math.floor(rng() * IW);
      const gy = Math.floor(rng() * IH);
      if (get(gx, gy) === D) { place(gx, gy, E); break; }
    }
  }

  // Enemy Logic (Scaling by levelIndex, not seed)
  const maxEnemies = levelIndex < 15 ? 1 : (levelIndex < 30 ? 2 : 3);
  
  for (let i = 0; i < maxEnemies; i++) {
    const useFlyer = rng() < (0.2 + difficulty * 0.4); // More flyers as levels progress
    attempts = 0;
    while (attempts < 50) {
      const ex = Math.floor(rng() * IW);
      const ey = Math.floor(rng() * IH);
      // Don't spawn enemies right on top of the player (0,0)
      if (get(ex, ey) === D && (ex > 2 || ey > 2)) { 
        place(ex, ey, useFlyer ? F : X); 
        break; 
      }
      attempts++;
    }
  }

  // Gravel (Rare floor detail)
  if (rng() > 0.6) {
    const gx = Math.floor(rng() * IW);
    const gy = Math.floor(rng() * IH);
    if (get(gx, gy) === D) place(gx, gy, G);
  }

  // Gravel
  if (rng() > 0.4) {
    const gx = Math.floor(rng() * IW);
    if (get(gx, 0) === D) place(gx, 0, G);
  }

  // EVOLUTION: Add Puzzle complexity (Keys/Doors) from level 10+
  if (levelIndex >= 10 && rng() > 0.5) {
    let kx = Math.floor(rng() * IW), ky = Math.floor(rng() * IH);
    let dx = Math.floor(rng() * IW), dy = Math.floor(rng() * IH);
    if (get(kx, ky) === D && get(dx, dy) === D) {
      place(kx, ky, K);
      place(dx, dy, O);
    }
  }
  
  // Reachability Pass: Ensure essential tiles (Machine, Portal, Crystals) 
  // aren't completely surrounded by Stone (S)
  [M, P, C].forEach(targetTile => {
    for (let y = 0; y < IH; y++) {
      for (let x = 0; x < IW; x++) {
        if (get(x, y) === targetTile) {
          // Check all 4 directions; if all are Stone, force one to DIRT
          const neighbors = [[-1,0],[1,0],[0,-1],[0,1]];
          const allStone = neighbors.every(([ox, oy]) => {
            const nx = x + ox, ny = y + oy;
            return !inner[ny * IW + nx] || inner[ny * IW + nx] === S;
          });
          
          if (allStone) {
             if (x > 0) place(x-1, y, D);
             else if (y > 0) place(x, y-1, D);
          }
        }
      }
    }
  });

  return stoneFrame(inner);
}

// ─────────────────────────────────────────────────────────
//  HAND-CRAFTED LEVELS 1–5
//  Inner = 9 cols × 15 rows, left to right, top to bottom
// ─────────────────────────────────────────────────────────

export const LEVELS = [

// ── Level 1 — Tutorial ──────────────────────────────────
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,D,D,
  D,D,D,C,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,S,S,D,D,D,
  D,D,D,D,S,_,D,D,D,
  D,D,D,D,_,_,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,C,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,M,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,P,D,
], 'The Entrance'),

// ── Level 2 — Boulder puzzle ────────────────────────────
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,S,S,S,D,D,D,D,
  D,D,S,B,S,D,D,D,D,
  D,D,_,_,_,D,D,D,D,
  D,D,D,D,D,D,C,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,C,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,M,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,P,D,D,
], 'Heavy Burden'),

// ── Level 3 — First mummy ───────────────────────────────
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,C,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  S,S,S,S,S,_,_,S,S,
  _,_,_,_,_,_,_,_,_,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,X,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,C,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,M,D,D,D,D,
  D,D,D,D,D,P,D,D,D,
], 'The Guardian'),

// ── Level 4 — Ladder escape ─────────────────────────────
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  S,S,S,S,S,S,_,S,S,
  D,D,D,D,D,D,A,D,D,
  D,D,D,D,D,D,A,D,D,
  D,D,D,C,D,D,A,D,D,
  S,S,_,S,S,S,S,S,S,
  D,D,A,D,D,D,D,D,D,
  D,D,A,D,D,D,D,D,D,
  D,D,D,D,D,C,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,M,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,P,D,D,D,
], 'Vertical Limits'),

// ── Level 5 — Key + Door ────────────────────────────────
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,C,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  S,S,S,S,O,S,S,S,S,
  D,D,D,D,_,D,D,D,D,
  D,D,K,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,C,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,X,D,D,D,
  D,D,D,M,D,D,D,D,D,
  D,D,D,D,D,P,D,D,D,
], 'The Locked Vault'),

// ── Level 6 — TNT Introduction ──────────────────────────
stoneFrame([
  D,L,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,S,S,S,S,S,D,D,
  D,D,S,C,S,C,S,D,D,
  D,D,S,S,S,S,S,D,D,
  D,D,D,D,Z,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,S,S,S,S,S,S,S,D,
  D,S,_,_,_,_,_,S,D,
  D,S,_,M,_,P,_,S,D,
  D,S,S,S,S,S,S,S,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
], 'Blasting Zone'),

// ── Level 7 — The Great Gravel Pit ─────────────────────
stoneFrame([
  D,L,D,G,G,G,D,D,D,
  D,G,G,G,G,G,G,G,D,
  G,G,C,G,G,G,C,G,G,
  G,G,G,G,G,G,G,G,G,
  G,G,G,G,B,G,G,G,G,
  D,G,G,G,G,G,G,G,D,
  D,D,G,G,M,G,G,D,D,
  D,D,D,G,G,G,D,D,D,
  D,D,D,D,P,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
], 'Unstable Ground'),

// ── Level 8 — Twin Mummies ─────────────────────────────
stoneFrame([
  D,L,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  S,S,S,D,D,D,S,S,S,
  C,D,S,D,D,D,S,D,C,
  D,D,S,D,D,D,S,D,D,
  D,D,D,D,D,D,D,D,D,
  D,X,D,D,M,D,D,X,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,P,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
], 'Double Trouble'),

// ── Level 9 — Sandstorm ────────────────────────────────
stoneFrame([
  D,L,D,D,D,D,D,D,D,
  D,N,N,N,N,N,N,N,D,
  D,N,C,N,N,N,C,N,D,
  D,N,N,N,N,N,N,N,D,
  D,N,N,N,B,N,N,N,D,
  D,N,N,N,N,N,N,N,D,
  D,N,N,N,M,N,N,N,D,
  D,N,N,N,N,N,N,N,D,
  D,D,D,D,P,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
], 'Shifting Sands'),

// ── Level 10 — The Crossroad ───────────────────────────
stoneFrame([
  D,D,D,D,C,D,D,D,D,
  D,D,D,D,A,D,D,D,D,
  D,D,D,D,A,D,D,D,D,
  C,A,A,A,L,A,A,A,C,
  D,D,D,D,A,D,D,D,D,
  D,D,D,D,A,D,D,D,D,
  D,D,D,D,M,D,D,D,D,
  D,D,D,D,P,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
], 'The Great Hub'),

// ── Level 11 — Fly Swatter ────────────────────────────
stoneFrame([
  D,L,D,D,D,D,D,D,D,
  D,D,D,D,F,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,C,D,C,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,F,D,D,D,F,D,D,
  D,D,D,D,M,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,P,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
], 'Buzzing Chambers'),

// ── Level 12 — Gem Hunt ───────────────────────────────
stoneFrame([
  D,L,D,D,D,D,D,D,D,
  D,E,D,D,D,D,D,E,D,
  D,D,D,D,S,D,D,D,D,
  D,D,D,S,C,S,D,D,D,
  D,D,D,D,S,D,D,D,D,
  D,E,D,D,D,D,D,E,D,
  D,D,D,D,M,D,D,D,D,
  D,D,D,D,P,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
], 'Treasury Room'),

// ── Level 13 — Boulder Run ────────────────────────────
stoneFrame([
  D,L,D,B,D,B,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  C,D,D,D,D,D,D,D,C,
  S,S,S,S,D,S,S,S,S,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,M,D,D,D,D,
  D,D,D,D,P,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
], 'The Avalanche'),

// ── Level 14 — Dig Deep ───────────────────────────────
stoneFrame([
  D,L,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  S,S,S,S,S,S,S,S,S,
  C,D,D,D,D,D,D,D,C,
  S,S,S,S,S,S,S,S,S,
  D,D,D,M,D,P,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
], 'The Layer Cake'),

// ── Level 15 — Master Challenge ───────────────────────
stoneFrame([
  D,L,D,D,S,D,D,C,D,
  D,D,D,D,S,D,D,D,D,
  D,X,D,D,S,D,D,F,D,
  S,S,O,S,S,D,D,D,D,
  D,D,_,D,D,D,D,D,D,
  D,K,D,D,D,B,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,M,D,D,D,D,
  D,D,D,D,P,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
], 'The Final Trial'),

];

// Procedural levels start at 16 (index 15)
for (let i = 15; i < 100; i++) {
  const gen = generateLevel(i + 1);
  gen.name = `Catacomb ${i + 1}`;
  LEVELS.push(gen);
}

