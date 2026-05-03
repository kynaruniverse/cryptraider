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
      if (x === 0 || x === W-1 || y === 0 || y === H-1) {
        out.push(S);
      } else {
        const val = inner[(y-1) * IW + (x-1)];
        // If val is missing (undefined), push DIRT (D) instead of crashing
        out.push(val !== undefined ? val : D); 
      }
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
  // levelIndex is 1-based (16 = first procedural level)
  const seed = levelIndex * 7919 + 42;
  const rng  = mulberry32(seed);

  // 0.0 at level 16 → 1.0 at level 66+
  const difficulty = Math.min(1.0, (levelIndex - 16) / 50);

  const IW = 9, IH = 15;
  const inner = new Array(IW * IH).fill(D);
  const place = (x, y, tile) => {
    if (x >= 0 && x < IW && y >= 0 && y < IH) inner[y * IW + x] = tile;
  };
  const get = (x, y) => {
    if (x < 0 || x >= IW || y < 0 || y >= IH) return S;
    return inner[y * IW + x];
  };

  // ── 1. Player spawn — always top row, left third ──────────
  const playerX = Math.floor(rng() * 3);
  place(playerX, 0, L);

  // ── 2. Stone wall dividers (horizontal only, guaranteed gaps) ─
  // Each wall gets exactly one gap so the level is never sealed.
  const numWalls = 1 + Math.floor(rng() * Math.min(3, 1 + difficulty * 3));
  const wallRows = new Set();
  for (let w = 0; w < numWalls; w++) {
    let wy;
    let wAttempts = 0;
    do { wy = 2 + Math.floor(rng() * (IH - 5)); wAttempts++; }
    while (wallRows.has(wy) && wAttempts < 20);
    wallRows.add(wy);

    // Full-width stone wall
    for (let x = 0; x < IW; x++) place(x, wy, S);

    // One guaranteed passable gap — never at the very edge
    const gapX = 1 + Math.floor(rng() * (IW - 2));
    place(gapX, wy, _); // gap

    // Add a ladder in the gap shaft going down SAFE_FALL_TILES rows
    // so the player can descend without dying (3 tile drop = death).
    // Ladder runs from the gap row downward for 3 tiles.
    for (let ly = wy + 1; ly <= Math.min(wy + 3, IH - 1); ly++) {
      if (get(gapX, ly) === D) place(gapX, ly, A);
    }
  }

  // ── 3. Sand rows (crumbling floors) — scaled by difficulty ─
  const numSandRows = Math.floor(difficulty * 2);
  for (let s = 0; s < numSandRows; s++) {
    const sy = 3 + Math.floor(rng() * (IH - 6));
    // Don't overwrite wall rows or player row
    if (!wallRows.has(sy) && get(playerX, sy) !== L) {
      // Partial sand row — leave two gaps so player isn't trapped
      for (let x = 0; x < IW; x++) {
        if (rng() > 0.25) place(x, sy, N);
      }
    }
  }

  // ── 4. Machine — lower half, never in wall row ────────────
  let mx, my;
  let mAttempts = 0;
  do {
    mx = Math.floor(rng() * IW);
    my = Math.floor(IH * 0.55) + Math.floor(rng() * Math.floor(IH * 0.35));
    mAttempts++;
  } while ((get(mx, my) !== D || wallRows.has(my)) && mAttempts < 200);
  place(mx, my, M);

  // ── 5. Portal — bottom quarter, away from machine ─────────
  let px, py;
  let pAttempts = 0;
  do {
    px = Math.floor(rng() * IW);
    py = Math.floor(IH * 0.75) + Math.floor(rng() * Math.floor(IH * 0.2));
    pAttempts++;
  } while ((get(px, py) !== D || wallRows.has(py) ||
            (Math.abs(px - mx) + Math.abs(py - my)) < 3) && pAttempts < 200);
  place(px, py, P);

  // ── 6. Crystals — 2 to 4, distributed across quarters ────
  const numCrystals = 2 + Math.floor(rng() * 3);
  let cPlaced = 0, cAttempts = 0;
  while (cPlaced < numCrystals && cAttempts < 300) {
    cAttempts++;
    const cx = Math.floor(rng() * IW);
    const cy = Math.floor(rng() * IH);
    if (get(cx, cy) === D && !wallRows.has(cy)) {
      place(cx, cy, C);
      cPlaced++;
    }
  }

  // ── 7. Boulders — on solid ground, not above player ───────
  const numBoulders = Math.floor(1 + rng() * (1 + difficulty * 2));
  for (let b = 0; b < numBoulders; b++) {
    let bAttempts = 0;
    while (bAttempts < 80) {
      bAttempts++;
      const bx = 1 + Math.floor(rng() * (IW - 2));
      const by = 1 + Math.floor(rng() * (IH - 3));
      // Boulder needs dirt below it (not a wall) and dirt at position
      if (get(bx, by) === D && get(bx, by + 1) === D && !wallRows.has(by)) {
        place(bx, by, B);
        break;
      }
    }
  }

  // ── 8. Enemies — scale count and type ────────────────────
  const maxEnemies = Math.min(4, 1 + Math.floor(difficulty * 3));
  for (let e = 0; e < maxEnemies; e++) {
    const useFlyer = rng() < (0.15 + difficulty * 0.5);
    let eAttempts = 0;
    while (eAttempts < 60) {
      eAttempts++;
      const ex = Math.floor(rng() * IW);
      const ey = 2 + Math.floor(rng() * (IH - 3));
      // Keep enemies away from player spawn (top-left)
      if (get(ex, ey) === D && !wallRows.has(ey) &&
          (ex > playerX + 2 || ey > 2)) {
        place(ex, ey, useFlyer ? F : X);
        break;
      }
    }
  }

  // ── 9. Dynamite + sealed stone rooms (level 20+) ──────────
  if (levelIndex >= 20) {
    // Chance of a sealed stone box containing a crystal
    if (rng() > 0.4) {
      let rAttempts = 0;
      while (rAttempts < 50) {
        rAttempts++;
        const rx = 1 + Math.floor(rng() * (IW - 4));
        const ry = 1 + Math.floor(rng() * (IH - 5));
        // Check 3×3 area is all dirt
        let clear = true;
        for (let dy = 0; dy < 3 && clear; dy++)
          for (let dx = 0; dx < 3 && clear; dx++)
            if (get(rx + dx, ry + dy) !== D) clear = false;
        if (clear && !wallRows.has(ry) && !wallRows.has(ry + 2)) {
          // Build stone box
          for (let dy = 0; dy < 3; dy++)
            for (let dx = 0; dx < 3; dx++)
              place(rx + dx, ry + dy, S);
          // Crystal inside
          place(rx + 1, ry + 1, C);
          // Machine inside if no machine placed yet
          if (get(mx, my) !== M) place(rx + 1, ry + 1, M);
          // Dynamite just outside box
          const dzx = rx + 1, dzy = Math.max(0, ry - 1);
          if (get(dzx, dzy) === D) place(dzx, dzy, Z);
          break;
        }
      }
    }
  }

  // ── 10. Key + door puzzle (level 25+, 50% chance) ─────────
  if (levelIndex >= 25 && rng() > 0.5) {
    // Place key in top half, door in a wall row
    const wallRowArr = Array.from(wallRows);
    if (wallRowArr.length > 0) {
      const doorWall = wallRowArr[Math.floor(rng() * wallRowArr.length)];
      // Find the existing gap in that wall row and put a door there
      for (let x = 0; x < IW; x++) {
        if (get(x, doorWall) === _) {
          place(x, doorWall, O); // door replaces the gap
          // Remove ladders in this gap (key required instead)
          for (let ly = doorWall + 1; ly <= doorWall + 3; ly++) {
            if (get(x, ly) === A) place(x, ly, D);
          }
          // Key somewhere in top half
          let kAttempts = 0;
          while (kAttempts < 100) {
            kAttempts++;
            const kx = Math.floor(rng() * IW);
            const ky = Math.floor(rng() * doorWall);
            if (get(kx, ky) === D) { place(kx, ky, K); break; }
          }
          break;
        }
      }
    }
  }

  // ── 11. Gravel patches (level 18+) ────────────────────────
  if (levelIndex >= 18) {
    const numGravel = Math.floor(rng() * 4);
    for (let g = 0; g < numGravel; g++) {
      const gx = Math.floor(rng() * IW);
      const gy = Math.floor(rng() * IH);
      if (get(gx, gy) === D && !wallRows.has(gy)) place(gx, gy, G);
    }
  }

  // ── 12. Gems (optional bonus, level 20+) ──────────────────
  if (levelIndex >= 20 && rng() > 0.5) {
    let gAttempts = 0;
    while (gAttempts < 50) {
      gAttempts++;
      const gx = Math.floor(rng() * IW);
      const gy = Math.floor(rng() * IH);
      if (get(gx, gy) === D && !wallRows.has(gy)) { place(gx, gy, E); break; }
    }
  }

  // ── 13. Reachability pass ─────────────────────────────────
  // Ensure M, P, and every C has at least one non-stone neighbour.
  // This prevents essential tiles from being completely walled in
  // by random stone overlap.
  [M, P, C].forEach(targetTile => {
    for (let y = 0; y < IH; y++) {
      for (let x = 0; x < IW; x++) {
        if (get(x, y) !== targetTile) continue;
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        const allBlocked = dirs.every(([ox, oy]) => {
          const t = get(x + ox, y + oy);
          return t === S || t === M || t === P || t === O;
        });
        if (allBlocked) {
          // Force the cell above to be dirt (always safe direction)
          if (y > 0 && get(x, y - 1) === S) place(x, y - 1, D);
          else if (x > 0 && get(x - 1, y) === S) place(x - 1, y, D);
        }
      }
    }
  });

  return stoneFrame(inner, `Catacomb ${levelIndex}`);
}


// ─────────────────────────────────────────────────────────
//  HAND-CRAFTED LEVELS 1–5
//  Inner = 9 cols × 15 rows, left to right, top to bottom
// ─────────────────────────────────────────────────────────

export const LEVELS = [

// ── Level 1 — The Entrance ──────────────────────────────
// Teaches: dig dirt, collect crystals, reach machine + portal.
// No enemies, no hazards. Pure orientation.
// Crystals are close, machine and portal clearly visible below.
// Fall: player starts on solid floor throughout — no drops.
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,C,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,C,D,D,D,
  D,D,D,D,D,D,D,M,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,P,D,
], 'The Entrance'),

// ── Level 2 — Gravity Falls ─────────────────────────────
// Teaches: fall system. Two safe drops (≤2 tiles). Player must
// step off edges deliberately to descend. No enemies.
// SAFE_FALL_TILES=2 so drop of exactly 2 is fine.
// Layout: two shelf drops, crystals below, clear floor at bottom.
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  S,S,S,S,S,D,D,D,D,  // shelf — drop right side (2 tiles to next floor)
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  S,D,D,D,S,S,S,S,S,  // lower shelf — drop left side
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,C,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,C,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,M,D,D,D,D,
  D,D,D,D,D,D,P,D,D,
], 'Gravity Falls'),

// ── Level 3 — The Guardian ──────────────────────────────
// Mummy only moves through EMPTY cells — pre-cleared corridors
// define its patrol zone in the bottom half.
// Top half: player + crystal, fully sealed by stone wall.
// Bottom half: open loop corridor for mummy to patrol.
// Crystal sits in a dirt pocket just off the corridor —
// player must step into the open loop to grab it, timing
// around the mummy. Machine and portal at the bottom.
//
// Pre-cleared bottom layout (inner rows 6-14):
//   Row 6:  _ _ _ _ _ _ A _ _   (ladder bottom)
//   Row 7:  _ D D D D D _ D _   (open sides, dirt centre)
//   Row 8:  _ D C D D D _ D _   (crystal in dirt pocket left)
//   Row 9:  _ _ _ _ _ _ _ _ _   (open corridor full width)
//   Row 10: D _ D D D D _ D D   (open corridor with dirt pockets)
//   Row 11: _ _ _ _ X _ _ _ _   (mummy in open corridor)
//   Row 12: _ D D D D D D D _   (open sides, dirt centre)
//   Row 13: _ _ _ _ M _ _ _ _   (machine in open corridor)
//   Row 14: _ _ _ _ _ P _ _ _   (portal)
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,C,D,D,D,D,D,  // crystal — grab before descending
  D,D,D,D,D,D,D,D,D,
  S,S,S,S,S,S,_,S,S,  // sealed wall, single gap col 6
  _,_,_,_,_,_,A,_,_,  // bottom of ladder + open corridor
  _,D,D,D,D,D,_,D,_,  // open left+right, dirt pockets
  _,D,C,D,D,D,_,D,_,  // crystal in dirt pocket — must dig to grab
  _,_,_,_,_,_,_,_,_,  // full open corridor — mummy patrols here
  D,_,D,D,D,D,_,D,D,
  _,_,_,_,X,_,_,_,_,  // mummy in open space
  _,D,D,D,D,D,D,D,_,
  _,_,_,_,M,_,_,_,_,
  _,_,_,_,_,P,_,_,_,
], 'The Guardian'),

// ── Level 4 — The Ladder Shaft ──────────────────────────
// Teaches: ladders. Two stone walls divide the level into 3 tiers.
// Each tier has a gap bridged only by a ladder column.
// Drop without ladder = 3 tiles = death. Player MUST use ladders.
// One crystal per tier. Machine + portal on bottom tier.
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,D,D,
  D,D,D,D,C,D,D,D,D,
  S,S,S,S,S,S,_,S,S,  // gap at col 6 (grid col 7) — ladder below it
  D,D,D,D,D,D,A,D,D,
  D,D,D,D,D,D,A,D,D,
  D,D,D,C,D,D,A,D,D,
  S,S,_,S,S,S,S,S,S,  // gap at col 2 (grid col 3) — ladder below
  D,D,A,D,D,D,D,D,D,
  D,D,A,D,D,D,D,D,D,
  D,D,D,D,D,C,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,M,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,P,D,D,D,
], 'The Ladder Shaft'),

// ── Level 5 — Key & Gate ────────────────────────────────
// Teaches: key + door mechanic combined with mummy threat.
//
// TOP HALF (inner rows 0-5):
//   Player spawns top-left. Key is top-RIGHT — requires crossing
//   the full width before coming back to the door (col 1).
//   Crystal is mid-top, reward for the detour.
//
// WALL (inner row 6): Full stone. Door at col 1 (left side).
//   Ladder runs from door gap down 4 rungs to solid floor at row 11.
//   Crucially: the ladder column (col 1) is WALLED OFF from the
//   mummy patrol loop by dirt — mummy cannot reach the ladder gap
//   even after door opens. This seals the top half permanently.
//
// BOTTOM HALF (inner rows 7-14):
//   Pre-cleared U-shaped corridor: down col 7, across row 11,
//   up col 1 stops at the ladder base (row 11) — mummy patrols
//   the U but col 1 above row 11 is the ladder (LADDER tile,
//   not EMPTY) so mummy BFS won't enter it.
//   Crystal sits in a dirt pocket at inner(4,9) — player must
//   dig one tile to reach it, then is safe (floor at row 10).
//   Machine at inner(4,13), portal inner(7,14).
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,C,D,D,D,K,D,  // crystal mid-top, key far right — forces wide detour
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  S,O,S,S,S,S,S,S,S,  // door at inner col 1 (left side of wall)
  _,A,D,D,D,D,D,_,D,  // ladder col 1, open col 0+7, dirt elsewhere
  _,A,D,D,D,D,D,_,D,  // ladder continues
  _,A,D,C,D,D,D,_,D,  // ladder + crystal in dirt pocket at col 3
  _,A,D,D,D,D,D,_,D,  // ladder base row — open col 0+7 form U sides
  _,_,_,_,_,_,_,_,_,  // full open corridor — U bottom, mummy patrols here
  _,D,D,D,X,D,D,D,_,  // mummy in open space, dirt pockets prevent escape up
  _,_,_,_,M,_,_,_,_,  // machine in open corridor
  _,_,_,_,_,_,_,P,_,  // portal far right bottom
], 'Key & Gate'),

// ── Level 6 — Blasting Zone ──────────────────────────────
// Teaches: dynamite blasts inner stone from the SIDE, player retreats away.
//
// Layout:
//   Crystal box: inner cols 0-2, rows 2-4. Sealed left+top+bottom by stone.
//   Right wall of box at col 2 — player approaches from col 3.
//   Dynamite Z at col 3 row 3 blasts the box right wall exposing crystals.
//
//   Ladder shaft col 7 rows 1-6 — safe descent to mid-level corridor.
//   Row 8 is a PARTIAL stone wall with two gaps already open (cols 3 and 6)
//   so the player can descend without dynamite.
//   Two dynamites in the lower area for the sealed crystal room at row 10-11.
//   Machine col 6 row 12, portal col 4 row 14.
//
// VERIFIED: The wall at inner row 8 is no longer full-width — gaps exist at
//   col 3 and col 6 so the player can always reach the lower half regardless
//   of whether they have dynamite remaining.
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,A,D,  // player top-left, ladder top-right
  S,S,S,D,D,D,D,A,D,  // stone box left wall top, ladder
  S,C,S,Z,D,D,D,A,D,  // crystal in box, dynamite outside at col 3, ladder
  S,C,S,D,D,D,D,A,D,  // second crystal, open approach col 3+, ladder
  S,S,S,D,D,D,D,A,D,  // stone box left wall bottom, ladder
  D,D,D,D,D,D,D,_,D,  // open corridor, ladder base (gap in wall at col 7)
  D,D,D,D,D,D,D,D,D,  // open row — player walks freely
  S,S,S,_,S,S,_,S,S,  // BUG FIX: partial wall — gaps at col 3 AND col 6 allow passage
  D,D,D,D,D,D,D,D,D,  // open below wall
  D,D,D,Z,D,D,Z,D,D,  // two dynamites: col 3 and col 6 for optional sealed rooms
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,M,D,D,  // machine col 6
  D,D,D,D,P,D,D,D,D,  // portal col 4
  D,D,D,D,D,D,D,D,D,
], 'Blasting Zone'),


// ── Level 7 — Boulder Run ───────────────────────────────
// Teaches: boulders fall when space opens below them.
// Two boulders sit on stone ledges with gaps underneath.
// Player must collect crystals without standing under a gap.
// Mummy starts in dirt — will dig toward player over time.
// No dynamite. Machine and portal in open bottom half.
// Mummy spawns bottom-left, player top-left — wide separation.
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,S,B,D,B,S,D,D,  // boulders on stone ledges
  D,D,S,_,D,_,S,D,D,  // gaps — boulders fall into here
  D,D,D,D,D,D,D,D,D,
  D,C,D,D,D,D,D,C,D,  // crystals flanking the danger zone
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,X,D,D,D,D,D,D,D,  // mummy bottom-left
  D,D,D,D,M,D,D,D,D,
  D,D,D,D,D,D,P,D,D,
], 'Boulder Run'),

// ── Level 8 — The Sand Shelf ────────────────────────────
// Teaches: sand is passable — player walks through it.
// Sand rows support boulders. When player digs adjacent dirt
// creating a path, the boulder can slide off the stone edge
// and fall. Crystals are below the sand shelf — player walks
// through sand to reach them then escapes sideways.
// Mummy in lower half, starts in open dirt near machine.
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,B,D,D,D,B,D,D,  // boulders above sand
  D,D,N,D,D,D,N,D,D,  // sand columns — walk through, boulder falls
  D,D,D,D,D,D,D,D,D,
  D,D,D,C,D,C,D,D,D,  // crystals below sand columns — safe after boulder falls
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,X,D,D,D,D,D,  // mummy lower half
  D,D,D,D,M,D,D,D,D,
  D,D,D,D,D,P,D,D,D,
], 'Sand Shelf'),

// ── Level 9 — Gravel Drop ───────────────────────────────
// Teaches: gravel is SOLID+GRAVITY — falls like boulders,
// CANNOT be dug by the player. Creates blocking falling debris.
// Gravel columns above empty space — fall immediately on load.
// Player must read the falling pattern and avoid being under them.
// Crystals are beside the gravel fall zones, not under them.
// One fly for pressure — moves fast, ignores terrain.
// Mummy in bottom half open corridor.
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,D,D,
  D,D,G,D,D,D,G,D,D,  // gravel will fall into empty below
  D,D,G,D,D,D,G,D,D,
  D,D,_,D,D,D,_,D,D,  // empty — gravel falls here then lands
  D,D,D,D,D,D,D,D,D,
  D,C,D,D,D,D,D,C,D,  // crystals safely BESIDE the gravel columns
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,F,D,D,D,D,D,  // fly mid-level
  D,D,D,D,D,D,D,D,D,
  D,D,D,X,D,D,D,D,D,  // mummy lower half
  D,D,D,D,M,D,D,D,D,
  D,D,D,D,D,P,D,D,D,
], 'Gravel Drop'),

// ── Level 10 — Pillar Maze ──────────────────────────────
// Teaches: navigating tight corridors under enemy pressure.
// Stone pillars create a maze. Two mummies patrol separate
// corridors — they cannot cross the pillars.
// Four crystals hidden in dead-end pockets.
// Player must enter each pocket, grab crystal, back out
// before the mummy closes the corridor exit.
// Machine + portal in the open bottom zone.
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,D,D,
  D,D,S,D,D,D,S,D,D,
  D,D,S,D,C,D,S,D,D,  // crystal in each pillar pocket
  D,D,S,D,D,D,S,D,D,
  D,C,D,D,D,D,D,C,D,  // crystals in outer corridor
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,X,D,D,D,D,D,X,D,  // mummies in outer corridors
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,M,D,D,D,D,
  D,D,D,D,D,P,D,D,D,
], 'Pillar Maze'),

// ── Level 11 — Fly Hunters ──────────────────────────────
// Teaches: flies move faster than mummies, ignore terrain.
// Three flies chase the player across the full open grid.
// Stone walls create temporary cover — flies must navigate
// around them one step at a time (they are blocked by SOLID).
// No mummies — pure speed challenge.
// Machine + portal in fixed bottom positions.
// Player must collect both crystals then reach machine fast.
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,S,S,D,S,S,D,D,  // stone cover top
  D,D,D,D,D,D,D,D,D,
  D,F,D,C,D,C,D,F,D,  // two flies flanking crystals
  D,D,D,D,D,D,D,D,D,
  D,D,S,S,D,S,S,D,D,  // stone cover bottom
  D,D,D,D,D,D,D,D,D,
  D,D,D,F,D,D,D,D,D,  // third fly lower-mid
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,M,D,D,D,D,
  D,D,D,D,D,P,D,D,D,
], 'Fly Hunters'),

// ── Level 12 — Blast & Key ──────────────────────────────
// Teaches: key+door AND dynamite together for first time.
// Key is top-right. Door is in left stone wall mid-level.
// Below door: ladder for safe descent, then dynamite pickup.
// Crystal box: cols 5-7 rows 8-10. Bomb placed at (3,7).
// VERIFIED: bomb(3,7) does NOT hit machine(4,12), portal(7,14),
// crystals(6,9)(5,9), or key(7,1). Crystal box right of bomb.
// Mummy patrols bottom-left open area.
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,K,D,  // player left, key far right col7 row1
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  S,O,S,S,S,S,S,S,S,  // door col1 row5
  D,A,D,D,D,D,D,D,D,  // BUG FIX: ladder col1 (was EMPTY — 5-tile drop = instant death)
  D,A,D,Z,D,D,D,D,D,  // BUG FIX: ladder continues + dynamite col3 row7
  D,A,D,D,S,S,S,S,D,  // BUG FIX: ladder base col1, stone box left wall col4 row8
  D,D,D,D,S,C,C,S,D,  // crystals col5+6 row9 inside box
  D,D,D,D,S,S,S,S,D,  // stone box bottom row10
  D,D,D,D,D,D,D,D,D,
  D,X,D,D,M,D,D,D,D,  // mummy col1, machine col4 row12
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,P,D,  // portal col7 row14
], 'Blast & Key'),

// ── Level 13 — Twin Pursuit ─────────────────────────────
// Teaches: two mummies chasing simultaneously from different
// positions. Stone walls slow them — player must use walls
// as barriers, collecting crystals in the protected pockets
// before both mummies converge on the player's position.
// One fly adds a third threat from above. No dynamite.
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,S,D,D,D,S,D,D,
  D,D,S,C,D,C,S,D,D,  // crystals in stone pockets
  D,D,S,D,D,D,S,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,F,D,D,D,D,  // fly mid-level
  D,D,D,D,D,D,D,D,D,
  D,X,D,D,D,D,D,X,D,  // mummies bottom-left and bottom-right
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,M,D,D,D,D,
  D,D,D,D,D,P,D,D,D,
], 'Twin Pursuit'),

// ── Level 14 — Layer Cake ───────────────────────────────
// Teaches: blasting through walls in sequence (3 dynamites).
// Three full-width stone walls. One dynamite per zone.
// Crystals placed col6 in each zone — NEVER in bomb blast diamond.
// VERIFIED: bomb(4,1) doesn't hit crystal(6,3) or machine(4,12).
//           bomb(4,4) doesn't hit crystal(6,6) or machine(4,12).
//           bomb(4,7) doesn't hit crystal(6,9) or machine(4,12).
// Machine col4 row12, portal col4 row14 — 5+ rows from last bomb.
// Mummy guards bottom zone. One fly in mid zone for pressure.
stoneFrame([
  D,L,D,D,D,D,D,D,D,  // zone 1 top — player spawns here
  D,D,D,D,Z,_,D,D,D,  // dynamite col4 + empty retreat col5
  S,S,S,S,S,S,S,S,S,  // wall 1 — blast downward
  D,D,D,D,D,D,C,D,D,  // zone 2 — crystal col6 (safe from bomb above)
  D,D,D,D,Z,_,D,D,D,  // dynamite col4 + empty retreat col5
  S,S,S,S,S,S,S,S,S,  // wall 2
  D,D,D,D,D,D,C,D,D,  // zone 3 — crystal col6
  D,D,D,D,Z,_,D,D,D,  // dynamite col4 + empty retreat col5
  S,S,S,S,S,S,S,S,S,  // wall 3
  D,D,D,D,D,D,C,D,D,  // zone 4 — crystal col6
  D,D,D,F,D,D,D,D,D,  // fly in zone 4
  D,X,D,D,D,D,D,D,D,  // mummy zone 4 left
  D,D,D,D,M,D,D,D,D,  // machine col4 row12
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,P,D,D,D,D,  // portal col4 row14
], 'Layer Cake'),

// ── Level 15 — The Final Trial ──────────────────────────
// All mechanics combined. Verified mathematically.
//
// Zone 1 (rows 0-2): Player top-left. Key col7 row0.
//   Fly guards top-right. Stone divider col4 rows 0-2.
//
// Zone 2 (rows 3-8): Door col2 row3 in stone wall.
//   Below door: open path. Crystal box cols 3-6 rows 6-8.
//   Bomb col2 row5 blasts box left wall (col3).
//   VERIFIED: bomb(2,5) misses machine(4,13), portal(5,14),
//   key(7,0), crystals inside box at (4,7)(5,7).
//
// Zone 3 (rows 9-14): Second bomb col3 row10 blasts wall row12.
//   VERIFIED: bomb(3,10) misses machine(4,13), portal(5,14).
//   Two mummies in zone 3 open area. Machine col4 row13.
stoneFrame([
  D,D,D,D,S,D,D,K,D,  // key col7 row0, stone divider col4
  D,L,D,D,S,D,D,D,D,  // player col1 row1
  D,D,D,D,S,D,F,D,D,  // fly col6 row2 guards key
  S,S,O,S,S,D,D,D,D,  // door col2 row3 in left wall
  D,D,_,D,D,D,D,D,D,  // gap below door, open right
  D,D,Z,D,D,D,D,D,D,  // bomb col2 row5 (retreat: col3 is open)
  D,D,D,S,S,S,S,D,D,  // stone box top row6 cols3-6
  D,D,D,S,C,C,S,D,D,  // crystals col4+5 row7 inside box
  D,D,D,S,S,S,S,D,D,  // stone box bottom row8
  D,D,D,D,D,D,D,D,D,  // open row9
  D,D,D,Z,_,D,D,D,D,  // bomb col3 row10 + retreat col4
  D,D,D,D,D,D,D,D,D,  // open row11
  S,S,S,S,S,S,S,S,S,  // full wall row12
  D,X,D,M,D,D,D,D,D,  // mummy col1, machine col3 row13
  D,D,D,D,D,X,P,D,D,  // second mummy col5, portal col6 row14
], 'The Final Trial'),

];

// Procedural levels start at index 15 (level 16 onward)
for (let i = 15; i < 100; i++) {
  const gen = generateLevel(i + 1);
  LEVELS.push(gen);
}
