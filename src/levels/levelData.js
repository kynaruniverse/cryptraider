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
//   Right wall of box at col 2 — player approaches from col 3 rightward.
//   Dynamite Z at col 3 row 3 — player stands at col 4, faces left, places
//   bomb at col 3, retreats to col 4. Blast radius 2 punches through col 2
//   (right wall) and exposes both crystals inside.
//
//   Ladder shaft col 7 rows 1-6 — safe descent to mid-level corridor.
//   Mid corridor row 7 is open. Second dynamite at col 3 row 7 for lower room.
//   Lower sealed room rows 8-10 contains machine + portal.
//   Player blasts left wall of lower room (col 1) from col 2.
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,A,D,  // player top-left, ladder top-right
  S,S,S,D,D,D,D,A,D,  // stone box left wall top, ladder
  S,C,S,Z,D,D,D,A,D,  // crystal in box, dynamite outside at col 3, ladder
  S,C,S,D,D,D,D,A,D,  // second crystal, open approach col 3+, ladder
  S,S,S,D,D,D,D,A,D,  // stone box left wall bottom, ladder
  D,D,D,D,D,D,D,_,D,  // open corridor, ladder base (gap in wall)
  D,D,D,Z,D,D,D,D,D,  // second dynamite for lower room
  S,S,S,S,S,S,S,S,S,  // full stone wall — blast through with second TNT
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,M,D,D,
  D,D,D,D,P,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
], 'Blasting Zone'),
// ── Level 7 — Boulder Run ───────────────────────────────
// Teaches: boulders fall and slide off rounded surfaces.
// Two boulders sit on stone shelves with gaps — they slide off
// when the player moves beneath. Crystal rewards require timing.
// Mummy is pre-placed in open corridor bottom-right.
// No dirt between mummy spawn and its patrol zone.
// Safe fall: all drops are exactly 2 tiles (≤ SAFE_FALL_TILES).
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,D,D,  // player top-left
  D,D,D,D,D,D,D,D,D,
  D,D,S,B,S,B,S,D,D,  // boulders on stone — will slide off gap sides
  D,D,_,D,_,D,_,D,D,  // gaps under boulder shelf (3 gaps = 3 slide paths)
  D,D,D,D,D,D,D,D,D,
  D,C,D,D,D,D,D,C,D,  // crystals flanking — approach triggers slides
  D,D,D,D,D,D,D,D,D,
  S,S,S,S,_,S,S,S,S,  // wall with single gap centre
  _,_,_,_,A,_,_,_,_,  // open corridor + ladder at gap (3 tile drop = need ladder)
  _,_,_,_,A,_,_,_,_,
  _,_,_,_,A,_,X,_,_,  // mummy in open corridor right side
  _,_,_,_,M,_,_,_,_,  // machine in open corridor
  _,_,_,_,_,_,_,_,_,
  _,_,_,_,P,_,_,_,_,
], 'Boulder Run'),

// ── Level 8 — The Gravel Cascade ────────────────────────
// Teaches: gravel is SOLID + GRAVITY — falls like boulders,
// cannot be dug. Creates shifting terrain obstacles.
// Player must navigate around falling gravel columns.
// Open corridors give mummy a patrol path.
// Fly patrols top half — forces fast crystal collection.
// Crystal requires entering the gravel fall zone briefly.
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,D,D,  // player top-left
  D,D,D,G,D,G,D,D,D,  // gravel columns — will fall when space opens below
  D,D,D,G,D,G,D,D,D,
  D,D,D,_,D,_,D,D,D,  // empty below gravel — they drop on level start
  D,C,D,D,D,D,D,C,D,  // crystals beside gravel columns
  D,D,D,D,D,D,D,D,D,
  D,F,D,D,D,D,D,D,D,  // fly top-left area
  S,S,S,S,_,S,S,S,S,  // wall, gap centre
  _,_,_,_,A,_,_,_,_,  // open corridor + ladder
  _,_,_,_,A,_,_,_,_,
  _,X,_,_,A,_,_,_,_,  // mummy in open corridor left
  _,_,_,_,M,_,_,_,_,
  _,_,_,_,_,_,_,_,_,
  _,_,_,_,P,_,_,_,_,
], 'Gravel Cascade'),

// ── Level 9 — Sand Shelf ────────────────────────────────
// Teaches: sand is PASSABLE — player walks through it freely.
// But boulders above sand fall when sand is cleared by explosion
// or when the player digs adjacent dirt exposing the sand.
// Key insight: sand acts as a crumbling support for boulders.
// Two sand shelves. Crystals tucked in dirt below each shelf.
// Mummy patrols the pre-cleared bottom corridor.
// No fall hazard — shelves are only 2 tiles high.
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,B,D,D,D,B,D,D,  // boulders resting on sand below
  D,D,N,D,D,D,N,D,D,  // sand columns — boulders drop when sand cleared
  D,D,D,D,D,D,D,D,D,
  D,D,D,C,D,C,D,D,D,  // crystals — safe until boulder falls
  D,D,D,D,D,D,D,D,D,
  S,S,S,S,_,S,S,S,S,
  _,_,_,_,A,_,_,_,_,  // open corridor + ladder
  _,_,_,_,A,_,_,_,_,
  _,_,X,_,M,_,_,_,_,  // mummy + machine
  _,_,_,_,_,_,_,_,_,
  _,_,_,_,_,_,_,_,_,
  _,_,_,_,P,_,_,_,_,
], 'Sand Shelf'),

// ── Level 10 — The Crossroads ───────────────────────────
// Teaches: ladders as the primary movement system.
// Player spawns on a cruciform ladder scaffold in the centre.
// ALL four compass crystals require going down a ladder arm then
// stepping off sideways — a 1-tile safe drop onto dirt.
// After collecting all four the player must descend the centre
// ladder shaft to machine + portal. Mummy waits below.
// No dirt blocking mummy — it patrols the open bottom zone.
stoneFrame([
  D,D,D,D,C,D,D,D,D,  // north crystal — 1 safe drop off ladder
  D,D,D,D,A,D,D,D,D,
  D,D,D,D,A,D,D,D,D,
  C,_,A,A,L,A,A,_,C,  // player on central ladder, east+west crystals 1-drop
  D,D,D,D,A,D,D,D,D,
  D,D,D,D,A,D,D,D,D,
  D,D,D,D,A,D,D,D,D,
  D,D,D,D,A,D,D,D,D,
  _,_,_,_,M,_,_,_,_,  // open corridor — machine at base of ladder
  _,_,_,_,_,_,_,_,_,
  _,X,_,_,_,_,_,_,_,  // mummy in open space
  _,_,_,_,_,_,_,_,_,
  _,_,_,_,_,_,_,_,_,
  _,_,_,_,_,_,_,_,_,
  _,_,_,_,P,_,_,_,_,
], 'The Crossroads'),

// ── Level 11 — Fly Swarm ────────────────────────────────
// Teaches: flies chase directly through terrain.
// Two flies in the top half — the player must collect both
// crystals quickly before the flies close in.
// Stone pillars create momentary cover but flies navigate around.
// Third fly in the bottom half guards the machine area.
// All mummy slots empty — pure fly threat.
// Bottom half is open corridor — player drops safely (2 tiles).
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,D,D,
  D,D,S,D,D,D,S,D,D,  // stone pillars for cover
  D,D,S,C,D,C,S,D,D,  // crystals between pillars
  D,D,S,D,D,D,S,D,D,
  D,F,D,D,D,D,D,F,D,  // two flies flanking
  D,D,D,D,D,D,D,D,D,
  S,S,S,S,_,S,S,S,S,  // wall, gap centre
  _,_,_,_,A,_,_,_,_,  // ladder for safe descent
  _,_,_,_,A,_,_,_,_,
  _,_,_,F,M,_,_,_,_,  // third fly guards machine
  _,_,_,_,_,_,_,_,_,
  _,_,_,_,_,_,_,_,_,
  _,_,_,_,_,_,_,_,_,
  _,_,_,_,P,_,_,_,_,
], 'Fly Swarm'),

// ── Level 12 — Key & Dynamite ───────────────────────────
// Combines key + door + dynamite in one sequence.
// Key is top-right (player must cross full width to get it).
// Door is in the stone wall, col 1. Below door: ladder descent.
// Dynamite sits in open space below the wall — player picks it up.
// Stone box right side contains both crystals + machine.
// Player blasts the LEFT wall of the box from col 3 (retreat right).
// Mummy patrols the open bottom corridor — left half only.
// Portal far right bottom.
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,K,D,  // player left, key far right
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  D,D,D,D,D,D,D,D,D,
  S,O,S,S,S,S,S,S,S,  // door at col 1
  _,A,_,_,_,_,_,_,_,  // open + ladder below door
  _,A,_,Z,_,_,_,_,_,  // ladder + dynamite at col 3
  _,A,_,S,S,S,S,_,_,  // ladder + stone box left wall at col 3
  _,_,_,S,C,C,S,_,_,  // crystals + machine inside box
  _,_,_,S,M,S,S,_,_,
  _,X,_,S,S,S,S,_,_,  // mummy left, box right wall
  _,_,_,_,_,_,_,_,_,
  _,_,_,_,_,_,_,_,_,
  _,_,_,_,_,_,P,_,_,
], 'Key & Dynamite'),

// ── Level 13 — Twin Guardians ───────────────────────────
// Teaches: two mummies in separate pre-cleared corridors.
// Stone pillars divide the level into three vertical lanes.
// Each mummy starts in its own lane (left, right).
// Player must collect crystals from both side lanes then
// escape through the centre lane to machine + portal.
// Both mummies must navigate the centre gap to reach player —
// buying time to collect and escape.
stoneFrame([
  D,D,D,D,D,D,D,D,D,
  D,L,D,D,D,D,D,D,D,
  D,D,S,D,D,D,S,D,D,
  D,D,S,D,D,D,S,D,D,
  _,_,S,_,C,_,S,_,_,  // crystal centre, open sides
  _,C,_,_,_,_,_,C,_,  // crystals in side lanes
  _,_,_,_,_,_,_,_,_,
  _,X,_,_,_,_,_,X,_,  // mummies in side lanes
  _,_,_,_,_,_,_,_,_,
  _,_,_,_,_,_,_,_,_,
  _,_,_,_,_,_,_,_,_,
  _,_,_,_,_,_,_,_,_,
  _,_,_,_,_,_,_,_,_,
  _,_,_,_,M,_,_,_,_,
  _,_,_,_,P,_,_,_,_,
], 'Twin Guardians'),

// ── Level 14 — Layer Cake ───────────────────────────────
// Teaches: blasting through multiple stone walls in sequence.
// Three full-width stone walls divide the level into 4 zones.
// One dynamite per zone — player blasts downward each time.
// Critical: dynamite pickup requires an adjacent empty retreat.
// Each dynamite is placed beside an empty cell (right side clear).
// After blast, player falls 1 tile into new zone (safe).
// Mummy guards the bottom zone (open corridor).
// No flies — pure puzzle pressure.
stoneFrame([
  D,L,D,D,D,D,D,D,D,  // zone 1 — top
  D,D,D,D,C,D,D,D,D,
  D,D,D,Z,_,D,D,D,D,  // dynamite + empty retreat right
  S,S,S,S,S,S,S,S,S,  // wall 1 — blast down into zone 2
  D,D,D,D,C,D,D,D,D,  // zone 2
  D,D,D,Z,_,D,D,D,D,
  S,S,S,S,S,S,S,S,S,  // wall 2
  D,D,D,D,C,D,D,D,D,  // zone 3
  D,D,D,Z,_,D,D,D,D,
  S,S,S,S,S,S,S,S,S,  // wall 3
  _,_,_,_,_,_,_,_,_,  // zone 4 — open bottom (mummy zone)
  _,X,_,_,_,_,_,_,_,
  _,_,_,_,M,_,_,_,_,
  _,_,_,_,_,_,_,_,_,
  _,_,_,_,P,_,_,_,_,
], 'Layer Cake'),

// ── Level 15 — The Final Trial ──────────────────────────
// All mechanics combined. No handholding.
// Zone 1 (top): player + key far corner. Fly guards the key.
// Wall with door (needs key). Ladder down.
// Zone 2 (mid): dynamite beside stone box (crystals inside).
//   Boulder on sand above player path — must time the dig.
//   Mummy patrols open mid corridor.
// Zone 3 (bottom): second mummy + machine + portal.
//   Open corridor — no dirt between mummy and patrol zone.
//   Second dynamite for lower stone wall if needed.
stoneFrame([
  D,D,D,D,S,D,D,K,D,  // key top-right, stone divider
  D,L,D,D,S,D,D,D,D,  // player top-left
  D,D,D,D,S,D,F,D,D,  // fly guards key side
  S,S,O,S,S,_,_,_,_,  // door in left wall, right side open
  _,A,_,D,D,D,B,D,D,  // ladder below door, boulder right
  _,A,_,D,D,D,N,D,D,  // ladder, sand under boulder
  _,A,Z,S,S,S,S,D,D,  // dynamite + stone box
  _,_,_,S,C,C,S,D,D,  // crystals in box
  _,_,_,S,S,S,S,D,D,  // box bottom
  _,X,_,_,_,_,_,_,_,  // mummy mid — open corridor
  S,S,S,S,S,S,S,S,_,  // lower wall, gap right
  _,_,_,_,_,_,_,A,_,  // open + ladder right side
  _,_,_,_,_,_,_,A,_,
  _,X,_,M,_,_,_,_,_,  // second mummy + machine
  _,_,_,_,P,_,_,_,_,
], 'The Final Trial'),

];

// Procedural levels start at index 15 (level 16 onward)
for (let i = 15; i < 100; i++) {
  const gen = generateLevel(i + 1);
  LEVELS.push(gen);
}
