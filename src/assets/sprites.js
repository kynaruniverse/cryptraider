// ============================================================
// CRYPT RAIDER v2 — SVG Sprite Engine
// BUG FIX: Each sprite now gets a unique namespace prefix for
// all internal SVG IDs (gradients, filters).
// When multiple SVGs are decoded as <img> data-URIs and drawn
// to the same canvas, the browser resolves url(#id) references
// against the *document* — so shared IDs like "glow", "dg",
// "sg" across sprites collide, causing wrong or transparent fills.
// Solution: every sprite scopes its IDs with a unique prefix.
// ============================================================

const S = 32; // Sprite base size

// ── Unique-ID scoped SVG builder ─────────────────────────────
// `ns` = namespace string unique per sprite (e.g. "dirt", "stone").
// Every url(#id) reference inside the SVG is automatically prefixed.
function svgNS(ns, content) {
  // Replace bare url(#X) with url(#ns_X) inside the content string.
  const scoped = content.replace(/url\(#([^)]+)\)/g, `url(#${ns}_$1)`);
  // Also replace bare id="X" with id="ns_X".
  const ids    = scoped.replace(/\bid="([^"]+)"/g, `id="${ns}_$1"`);
  // Standard filters, also namespaced.
  const glow  = `<filter id="${ns}_glow"><feGaussianBlur stdDeviation="1.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  const bevel = `<filter id="${ns}_bevel"><feGaussianBlur stdDeviation="0.5" in="SourceAlpha" result="b"/><feSpecularLighting surfaceScale="2" specularConstant="0.75" specularExponent="20" lighting-color="#ffffff" in="b" result="s"><fePointLight x="-20" y="-20" z="50"/></feSpecularLighting><feComposite in="s" in2="SourceAlpha" operator="in" result="s"/><feComposite in="SourceGraphic" in2="s" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/></filter>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <defs>${glow}${bevel}</defs>
    ${ids}
  </svg>`;
}

// ─────────────────────────────────────────────
//  TERRAIN TILES
// ─────────────────────────────────────────────

export const SVG_EMPTY = svgNS('empty', `
  <defs>
    <radialGradient id="ebg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#1a0c04"/>
      <stop offset="100%" stop-color="#050200"/>
    </radialGradient>
  </defs>
  <rect width="32" height="32" fill="url(#ebg)"/>
  <line x1="0" y1="0" x2="32" y2="32" stroke="#0d0600" stroke-width="0.5" opacity="0.3"/>
  <line x1="32" y1="0" x2="0" y2="32" stroke="#0d0600" stroke-width="0.5" opacity="0.3"/>
`);

export const SVG_DIRT = svgNS('dirt', `
  <defs>
    <linearGradient id="dg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#C8904A"/>
      <stop offset="100%" stop-color="#9A6428"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" fill="url(#dg)"/>
  <circle cx="5" cy="5" r="1.2" fill="#6A3E10" opacity="0.6"/>
  <circle cx="19" cy="14" r="0.9" fill="#6A3E10" opacity="0.5"/>
  <circle cx="27" cy="26" r="1.2" fill="#6A3E10" opacity="0.6"/>
  <rect x="0" y="0" width="32" height="2" fill="#D8A060" opacity="0.4"/>
`);

export const SVG_STONE = svgNS('stone', `
  <defs>
    <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5A5A70"/>
      <stop offset="100%" stop-color="#2A2A3A"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" fill="url(#sg)"/>
  <rect x="1" y="1" width="14" height="13" rx="1" fill="#505060" stroke="#1a1a28" stroke-width="1"/>
  <rect x="17" y="1" width="14" height="13" rx="1" fill="#484858" stroke="#1a1a28" stroke-width="1"/>
  <rect x="9" y="16" width="14" height="15" rx="1" fill="#505060" stroke="#1a1a28" stroke-width="1"/>
  <rect x="0" y="0" width="32" height="1.5" fill="#888898" opacity="0.6"/>
`);

export const SVG_GRAVEL = svgNS('gravel', `
  <defs>
    <radialGradient id="gg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#9A8060"/>
      <stop offset="100%" stop-color="#5A4A30"/>
    </radialGradient>
  </defs>
  <rect width="32" height="32" fill="url(#gg)"/>
  <circle cx="6" cy="6" r="4.5" fill="#6A5840" stroke="#3A2818" stroke-width="0.8"/>
  <circle cx="18" cy="5" r="3.5" fill="#7A6850" stroke="#3A2818" stroke-width="0.8"/>
  <circle cx="15" cy="16" r="5" fill="#6A5840" stroke="#3A2818" stroke-width="0.8"/>
  <circle cx="8" cy="27" r="4" fill="#6A5840" stroke="#3A2818" stroke-width="0.8"/>
`);

export const SVG_SAND = svgNS('sand', `
  <defs>
    <linearGradient id="sandg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#E0C070"/>
      <stop offset="100%" stop-color="#B89040"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" fill="url(#sandg)"/>
  <line x1="0" y1="6" x2="32" y2="6" stroke="#A07828" stroke-width="0.6" opacity="0.5"/>
  <circle cx="4" cy="9" r="0.8" fill="#D4AA50" opacity="0.7"/>
`);

export const SVG_LADDER = svgNS('ladder', `
  <rect width="32" height="32" fill="#0d0600"/>
  <rect x="5" y="0" width="4" height="32" fill="#9A7418" rx="1.5"/>
  <rect x="23" y="0" width="4" height="32" fill="#9A7418" rx="1.5"/>
  <rect x="5" y="3" width="22" height="3.5" fill="#B89030" rx="1"/>
  <rect x="5" y="11" width="22" height="3.5" fill="#B89030" rx="1"/>
  <rect x="5" y="19" width="22" height="3.5" fill="#B89030" rx="1"/>
  <rect x="5" y="27" width="22" height="3.5" fill="#B89030" rx="1"/>
`);

// ─────────────────────────────────────────────
//  INTERACTIVE OBJECTS
// ─────────────────────────────────────────────

export const SVG_BOULDER = svgNS('boulder', `
  <defs>
    <radialGradient id="bolg" cx="35%" cy="28%" r="65%">
      <stop offset="0%" stop-color="#c0c0cc"/>
      <stop offset="45%" stop-color="#707080"/>
      <stop offset="100%" stop-color="#282832"/>
    </radialGradient>
  </defs>
  <circle cx="16" cy="16" r="14" fill="url(#bolg)" stroke="#1a1a22" stroke-width="1.2"/>
  <ellipse cx="11" cy="10" rx="4" ry="2.5" fill="white" opacity="0.2" transform="rotate(-25 11 10)"/>
  <path d="M6 24 Q12 27 16 25 Q21 23 26 26" stroke="#404048" stroke-width="1.2" fill="none" opacity="0.6"/>
`);

export const SVG_CRYSTAL = svgNS('crystal', `
  <defs>
    <linearGradient id="crg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E0FFFF"/>
      <stop offset="50%" stop-color="#00E5FF"/>
      <stop offset="100%" stop-color="#006064"/>
    </linearGradient>
  </defs>
  <path d="M16 2 L26 14 L16 30 L6 14 Z" fill="url(#crg)" filter="url(#glow)"/>
  <path d="M16 2 L26 14 L16 16 Z" fill="white" opacity="0.3"/>
  <circle cx="16" cy="14" r="1" fill="white"><animate attributeName="opacity" values="0.2;1;0.2" dur="1.5s" repeatCount="indefinite"/></circle>
`);

export const SVG_GEM = svgNS('gem', `
  <defs>
    <linearGradient id="gemg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF88CC"/>
      <stop offset="50%" stop-color="#CC0066"/>
      <stop offset="100%" stop-color="#660033"/>
    </linearGradient>
  </defs>
  <polygon points="16,3 26,10 26,22 16,29 6,22 6,10" fill="url(#gemg)" stroke="#880044" stroke-width="0.8"/>
  <polygon points="16,5 22,10 16,8" fill="white" opacity="0.45"/>
`);

export const SVG_KEY = svgNS('key', `
  <defs>
    <radialGradient id="keytop" cx="40%" cy="35%" r="60%">
      <stop offset="0%" stop-color="#FFE060"/>
      <stop offset="100%" stop-color="#CC8800"/>
    </radialGradient>
  </defs>
  <circle cx="12" cy="13" r="7" fill="url(#keytop)" stroke="#AA6600" stroke-width="1.2"/>
  <circle cx="12" cy="13" r="4" fill="none" stroke="#AA6600" stroke-width="1.5"/>
  <rect x="18" y="12" width="12" height="3" rx="1" fill="#FFD700" stroke="#AA6600" stroke-width="0.8"/>
  <rect x="24" y="15" width="3" height="4" rx="0.5" fill="#FFD700" stroke="#AA6600" stroke-width="0.8"/>
`);

export const SVG_DOOR_CLOSED = svgNS('door_closed', `
  <defs>
    <linearGradient id="doorg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7A4A20"/>
      <stop offset="100%" stop-color="#3A2010"/>
    </linearGradient>
  </defs>
  <rect x="2" y="1" width="28" height="30" rx="2" fill="url(#doorg)" stroke="#5A3010" stroke-width="1.5"/>
  <circle cx="16" cy="16" r="2" fill="#FFD700" stroke="#AA8800" stroke-width="0.8"/>
`);

export const SVG_DOOR_OPEN = svgNS('door_open', `
  <rect width="32" height="32" fill="#0d0600"/>
  <rect x="2" y="1" width="4" height="30" fill="#3A2010" stroke="#1a0d00" stroke-width="1"/>
  <rect x="26" y="1" width="4" height="30" fill="#3A2010" stroke="#1a0d00" stroke-width="1"/>
`);

export const SVG_DYNAMITE = svgNS('dynamite', `
  <rect x="11" y="3" width="10" height="20" rx="2" fill="#CC2200" stroke="#881100" stroke-width="1" filter="url(#bevel)"/>
  <line x1="16" y1="3" x2="16" y2="0" stroke="#AA8844" stroke-width="1.5"/>
  <circle cx="16" cy="0" r="2" fill="#FFDD44"><animate attributeName="r" values="1.5;2.5;1.5" dur="0.2s" repeatCount="indefinite"/></circle>
  <text x="16" y="28" font-size="5" fill="#FFDD44" text-anchor="middle" font-family="monospace" font-weight="bold">TNT</text>
`);

export const SVG_PORTAL_INACTIVE = svgNS('portal_inactive', `
  <ellipse cx="16" cy="16" rx="13" ry="14" fill="#1a1a3a" stroke="#2a2a5a" stroke-width="1.5"/>
  <ellipse cx="16" cy="16" rx="9" ry="10" fill="none" stroke="#3a3a6a" stroke-width="1"/>
`);

export const SVG_PORTAL_ACTIVE = svgNS('portal_active', `
  <defs>
    <radialGradient id="pag" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#00FFFF"/>
      <stop offset="100%" stop-color="#000033"/>
    </radialGradient>
  </defs>
  <circle cx="16" cy="16" r="15" fill="#00AAFF" filter="url(#glow)" opacity="0.6"/>
  <ellipse cx="16" cy="16" rx="14" ry="15" fill="url(#pag)" stroke="#88FFFF" stroke-width="1.5"/>
`);

export const SVG_MACHINE_INACTIVE = svgNS('machine_inactive', `
  <rect x="2" y="4" width="28" height="24" rx="3" fill="#504838" stroke="#383020" stroke-width="1.5"/>
  <rect x="5" y="7" width="22" height="8" rx="2" fill="#1a1410"/>
`);

export const SVG_MACHINE_ACTIVE = svgNS('machine_active', `
  <rect x="2" y="4" width="28" height="24" rx="3" fill="#705830" stroke="#AA8840" stroke-width="1.5" filter="url(#glow)"/>
  <circle cx="9" cy="22" r="3" fill="#FFAA00"/>
  <circle cx="16" cy="22" r="3" fill="#FFAA00"/>
  <circle cx="23" cy="22" r="3" fill="#FFAA00"/>
`);

// ─────────────────────────────────────────────
//  PLAYER — Dr. Carter
// ─────────────────────────────────────────────

function playerBase() {
  return `
  <ellipse cx="16" cy="30" rx="7" ry="2.5" fill="black" opacity="0.4"/>
  <rect x="9" y="16" width="14" height="12" rx="2.5" fill="#8B4513"/>
  <circle cx="16" cy="12" r="7" fill="#FFCC99"/>
  <rect x="6" y="10" width="20" height="3" rx="1.5" fill="#B8860B"/>
  <path d="M10 11 L10 5 Q16 2 22 5 L22 11" fill="#D4AF37"/>
`;
}

export const SVG_PLAYER_DOWN  = svgNS('player_down',  `${playerBase()}<circle cx="13" cy="12" r="1.2" fill="#1a0800"/><circle cx="19" cy="12" r="1.2" fill="#1a0800"/>`);
export const SVG_PLAYER_UP    = svgNS('player_up',    `${playerBase()}<rect x="10" y="9" width="12" height="2" fill="#8A6010"/>`);
export const SVG_PLAYER_LEFT  = svgNS('player_left',  `${playerBase()}<circle cx="13" cy="12" r="1.2" fill="#1a0800"/>`);
export const SVG_PLAYER_RIGHT = svgNS('player_right', `${playerBase()}<circle cx="19" cy="12" r="1.2" fill="#1a0800"/>`);

// ─────────────────────────────────────────────
//  ENEMIES
// ─────────────────────────────────────────────

export const SVG_MUMMY = svgNS('mummy', `
  <rect x="9" y="14" width="14" height="15" rx="3" fill="#EFEBE9"/>
  <circle cx="16" cy="9" r="8" fill="#EFEBE9"/>
  <circle cx="12" cy="9" r="2.5" fill="#FF0000" filter="url(#glow)"/>
  <circle cx="20" cy="9" r="2.5" fill="#FF0000" filter="url(#glow)"/>
`);

export const SVG_FLY = svgNS('fly', `
  <ellipse cx="8" cy="14" rx="7" ry="4" fill="#AACCFF" opacity="0.6"/>
  <ellipse cx="24" cy="14" rx="7" ry="4" fill="#AACCFF" opacity="0.6"/>
  <ellipse cx="16" cy="18" rx="6" ry="8" fill="#88AA44" stroke="#112208" stroke-width="1"/>
`);

// ─────────────────────────────────────────────
//  EXPLOSION FRAMES (8 frames)
// ─────────────────────────────────────────────

function explosionFrame(f) {
  const r  = 4 + f * 1.8;
  const op = Math.max(0, 1 - f / 8);
  const colors = ['#FFFF88','#FFDD00','#FF8800','#FF4400','#CC2200','#882200','#441100','#220800'];
  const c = colors[Math.min(f, 7)];
  return svgNS(`explosion${f}`, `<circle cx="16" cy="16" r="${r}" fill="${c}" opacity="${op}"/>`);
}
export const SVG_EXPLOSION = [0,1,2,3,4,5,6,7].map(explosionFrame);

// ─────────────────────────────────────────────
//  ATLAS SYSTEM & LOADER
// ─────────────────────────────────────────────

function svgToImage(svgStr) {
  return new Promise((resolve) => {
    const img = new Image();
    // Use encodeURIComponent-based encoding — more robust than btoa for unicode SVG content.
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
  });
}

export async function loadAllSprites() {
  const defs = {
    empty:            SVG_EMPTY,
    dirt:             SVG_DIRT,
    stone:            SVG_STONE,
    gravel:           SVG_GRAVEL,
    sand:             SVG_SAND,
    ladder:           SVG_LADDER,
    boulder:          SVG_BOULDER,
    crystal:          SVG_CRYSTAL,
    gem:              SVG_GEM,
    key:              SVG_KEY,
    door_closed:      SVG_DOOR_CLOSED,
    door_open:        SVG_DOOR_OPEN,
    dynamite:         SVG_DYNAMITE,
    portal_inactive:  SVG_PORTAL_INACTIVE,
    portal_active:    SVG_PORTAL_ACTIVE,
    machine_inactive: SVG_MACHINE_INACTIVE,
    machine_active:   SVG_MACHINE_ACTIVE,
    player_down:      SVG_PLAYER_DOWN,
    player_up:        SVG_PLAYER_UP,
    player_left:      SVG_PLAYER_LEFT,
    player_right:     SVG_PLAYER_RIGHT,
    mummy:            SVG_MUMMY,
    fly:              SVG_FLY,
  };

  const allEntries = [...Object.entries(defs)];
  SVG_EXPLOSION.forEach((svgStr, i) => allEntries.push([`explosion_${i}`, svgStr]));

  const totalSprites = allEntries.length;
  const cols         = Math.ceil(Math.sqrt(totalSprites));

  // Create the Atlas Canvas
  const atlasCanvas    = document.createElement('canvas');
  atlasCanvas.width    = cols * S;
  atlasCanvas.height   = Math.ceil(totalSprites / cols) * S;
  const atlasCtx       = atlasCanvas.getContext('2d');

  const coords       = {};
  const finalSprites = {};

  // Parallel decode — all SVG→Image conversions fire simultaneously (Fix 9).
  const images = await Promise.all(allEntries.map(([, svgStr]) => svgToImage(svgStr)));

  for (let i = 0; i < allEntries.length; i++) {
    const [key] = allEntries[i];
    const img   = images[i];
    if (!img) {
      console.warn(`[Sprites] Failed to load sprite: ${key}`);
      continue;
    }

    const col = i % cols;
    const row = Math.floor(i / cols);
    const x   = col * S;
    const y   = row * S;

    atlasCtx.drawImage(img, x, y);
    coords[key] = { x, y };

    const canv = document.createElement('canvas');
    canv.width  = S;
    canv.height = S;
    canv.getContext('2d').drawImage(img, 0, 0);
    finalSprites[key] = canv;
  }

  return { ...finalSprites, atlas: atlasCanvas, coords, S };
}
