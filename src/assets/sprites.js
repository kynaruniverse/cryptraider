// ============================================================
// CRYPT RAIDER v2 — SVG Sprite Definitions
// 32×32 sprites, pre-rendered to HTMLImageElement for canvas blitting
// Enhanced visuals: richer gradients, detail, glow
// ============================================================

const S = 32; // tile size

function svg(content, extra = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" ${extra}>${content}</svg>`;
}

// ─────────────────────────────────────────────
//  TERRAIN TILES
// ─────────────────────────────────────────────

export const SVG_EMPTY = svg(`
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

export const SVG_DIRT = svg(`
  <defs>
    <linearGradient id="dg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#C8904A"/>
      <stop offset="100%" stop-color="#9A6428"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" fill="url(#dg)"/>
  <line x1="0" y1="10" x2="32" y2="10" stroke="#7A4E18" stroke-width="0.8" opacity="0.5"/>
  <line x1="0" y1="21" x2="32" y2="21" stroke="#7A4E18" stroke-width="0.8" opacity="0.5"/>
  <line x1="16" y1="0" x2="16" y2="10" stroke="#7A4E18" stroke-width="0.6" opacity="0.3"/>
  <line x1="8"  y1="10" x2="8"  y2="21" stroke="#7A4E18" stroke-width="0.6" opacity="0.3"/>
  <line x1="24" y1="10" x2="24" y2="21" stroke="#7A4E18" stroke-width="0.6" opacity="0.3"/>
  <circle cx="5"  cy="5"  r="1.2" fill="#6A3E10" opacity="0.6"/>
  <circle cx="19" cy="14" r="0.9" fill="#6A3E10" opacity="0.5"/>
  <circle cx="27" cy="26" r="1.2" fill="#6A3E10" opacity="0.6"/>
  <circle cx="11" cy="26" r="0.8" fill="#6A3E10" opacity="0.4"/>
  <rect x="0" y="0" width="32" height="2" fill="#D8A060" opacity="0.4"/>
  <rect x="0" y="0" width="2" height="32" fill="#D8A060" opacity="0.2"/>
`);

export const SVG_STONE = svg(`
  <defs>
    <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5A5A70"/>
      <stop offset="100%" stop-color="#2A2A3A"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" fill="url(#sg)"/>
  <rect x="1"  y="1"  width="14" height="13" rx="1" fill="#505060" stroke="#1a1a28" stroke-width="1"/>
  <rect x="17" y="1"  width="14" height="13" rx="1" fill="#484858" stroke="#1a1a28" stroke-width="1"/>
  <rect x="9"  y="16" width="14" height="15" rx="1" fill="#505060" stroke="#1a1a28" stroke-width="1"/>
  <rect x="1"  y="16" width="6"  height="15" rx="1" fill="#484858" stroke="#1a1a28" stroke-width="1"/>
  <rect x="25" y="16" width="6"  height="15" rx="1" fill="#484858" stroke="#1a1a28" stroke-width="1"/>
  <rect x="0" y="0" width="32" height="1.5" fill="#888898" opacity="0.6"/>
  <rect x="0" y="0" width="1.5" height="32" fill="#888898" opacity="0.3"/>
  <rect x="0" y="30" width="32" height="2" fill="#111120" opacity="0.5"/>
`);

export const SVG_GRAVEL = svg(`
  <defs>
    <radialGradient id="gg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#9A8060"/>
      <stop offset="100%" stop-color="#5A4A30"/>
    </radialGradient>
  </defs>
  <rect width="32" height="32" fill="url(#gg)"/>
  <circle cx="6"  cy="6"  r="4.5" fill="#6A5840" stroke="#3A2818" stroke-width="0.8"/>
  <circle cx="18" cy="5"  r="3.5" fill="#7A6850" stroke="#3A2818" stroke-width="0.8"/>
  <circle cx="27" cy="8"  r="4"   fill="#6A5840" stroke="#3A2818" stroke-width="0.8"/>
  <circle cx="4"  cy="18" r="3.5" fill="#7A6850" stroke="#3A2818" stroke-width="0.8"/>
  <circle cx="15" cy="16" r="5"   fill="#6A5840" stroke="#3A2818" stroke-width="0.8"/>
  <circle cx="26" cy="19" r="3.5" fill="#7A6850" stroke="#3A2818" stroke-width="0.8"/>
  <circle cx="8"  cy="27" r="4"   fill="#6A5840" stroke="#3A2818" stroke-width="0.8"/>
  <circle cx="21" cy="26" r="3.5" fill="#7A6850" stroke="#3A2818" stroke-width="0.8"/>
  <circle cx="29" cy="28" r="2.5" fill="#6A5840" stroke="#3A2818" stroke-width="0.8"/>
`);

export const SVG_SAND = svg(`
  <defs>
    <linearGradient id="sandg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#E0C070"/>
      <stop offset="100%" stop-color="#B89040"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" fill="url(#sandg)"/>
  <line x1="0" y1="6"  x2="32" y2="6"  stroke="#A07828" stroke-width="0.6" opacity="0.5"/>
  <line x1="0" y1="12" x2="32" y2="12" stroke="#C09838" stroke-width="0.4" opacity="0.4"/>
  <line x1="0" y1="18" x2="32" y2="18" stroke="#A07828" stroke-width="0.6" opacity="0.5"/>
  <line x1="0" y1="24" x2="32" y2="24" stroke="#C09838" stroke-width="0.4" opacity="0.4"/>
  <circle cx="4"  cy="9"  r="0.8" fill="#D4AA50" opacity="0.7"/>
  <circle cx="20" cy="15" r="0.6" fill="#D4AA50" opacity="0.6"/>
  <circle cx="28" cy="22" r="0.8" fill="#D4AA50" opacity="0.7"/>
`);

export const SVG_LADDER = svg(`
  <rect width="32" height="32" fill="#0d0600"/>
  <rect x="5"  y="0" width="4" height="32" fill="#9A7418" rx="1.5"/>
  <rect x="23" y="0" width="4" height="32" fill="#9A7418" rx="1.5"/>
  <rect x="5"  y="3"  width="22" height="3.5" fill="#B89030" rx="1"/>
  <rect x="5"  y="11" width="22" height="3.5" fill="#B89030" rx="1"/>
  <rect x="5"  y="19" width="22" height="3.5" fill="#B89030" rx="1"/>
  <rect x="5"  y="27" width="22" height="3.5" fill="#B89030" rx="1"/>
  <rect x="5" y="0" width="4" height="32" fill="#C8A040" opacity="0.2" rx="1.5"/>
`);

// ─────────────────────────────────────────────
//  INTERACTIVE OBJECTS
// ─────────────────────────────────────────────

export const SVG_BOULDER = svg(`
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
  <path d="M9 18 Q13 20 17 18" stroke="#606068" stroke-width="0.8" fill="none" opacity="0.4"/>
`);

export const SVG_CRYSTAL = svg(`
  <defs>
    <linearGradient id="crg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E0FFFF"/>
      <stop offset="50%" stop-color="#00E5FF"/>
      <stop offset="100%" stop-color="#006064"/>
    </linearGradient>
    <filter id="cr-glow"><feGaussianBlur stdDeviation="2"/><feComposite in="SourceGraphic"/></filter>
  </defs>
  <path d="M16 2 L26 14 L16 30 L6 14 Z" fill="url(#crg)" filter="url(#cr-glow)"/>
  <path d="M16 2 L26 14 L16 16 Z" fill="white" opacity="0.3"/>
  <path d="M16 30 L26 14 L16 16 Z" fill="#0097A7" opacity="0.4"/>
  <path d="M16 2 L6 14 L16 16 Z" fill="white" opacity="0.5"/>
  <circle cx="16" cy="14" r="1" fill="white">
     <animate attributeName="opacity" values="0.2;1;0.2" dur="1.5s" repeatCount="indefinite"/>
  </circle>
`);

export const SVG_GEM = svg(`
  <defs>
    <linearGradient id="gemg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF88CC"/>
      <stop offset="50%" stop-color="#CC0066"/>
      <stop offset="100%" stop-color="#660033"/>
    </linearGradient>
  </defs>
  <polygon points="16,3 26,10 26,22 16,29 6,22 6,10" fill="url(#gemg)" stroke="#880044" stroke-width="0.8"/>
  <polygon points="16,5 22,10 16,8" fill="white" opacity="0.45"/>
  <polygon points="16,5 22,10 26,10 16,3" fill="white" opacity="0.2"/>
  <line x1="6" y1="16" x2="26" y2="16" stroke="#FF88CC" stroke-width="0.5" opacity="0.4"/>
`);

export const SVG_KEY = svg(`
  <defs>
    <radialGradient id="keytop" cx="40%" cy="35%" r="60%">
      <stop offset="0%" stop-color="#FFE060"/>
      <stop offset="100%" stop-color="#CC8800"/>
    </radialGradient>
  </defs>
  <circle cx="12" cy="13" r="7" fill="url(#keytop)" stroke="#AA6600" stroke-width="1.2"/>
  <circle cx="12" cy="13" r="4" fill="none" stroke="#AA6600" stroke-width="1.5"/>
  <rect x="18" y="12" width="12" height="3" rx="1" fill="#FFD700" stroke="#AA6600" stroke-width="0.8"/>
  <rect x="24" y="15" width="3"  height="4" rx="0.5" fill="#FFD700" stroke="#AA6600" stroke-width="0.8"/>
  <rect x="28" y="15" width="2.5" height="3" rx="0.5" fill="#FFD700" stroke="#AA6600" stroke-width="0.8"/>
`);

export const SVG_DOOR_CLOSED = svg(`
  <defs>
    <linearGradient id="doorg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7A4A20"/>
      <stop offset="100%" stop-color="#3A2010"/>
    </linearGradient>
  </defs>
  <rect x="2" y="1" width="28" height="30" rx="2" fill="url(#doorg)" stroke="#5A3010" stroke-width="1.5"/>
  <rect x="4" y="3" width="24" height="26" rx="1" fill="#4A2C10" stroke="#6A4020" stroke-width="0.5"/>
  <rect x="6" y="5"  width="9"  height="11" rx="1" fill="#5A3818" stroke="#6A4820" stroke-width="0.5"/>
  <rect x="17" y="5"  width="9"  height="11" rx="1" fill="#5A3818" stroke="#6A4820" stroke-width="0.5"/>
  <rect x="6" y="18" width="9"  height="9"  rx="1" fill="#5A3818" stroke="#6A4820" stroke-width="0.5"/>
  <rect x="17" y="18" width="9"  height="9"  rx="1" fill="#5A3818" stroke="#6A4820" stroke-width="0.5"/>
  <circle cx="16" cy="16" r="2" fill="#FFD700" stroke="#AA8800" stroke-width="0.8"/>
  <rect x="14" y="14" width="4" height="1.5" fill="#FFD700"/>
`);

export const SVG_DOOR_OPEN = svg(`
  <rect width="32" height="32" fill="#0d0600"/>
  <rect x="2" y="1" width="4" height="30" fill="#3A2010" stroke="#1a0d00" stroke-width="1"/>
  <rect x="26" y="1" width="4" height="30" fill="#3A2010" stroke="#1a0d00" stroke-width="1"/>
  <path d="M6 1 L26 1 Q16 10 6 1" fill="#1a0d00"/>
  <rect x="6" y="28" width="20" height="3" fill="#2A1400" opacity="0.5"/>
`);


export const SVG_DYNAMITE = svg(`
  <rect x="11" y="3" width="10" height="20" rx="2" fill="#CC2200" stroke="#881100" stroke-width="1"/>
  <rect x="13" y="3" width="6" height="20" rx="1" fill="#DD3311" opacity="0.5"/>
  <line x1="16" y1="3" x2="16" y2="0" stroke="#AA8844" stroke-width="1.5" stroke-dasharray="2,1"/>
  <circle cx="16" cy="0" r="2" fill="#FFDD44">
    <animate attributeName="r" values="1.5;2.5;1.5" dur="0.2s" repeatCount="indefinite" />
  </circle>
  <circle cx="16" cy="0" r="0.8" fill="white"/>
  <rect x="12" y="8"  width="8" height="2" fill="#FFFFFF" opacity="0.3" rx="0.5"/>
  <rect x="12" y="13" width="8" height="2" fill="#FFFFFF" opacity="0.3" rx="0.5"/>
  <rect x="12" y="18" width="8" height="2" fill="#FFFFFF" opacity="0.3" rx="0.5"/>
  <rect x="11" y="23" width="10" height="6" rx="1" fill="#AA1800" stroke="#881100" stroke-width="1"/>
  <text x="16" y="28" font-size="5" fill="#FFDD44" text-anchor="middle" font-family="monospace" font-weight="bold">TNT</text>
`);

export const SVG_PORTAL_INACTIVE = svg(`
  <defs>
    <radialGradient id="pig" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#1a1a3a"/>
      <stop offset="100%" stop-color="#05050f"/>
    </radialGradient>
  </defs>
  <ellipse cx="16" cy="16" rx="13" ry="14" fill="url(#pig)" stroke="#2a2a5a" stroke-width="1.5"/>
  <ellipse cx="16" cy="16" rx="9"  ry="10" fill="none" stroke="#3a3a6a" stroke-width="1"/>
  <ellipse cx="16" cy="16" rx="5"  ry="6"  fill="none" stroke="#2a2a4a" stroke-width="0.8"/>
`);

export const SVG_PORTAL_ACTIVE = svg(`
  <defs>
    <radialGradient id="pag" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#00FFFF"/>
      <stop offset="70%" stop-color="#0066FF"/>
      <stop offset="100%" stop-color="#000033"/>
    </radialGradient>
    <filter id="p-glow"><feGaussianBlur stdDeviation="2.5"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0.8  0 0 0 0 1  0 0 0 1 0"/></filter>
  </defs>
  <circle cx="16" cy="16" r="15" fill="#00AAFF" filter="url(#p-glow)" opacity="0.6"/>
  <ellipse cx="16" cy="16" rx="14" ry="15" fill="url(#pag)" stroke="#88FFFF" stroke-width="1.5"/>
  <path d="M16 4 A12 12 0 0 1 28 16" stroke="white" stroke-width="1" fill="none" opacity="0.6">
    <animateTransform attributeName="transform" type="rotate" from="0 16 16" to="360 16 16" dur="2s" repeatCount="indefinite"/>
  </path>
  <path d="M4 16 A12 12 0 0 1 16 28" stroke="#88FFFF" stroke-width="1" fill="none" opacity="0.4">
    <animateTransform attributeName="transform" type="rotate" from="360 16 16" to="0 16 16" dur="3s" repeatCount="indefinite"/>
  </path>
  <circle cx="16" cy="16" r="4" fill="white" opacity="0.3"/>
`);

export const SVG_MACHINE_INACTIVE = svg(`
  <defs>
    <linearGradient id="machg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#504838"/>
      <stop offset="100%" stop-color="#282018"/>
    </linearGradient>
  </defs>
  <rect x="2" y="4" width="28" height="24" rx="3" fill="url(#machg)" stroke="#383020" stroke-width="1.5"/>
  <rect x="5" y="7"  width="22" height="8"  rx="2" fill="#1a1410" stroke="#504030" stroke-width="1"/>
  <circle cx="9"  cy="22" r="3" fill="#3a3028" stroke="#504030" stroke-width="1"/>
  <circle cx="16" cy="22" r="3" fill="#3a3028" stroke="#504030" stroke-width="1"/>
  <circle cx="23" cy="22" r="3" fill="#3a3028" stroke="#504030" stroke-width="1"/>
  <rect x="12" y="9" width="8" height="4" rx="1" fill="#252015" stroke="#4a3828" stroke-width="0.8"/>
`);

export const SVG_MACHINE_ACTIVE = svg(`
  <defs>
    <linearGradient id="machag" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#705830"/>
      <stop offset="100%" stop-color="#402808"/>
    </linearGradient>
    <filter id="machglow">
      <feGaussianBlur stdDeviation="1.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect x="2" y="4" width="28" height="24" rx="3" fill="url(#machag)" stroke="#886630" stroke-width="1.5"/>
  <rect x="5" y="7"  width="22" height="8"  rx="2" fill="#1a0d00" stroke="#AA8840" stroke-width="1" filter="url(#machglow)"/>
  <circle cx="9"  cy="22" r="3" fill="#FFAA00" stroke="#CC8800" stroke-width="1" filter="url(#machglow)"/>
  <circle cx="16" cy="22" r="3" fill="#FFAA00" stroke="#CC8800" stroke-width="1" filter="url(#machglow)"/>
  <circle cx="23" cy="22" r="3" fill="#FFAA00" stroke="#CC8800" stroke-width="1" filter="url(#machglow)"/>
  <rect x="12" y="9" width="8" height="4" rx="1" fill="#FF8800" stroke="#FFAA00" stroke-width="0.8" filter="url(#machglow)" opacity="0.8"/>
`);

// ─────────────────────────────────────────────
//  PLAYER — Dr. Carter (4 directions)
// ─────────────────────────────────────────────

function playerBase(hatColor = '#D4AF37', hatBrim = '#B8860B') {
  return `
  <ellipse cx="16" cy="30" rx="7" ry="2.5" fill="black" opacity="0.4"/>
  <rect x="9" y="16" width="14" height="12" rx="2.5" fill="#8B4513"/>
  <rect x="9" y="22" width="14" height="3" fill="#3E2723"/>
  <rect x="14" y="21.5" width="4" height="4" rx="1" fill="#FFD700" stroke="#B8860B" stroke-width="0.5"/>
  <rect x="9" y="28" width="6" height="4" rx="1.5" fill="#212121"/>
  <rect x="17" y="28" width="6" height="4" rx="1.5" fill="#212121"/>
  <circle cx="16" cy="12" r="7" fill="#FFCC99"/>
  <rect x="6" y="10" width="20" height="3" rx="1.5" fill="${hatBrim}"/>
  <path d="M10 11 L10 5 Q16 2 22 5 L22 11" fill="${hatColor}"/>
  <rect x="10" y="8" width="12" height="2" fill="#4E342E"/>
`;
}

export const SVG_PLAYER_DOWN = svg(`
  ${playerBase()}
  <!-- Face front — eyes + stubble -->
  <circle cx="13" cy="12" r="1.2" fill="#1a0800"/>
  <circle cx="19" cy="12" r="1.2" fill="#1a0800"/>
  <circle cx="13.4" cy="11.6" r="0.5" fill="white"/>
  <circle cx="19.4" cy="11.6" r="0.5" fill="white"/>
  <line x1="14" y1="15" x2="18" y2="15" stroke="#C08050" stroke-width="0.8" opacity="0.6"/>
  <!-- Arms -->
  <rect x="5"  y="16" width="5" height="9" rx="2" fill="#8B6030"/>
  <rect x="22" y="16" width="5" height="9" rx="2" fill="#8B6030"/>
`);

export const SVG_PLAYER_UP = svg(`
  ${playerBase()}
  <!-- Back of head -->
  <rect x="10" y="9" width="12" height="2" fill="#8A6010"/>
  <!-- Arms -->
  <rect x="5"  y="16" width="5" height="9" rx="2" fill="#8B6030"/>
  <rect x="22" y="16" width="5" height="9" rx="2" fill="#8B6030"/>
`);

export const SVG_PLAYER_LEFT = svg(`
  ${playerBase()}
  <!-- Side profile -->
  <circle cx="13" cy="12" r="1.2" fill="#1a0800"/>
  <circle cx="13.3" cy="11.6" r="0.5" fill="white"/>
  <!-- Arm (near side) -->
  <rect x="5"  y="16" width="5" height="9" rx="2" fill="#8B6030"/>
`);

export const SVG_PLAYER_RIGHT = svg(`
  ${playerBase()}
  <!-- Side profile -->
  <circle cx="19" cy="12" r="1.2" fill="#1a0800"/>
  <circle cx="19.3" cy="11.6" r="0.5" fill="white"/>
  <!-- Arm (near side) -->
  <rect x="22" y="16" width="5" height="9" rx="2" fill="#8B6030"/>
`);

// ─────────────────────────────────────────────
//  ENEMIES
// ─────────────────────────────────────────────

export const SVG_MUMMY = svg(`
  <defs>
    <linearGradient id="mummyg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#EFEBE9"/>
      <stop offset="100%" stop-color="#BCAAA4"/>
    </linearGradient>
    <filter id="mummyglow"><feGaussianBlur stdDeviation="1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect x="9" y="14" width="14" height="15" rx="3" fill="url(#mummyg)"/>
  <path d="M9 16 H23 M9 20 H23 M9 24 H23" stroke="#8D6E63" stroke-width="0.8" opacity="0.6"/>
  <circle cx="16" cy="9" r="8" fill="url(#mummyg)"/>
  <path d="M10 6 Q16 4 22 6" stroke="#8D6E63" stroke-width="1" fill="none"/>
  <circle cx="12" cy="9" r="2.5" fill="#FF0000" filter="url(#mummyglow)"/>
  <circle cx="20" cy="9" r="2.5" fill="#FF0000" filter="url(#mummyglow)"/>
  <rect x="4" y="14" width="5" height="10" rx="2" fill="#D7CCC8" transform="rotate(-15 4 14)"/>
  <rect x="23" y="14" width="5" height="10" rx="2" fill="#D7CCC8" transform="rotate(15 28 14)"/>
  <path d="M10 28 L8 32 M22 28 L24 32" stroke="#BCAAA4" stroke-width="1.5"/>
`);

export const SVG_FLY = svg(`
  <defs>
    <radialGradient id="flyg" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#88AA44"/>
      <stop offset="100%" stop-color="#224411"/>
    </radialGradient>
  </defs>
  <!-- Wings -->
  <ellipse cx="8"  cy="14" rx="7" ry="4" fill="#AACCFF" opacity="0.6" transform="rotate(-20 8 14)"/>
  <ellipse cx="24" cy="14" rx="7" ry="4" fill="#AACCFF" opacity="0.6" transform="rotate(20 24 14)"/>
  <ellipse cx="8"  cy="16" rx="6" ry="3" fill="#BBDDFF" opacity="0.4" transform="rotate(-10 8 16)"/>
  <ellipse cx="24" cy="16" rx="6" ry="3" fill="#BBDDFF" opacity="0.4" transform="rotate(10 24 16)"/>
  <!-- Body -->
  <ellipse cx="16" cy="18" rx="6" ry="8" fill="url(#flyg)" stroke="#112208" stroke-width="1"/>
  <!-- Abdomen stripes -->
  <line x1="10" y1="19" x2="22" y2="19" stroke="#336622" stroke-width="1.5" opacity="0.5"/>
  <line x1="10" y1="22" x2="22" y2="22" stroke="#112208" stroke-width="1.5" opacity="0.4"/>
  <line x1="11" y1="25" x2="21" y2="25" stroke="#336622" stroke-width="1" opacity="0.4"/>
  <!-- Head -->
  <circle cx="16" cy="11" r="5" fill="#448822" stroke="#112208" stroke-width="1"/>
  <!-- Compound eyes -->
  <circle cx="13" cy="10" r="2.5" fill="#FF3300"/>
  <circle cx="19" cy="10" r="2.5" fill="#FF3300"/>
  <circle cx="13.5" cy="9.5" r="1" fill="#FF7744" opacity="0.8"/>
  <circle cx="19.5" cy="9.5" r="1" fill="#FF7744" opacity="0.8"/>
  <!-- Antennae -->
  <line x1="14" y1="7" x2="11" y2="3" stroke="#224411" stroke-width="1"/>
  <line x1="18" y1="7" x2="21" y2="3" stroke="#224411" stroke-width="1"/>
  <circle cx="11" cy="3" r="1" fill="#448822"/>
  <circle cx="21" cy="3" r="1" fill="#448822"/>
`);

// ─────────────────────────────────────────────
//  EXPLOSION FRAMES (8 frames)
// ─────────────────────────────────────────────

function explosionFrame(f) {
  const r  = 4 + f * 1.8;
  const op = Math.max(0, 1 - f / 8);
  const colors = ['#FFFF88','#FFDD00','#FF8800','#FF4400','#CC2200','#882200','#441100','#220800'];
  const c = colors[Math.min(f, 7)];
  return svg(`
    <defs>
      <radialGradient id="exg${f}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="white" stop-opacity="${op}"/>
        <stop offset="40%" stop-color="${c}" stop-opacity="${op * 0.9}"/>
        <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="16" cy="16" r="${r}" fill="url(#exg${f})"/>
    ${f < 4 ? `<circle cx="16" cy="16" r="${r * 0.5}" fill="white" opacity="${op * 0.6}"/>` : ''}
  `);
}

export const SVG_EXPLOSION = [0,1,2,3,4,5,6,7].map(explosionFrame);

// ─────────────────────────────────────────────
//  SPRITE ATLAS LOADER
// ─────────────────────────────────────────────

function svgToImage(svgStr) {
  return new Promise((resolve) => {
    const img = new Image();
    // Using Data URL instead of Blobs to avoid URL.createObjectURL management overhead
    const svgData = encodeURIComponent(svgStr);
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${svgData}`;
  });
}

export async function loadAllSprites() {
  const defs = {
    empty:             SVG_EMPTY,
    dirt:              SVG_DIRT,
    stone:             SVG_STONE,
    gravel:            SVG_GRAVEL,
    sand:              SVG_SAND,
    ladder:            SVG_LADDER,
    boulder:           SVG_BOULDER,
    crystal:           SVG_CRYSTAL,
    gem:               SVG_GEM,
    key:               SVG_KEY,
    door_closed:       SVG_DOOR_CLOSED,
    door_open:         SVG_DOOR_OPEN,
    dynamite:          SVG_DYNAMITE,
    portal_inactive:   SVG_PORTAL_INACTIVE,
    portal_active:     SVG_PORTAL_ACTIVE,
    machine_inactive:  SVG_MACHINE_INACTIVE,
    machine_active:    SVG_MACHINE_ACTIVE,
    player_down:       SVG_PLAYER_DOWN,
    player_up:         SVG_PLAYER_UP,
    player_left:       SVG_PLAYER_LEFT,
    player_right:      SVG_PLAYER_RIGHT,
    mummy:             SVG_MUMMY,
    fly:               SVG_FLY,
  };

  const keys = Object.keys(defs);
  const totalSprites = keys.length + SVG_EXPLOSION.length;
  
  // Calculate Atlas size (Grid Layout)
  const cols = Math.ceil(Math.sqrt(totalSprites));
  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = cols * S;
  atlasCanvas.height = Math.ceil(totalSprites / cols) * S;
  const atlasCtx = atlasCanvas.getContext('2d');


  const spritesMap = {
    atlas: atlasCanvas,
    coords: {}, // Stores {x, y} for each sprite
    S: S        // Original tile size (32)
  };

  let idx = 0;

  // Render static sprites into Atlas
  for (const key of keys) {
    const img = await svgToImage(defs[key]);
    if (img) {
      const x = (idx % cols) * S;
      const y = Math.floor(idx / cols) * S;
      atlasCtx.drawImage(img, x, y);
      spritesMap.coords[key] = { x, y };
      idx++;
    }
  }

  // Render explosion frames into Atlas
  for (let i = 0; i < SVG_EXPLOSION.length; i++) {
    const img = await svgToImage(SVG_EXPLOSION[i]);
    if (img) {
      const x = (idx % cols) * S;
      const y = Math.floor(idx / cols) * S;
      atlasCtx.drawImage(img, x, y);
      spritesMap.coords[`explosion_${i}`] = { x, y };
      idx++;
    }
  }

  return spritesMap;
}

