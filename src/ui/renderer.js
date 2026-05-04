// ============================================================
// CRYPT RAIDER v2 — Renderer
// Portrait-first canvas rendering, no d-pad, upgraded UI
// ============================================================

import { TILE, TILE_SIZE, COLS, ROWS, STATE, CONFIG, HUD_OFFSET } from '../engine/constants.js';
import { LEVELS } from '../levels/levelData.js';

const T = TILE_SIZE; // 32

// Translation map: Numeric Tile ID -> Sprite Atlas Key
const TILE_MAP = {
  [TILE.EMPTY]:       'empty',
  [TILE.DIRT]:        'dirt',
  [TILE.STONE]:       'stone',
  [TILE.GRAVEL]:      'gravel',
  [TILE.SAND]:        'sand',
  [TILE.LADDER]:      'ladder',
  [TILE.BOULDER]:     'boulder',
  [TILE.CRYSTAL]:     'crystal',
  [TILE.GEM]:         'gem',
  [TILE.KEY]:         'key',
  [TILE.DOOR]:        'door_closed',
  [TILE.DYNAMITE]:    'dynamite',
  [TILE.PORTAL]:      'portal_inactive',
  [TILE.PORTAL_OPEN]: 'portal_active',
  [TILE.MACHINE]:     'machine_inactive',
  [TILE.ENEMY_M]:     'mummy',
  [TILE.ENEMY_F]:     'fly',
  [TILE.EXPLOSION]:   'explosion_0'
};



export class Renderer {
  constructor(canvas, sprites) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d', { alpha: false });
    this.sprites = sprites;

    this._frame       = 0;
    this._shake       = 0;
    this._shakeDecay  = 0.85;  // UPGRADE 2: configurable decay
    this._shakeDur    = 0;     // remaining ms for duration-limited shakes
    this._hudOffset = HUD_OFFSET;
    this._menuGlow  = null;
    this._hudGrad   = null;
    this._hudGradW  = 0;
    this._portalPulse = 0;
    this._particles   = [];
    this._undoFlash   = 0;     // UPGRADE 1: white flash on undo (0..1)

    this.updateLayout();
    this._initParticles();
  }

  // ── UPGRADE 2: Robust screen shake ───────────────────────
  /**
   * Trigger a screen shake with optional duration clamping.
   * @param {number} intensity  Max pixel displacement (1-20 recommended)
   * @param {number} [duration] Duration in ms. If omitted, decays naturally.
   */
  triggerShake(intensity, duration = 0) {
    this._shake    = Math.max(this._shake, intensity); // accumulate, don't reset
    this._shakeDur = duration > 0 ? duration : 0;
  }

  /** Legacy alias kept for existing call-sites in physics.js / gameSession.js */
  applyShake(amount = 8) {
    this.triggerShake(amount);
  }

  // ── UPGRADE 1: Undo flash ─────────────────────────────────
  /** Call when an undo is performed to flash the screen briefly. */
  triggerUndoFlash() {
    this._undoFlash = 1.0;
  }



  _initParticles() {
    for (let i = 0; i < 28; i++) {
      this._particles.push(this._newParticle());
    }
  }

  _newParticle() {
    const W = this.canvas.width;
    const H = this.canvas.height;
    return {
      x:    Math.random() * W,
      y:    Math.random() * H,
      vy:   -(0.2 + Math.random() * 0.6),
      vx:   (Math.random() - 0.5) * 0.3,
      life: Math.random(),
      size: 0.8 + Math.random() * 1.6,
      hue:  Math.random() > 0.5 ? '#FF8800' : '#FFD700',
    };
  }

  _tickParticles() {
    const H = this.canvas.height;
    for (const p of this._particles) {
      p.x    += p.vx;
      p.y    += p.vy;
      p.life -= 0.004;
      if (p.life <= 0 || p.y < 0) {
        Object.assign(p, this._newParticle());
        p.y = H;
      }
    }
  }

  tick() {
    this._frame++;
    this._portalPulse = (this._portalPulse + 0.08) % (Math.PI * 2);
    this._tickParticles();
  }
  
  updateLayout() {
    this._hudOffset = HUD_OFFSET;
    this._menuGlow  = null; // invalidate gradient caches on resize
    this._hudGrad   = null;
  }

  // ── Master render dispatcher ──────────────────────────────
  render(gameState, session, input) {
    this.tick();
    const ctx = this.ctx;

    // Save before any shake translate so the transform is always fully reset.
    ctx.save();

    if (this._shake > 0.1) {
      // UPGRADE 2: Sine-modulated displacement gives a smoother feel than
      // pure random; still noisy enough to feel physical.
      const phase = this._frame * 1.3;
      const sx = Math.sin(phase)       * this._shake * 0.7 + (Math.random() - 0.5) * this._shake * 0.3;
      const sy = Math.sin(phase + 1.6) * this._shake * 0.7 + (Math.random() - 0.5) * this._shake * 0.3;
      ctx.translate(sx, sy);
      this._shake *= this._shakeDecay;
    }

    // Full clear every frame — _renderGrid now blits the pre-baked static background
    // canvas in one drawImage call, so this clear is cheap relative to per-cell draws.
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    switch (gameState) {
      case STATE.PLAYING:     this._renderGame(session); break;
      case STATE.PAUSED:      this._renderPause(session); break;
      case STATE.LEVEL_START: this._renderLevelStart(session); break;
      case STATE.STORY:       this._renderStory(); break;
      case STATE.MENU:        this._renderMenu(session); break;
      case STATE.CODE_ENTRY:  this._renderCodeEntry(session); break;
      case STATE.HIGH_SCORES: this._renderHighScores(session); break;
      case STATE.LEVEL_WIN:   this._renderLevelWin(session); break;
      case STATE.LEVEL_FAIL:  this._renderLevelFail(session); break;
      case STATE.GAME_OVER:   this._renderGameOver(session); break;
      case STATE.GAME_WIN:    this._renderGameWin(session); break;
      default: break;
    }

    if (session?.grid) {
      // Invalidate -cell cache if any dirty cell was an animated tile type.
      if (this._animatedCells) {
        for (const i of session.grid.dirtyCells) {
          if (this._animatedCells.has(i)) { this._animatedCells = null; break; }
        }
      }
      session.grid.clearDirty();
    }
    ctx.restore();

    // UPGRADE 1: Undo flash — white overlay drawn AFTER restore (unshaken)
    if (this._undoFlash > 0.01) {
      ctx.globalAlpha = this._undoFlash * 0.35;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.globalAlpha = 1;
      this._undoFlash *= 0.72; // fast fade
    }
  }


  // ── GAME (playing) ────────────────────────────────────────
  _renderGame(session) {
    // 1. Static/Dirty Grid logic
    this._renderGrid(session.grid, session);
    
    // 2. AAA Interpolation Layer
    this._renderMovingEntities(session);
    
    // 3. Entity Layer
    this.renderPlayer(session);
    
    // 4. VFX Layer
    this._renderEffects(session.effects);
    
    // 5. UI Layer
    this._renderHUD(session);
    this._renderSwipeHint();
  }


  // Small persistent swipe reminder at bottom
  _renderSwipeHint() {
    if (this._frame > 300) return; // only show for ~5 seconds
    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;
    const alpha = Math.max(0, 1 - (this._frame - 240) / 60);
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha * 0.55;
    ctx.fillStyle   = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, H - 22, W, 22);
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle   = '#CC8833';
    ctx.font        = '10px "Share Tech Mono", monospace';
    ctx.textAlign   = 'center';
    ctx.fillText('SWIPE to move  •  Double-tap for TNT', W / 2, H - 7);
    ctx.restore();
  }

drawFromAtlas(key, x, y, size = T, offsetY = 0) {
    const s = this.sprites;
    const coord = s.coords ? s.coords[key] : null;
    if (!coord || !s.atlas) return;

    this.ctx.drawImage(
      s.atlas,
      coord.x, coord.y, s.S, s.S,
      Math.floor(x * T), Math.floor((y * T) + offsetY), 
      size, size
    );
}

  _renderMovingEntities(session) {
    // Since _renderGrid now draws all cells every frame (including falling ones
    // at their logical position), this pass only needs to handle mid-fall
    // animation offset — drawing the sprite slightly above its grid row to give
    // smooth motion. The base cell is already drawn by _renderGrid as empty.
    const grid = session.grid;
    for (let i = 0; i < grid.cells.length; i++) {
      const meta = grid.meta[i];
      if (!meta?.falling) continue;

      const x = i % grid.cols;
      const y = Math.floor(i / grid.cols);

      // Animate: tile slides down from the row above into its current row.
      // fallAnim goes 0→1; at 0 the tile is T pixels above, at 1 it is in place.
      const progress = Math.min(1, meta.fallAnim ?? 1);
      const ease     = progress * progress; // ease-in
      const offsetPx = (1 - ease) * -T;    // starts T px above, ends at 0

      const type      = grid.cells[i];
      const spriteKey = TILE_MAP[type];
      if (spriteKey && spriteKey !== 'empty') {
        // Draw at current grid row with the animation offset applied on top of hudOffset.
        this.drawFromAtlas(spriteKey, x, y, T, this._hudOffset + offsetPx);
      }
    }
  }


  _renderGrid(grid, session) {
    // Draw every cell every frame. 187 drawImage calls is trivial on mobile GPU —
    // far cheaper than the correctness bugs caused by any static-cache approach
    // on a mutable grid where any cell can change at any time.
    for (let i = 0; i < grid.cells.length; i++) {
      const x    = i % grid.cols;
      const y    = Math.floor(i / grid.cols);
      const tile = grid.cells[i];
      const meta = grid.meta[i];
      this._drawCell(x, y, tile, meta, session);
    }
  }

  /** Draws a single cell at grid position (x, y) onto the main canvas. */
  _drawCell(x, y, tile, meta, session) {
    // 1. Always draw the floor base first.
    this.drawFromAtlas('empty', x, y, T, this._hudOffset);

    // 2. Nothing more to draw for empty cells.
    if (tile === TILE.EMPTY || tile === TILE.PLAYER) return;

    // 3. Falling tiles are handled by _renderMovingEntities with animation.
    if (meta?.falling) return;

    const spriteKey = TILE_MAP[tile];
    if (!spriteKey) return;

    // 4. Special-case tiles with animated or state-dependent sprites.
    if (tile === TILE.PORTAL || tile === TILE.PORTAL_OPEN) {
      const active = (tile === TILE.PORTAL_OPEN) || !!(session?.portalOpen);
      const pulse  = active ? Math.sin(this._frame * 0.1) * 3 : 0;
      this.drawFromAtlas(active ? 'portal_active' : 'portal_inactive', x, y, T, pulse + this._hudOffset);
    } else if (tile === TILE.GEM || tile === TILE.CRYSTAL) {
      const bob = Math.sin(this._frame * 0.1 + x + y) * 2;
      this.drawFromAtlas(spriteKey, x, y, T, bob + this._hudOffset);
    } else if (tile === TILE.DOOR) {
      this.drawFromAtlas(meta?.open ? 'door_open' : 'door_closed', x, y, T, this._hudOffset);
    } else if (tile === TILE.MACHINE) {
      const isOn = !!(meta?.active) || !!(session?.portalOpen);
      this.drawFromAtlas(isOn ? 'machine_active' : 'machine_inactive', x, y, T, this._hudOffset);
    } else {
      // All static tiles: stone, dirt, sand, boulder, gravel, ladder, key, dynamite, enemies, explosion.
      this.drawFromAtlas(spriteKey, x, y, T, this._hudOffset);
    }
  }

  /**
   * Bakes all static tiles (terrain that never animates: stone, dirt, sand,
   * ladders, boulders at rest, keys, doors, dynamite, machines, enemies at spawn)
   * into an offscreen canvas.  Animated tiles (crystals, gems, portals) are
   * intentionally LEFT OUT — they are drawn dynamically every frame on top.
   *
   * Critically: EMPTY tiles ARE baked (as the dark floor), so the blit provides
   * a complete background layer.  Entities (player, enemies) are NOT baked.
   */
  _buildStaticBg(grid) {
    const w = grid.cols * T;
    const h = grid.rows * T;

    if (!this._staticBg || this._staticBg.width !== w || this._staticBg.height !== h) {
      this._staticBg = document.createElement('canvas');
      this._staticBg.width  = w;
      this._staticBg.height = h;
    }

    const bgCtx = this._staticBg.getContext('2d');
    bgCtx.clearRect(0, 0, w, h);

    // Tiles that must NOT be baked — drawn dynamically each frame.
    const DYNAMIC = new Set([
      TILE.PLAYER, TILE.ENEMY_M, TILE.ENEMY_F,
      TILE.PORTAL, TILE.PORTAL_OPEN,  // animated pulse
      TILE.GEM, TILE.CRYSTAL,          // animated bob
      TILE.EXPLOSION,
    ]);

    const s = this.sprites;

    for (let i = 0; i < grid.cells.length; i++) {
      const tile = grid.cells[i];
      const x    = i % grid.cols;
      const y    = Math.floor(i / grid.cols);

      // Always bake the empty floor base.
      if (s.coords?.empty && s.atlas) {
        const c = s.coords.empty;
        bgCtx.drawImage(s.atlas, c.x, c.y, s.S, s.S, x * T, y * T, T, T);
      }

      if (DYNAMIC.has(tile) || tile === TILE.EMPTY) continue;

      // Boulders and gravel: bake initial position; physics marks them dirty
      // when they move, so _drawStaticCell repaints with current state.
      const spriteKey = TILE_MAP[tile];
      if (!spriteKey) continue;

      // Machine: bake inactive state; active state is handled in _drawStaticCell
      // when the machine's dirty bit is set after portal opens.
      const key = tile === TILE.MACHINE ? 'machine_inactive' : spriteKey;
      if (s.coords?.[key] && s.atlas) {
        const c = s.coords[key];
        bgCtx.drawImage(s.atlas, c.x, c.y, s.S, s.S, x * T, y * T, T, T);
      }
    }
  }

  /** Bakes all static (non-animated, non-entity) tiles onto an offscreen canvas. */
  _buildStaticBg(grid) {
    const w = grid.cols * T;
    const h = grid.rows * T;

    if (!this._staticBg || this._staticBg.width !== w || this._staticBg.height !== h) {
      this._staticBg = document.createElement('canvas');
      this._staticBg.width  = w;
      this._staticBg.height = h;
    }

    const bgCtx = this._staticBg.getContext('2d');
    bgCtx.clearRect(0, 0, w, h);

    const ANIMATED = new Set([TILE.PORTAL, TILE.PORTAL_OPEN, TILE.GEM, TILE.CRYSTAL]);
    const SKIP     = new Set([TILE.PLAYER, TILE.ENEMY_M, TILE.ENEMY_F, TILE.EXPLOSION,
                              TILE.DYNAMITE, TILE.BOULDER, TILE.GRAVEL]);

    for (let i = 0; i < grid.cells.length; i++) {
      const tile = grid.cells[i];
      const x    = i % grid.cols;
      const y    = Math.floor(i / grid.cols);
      const meta = grid.meta[i];

      // Always draw the empty floor base.
      const s = this.sprites;
      if (s.coords?.empty && s.atlas) {
        const c = s.coords.empty;
        bgCtx.drawImage(s.atlas, c.x, c.y, s.S, s.S, x * T, y * T, T, T);
      }

      // Skip entities, falling objects, and animated tiles — they are drawn dynamically.
      if (SKIP.has(tile) || ANIMATED.has(tile) || tile === TILE.EMPTY) continue;
      if (meta?.falling) continue;

      const spriteKey = TILE_MAP[tile];
      if (!spriteKey) continue;

      if (s.coords?.[spriteKey] && s.atlas) {
        const c = s.coords[spriteKey];
        bgCtx.drawImage(s.atlas, c.x, c.y, s.S, s.S, x * T, y * T, T, T);
      }
    }
  }


  renderPlayer(session) {
    if (!session.player?.alive) return;
    const { x, y, dir } = session.player;
    const dirKey = dir?.name?.toLowerCase() || 'down';
    // If player is occupying a ladder cell, render ladder first then player on top
    if (session.grid?.isClimbable(x, y)) {
      this.drawFromAtlas('ladder', x, y, T, this._hudOffset);
    }
    this.drawFromAtlas(`player_${dirKey}`, x, y, T, this._hudOffset);
  }

  // ── Effects ───────────────────────────────────────────────

  // UPGRADE 2: Juice particle colour palette by kind
  static _JUICE_COLORS = {
    collect: ['#FFD700', '#FFF176', '#FF8C00', '#FFEC6E'],
    crush:   ['#FF4444', '#FF8800', '#FFAA44', '#CC2200'],
    dig:     ['#8B6914', '#C4962A', '#D4A84B', '#7A5C1E'],
  };

  _renderEffects(effects) {
    const ctx = this.ctx;
    const hudY = this._hudOffset;

    for (const fx of effects) {
      // ── Explosion sprites ───────────────────────────────
      if (fx.type === 'explosion') {
        if (fx.frame === 0) this.applyShake(12);
        const frame = Math.min(Math.floor(fx.frame), 7);
        this.drawFromAtlas(`explosion_${frame}`, fx.x, fx.y, T * 2.5, hudY - T);
      }

      // ── UPGRADE 2: Juice particles ─────────────────────
      if (fx.type === 'juice') {
        const t        = fx.frame / fx.maxFrame;          // 0→1 progress
        const alpha    = Math.max(0, 1 - t * t);          // quadratic fade
        const px       = fx.x * T + T / 2 + fx.vx * fx.frame * T * 0.18;
        const py       = hudY + fx.y * T + T / 2 + fx.vy * fx.frame * T * 0.18;
        const radius   = fx.size * (1 - t * 0.5);        // shrink slightly

        const palette  = Renderer._JUICE_COLORS[fx.kind] || Renderer._JUICE_COLORS.collect;
        const color    = palette[fx.frame % palette.length];

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.5, radius), 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }



  // ── HUD (portrait) ────────────────────────────────────────
  _renderHUD(session) {
    const ctx = this.ctx;
    const W   = this.canvas.width;

    // Gradient HUD bar — baked once, reused every frame.
    if (!this._hudGrad || this._hudGradW !== W) {
      this._hudGrad  = ctx.createLinearGradient(0, 0, 0, 38);
      this._hudGrad.addColorStop(0, 'rgba(5,2,0,0.95)');
      this._hudGrad.addColorStop(1, 'rgba(5,2,0,0.0)');
      this._hudGradW = W;
    }
    ctx.fillStyle = this._hudGrad;
    ctx.fillRect(0, 0, W, 38);

    // Bottom thin accent line
    ctx.strokeStyle = '#3A2000';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(0, 37); ctx.lineTo(W, 37);
    ctx.stroke();

    const font = '"Share Tech Mono", monospace';

    // ── Lives ──
    ctx.fillStyle = '#FF4444';
    ctx.font      = `bold 13px ${font}`;
    ctx.textAlign = 'left';
    ctx.fillText(`♥ ${session.lives}`, 8, 22);

    // ── Energy bar ──
    const barX = 44, barW = 48, barH = 8;
    const ep   = session.player ? session.player.energy / CONFIG.MAX_ENERGY : 1;
    const barColor = ep > 0.5 ? '#44FF66' : ep > 0.25 ? '#FFAA00' : '#FF3333';
    ctx.fillStyle   = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(barX, 14, barW, barH, 3);
    ctx.fill();
    ctx.fillStyle = barColor;
    ctx.beginPath();
    ctx.roundRect(barX, 14, barW * ep, barH, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth   = 0.8;
    ctx.beginPath();
    ctx.roundRect(barX, 14, barW, barH, 3);
    ctx.stroke();

    // ── Score ──
    ctx.fillStyle = '#FFD700';
    ctx.font      = `bold 13px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText(session.score, W / 2, 22);

    // ── Crystal counter ──
    const remaining = Math.max(0, (session.crystalsTotal || 0) - (session.crystalsDeposited || 0));
    ctx.fillStyle = '#55CCFF';
    ctx.font      = `bold 12px ${font}`;
    ctx.textAlign = 'right';
    ctx.fillText(`◆${remaining}`, W - 68, 22);

    // ── Timer ──
    const t   = Math.ceil(session.timeLeft);
    const col = t > 30 ? '#88FFFF' : '#FF4444';
    ctx.fillStyle = col;
    ctx.font      = `bold 13px ${font}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${t}s`, W - 6, 22);

    // ── Level badge ──
    const lvlX = W / 2;
    ctx.fillStyle = 'rgba(255,215,0,0.12)';
    ctx.beginPath();
    ctx.roundRect(lvlX - 22, 4, 44, 14, 4);
    ctx.fill();
    ctx.fillStyle = '#AA8822';
    ctx.font      = `10px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText(`LVL ${session.currentLevel + 1}`, lvlX, 14);

    // ── Portal open indicator — rendered inside HUD height, not below ──
    if (session.portalOpen) {
      const pulse = 0.65 + Math.sin(this._frame * 0.18) * 0.35;
      ctx.save();
      ctx.globalAlpha = pulse;
      // Small pill badge in top-right area
      const badgeW = 86, badgeH = 13, badgeX = W - badgeW - 4, badgeY = 24;
      ctx.fillStyle = 'rgba(0,255,200,0.15)';
      ctx.beginPath(); ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6); ctx.fill();
      ctx.fillStyle   = '#00FFCC';
      ctx.font        = `bold 9px ${font}`;
      ctx.textAlign   = 'center';
      ctx.shadowColor = '#00FFCC';
      ctx.shadowBlur  = 6;
      ctx.fillText('▶ PORTAL OPEN ◀', badgeX + badgeW / 2, badgeY + 9);
      ctx.restore();
    }
  }

  // ── MENU ──────────────────────────────────────────────────
  _renderMenu(session) {
    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;

    // Deep background
    ctx.fillStyle = '#050200';
    ctx.fillRect(0, 0, W, H);

    // Radial glow — baked once per canvas size.
    if (!this._menuGlow || this._menuGlowW !== W || this._menuGlowH !== H) {
      this._menuGlow  = ctx.createRadialGradient(W/2, H*0.22, 0, W/2, H*0.22, W*0.7);
      this._menuGlow.addColorStop(0,   'rgba(180,80,0,0.25)');
      this._menuGlow.addColorStop(0.5, 'rgba(100,30,0,0.1)');
      this._menuGlow.addColorStop(1,   'rgba(0,0,0,0)');
      this._menuGlowW = W;
      this._menuGlowH = H;
    }
    ctx.fillStyle = this._menuGlow;
    ctx.fillRect(0, 0, W, H);

    // Ambient ember particles
    for (const p of this._particles) {
      ctx.save();
      ctx.globalAlpha = p.life * 0.7;
      ctx.fillStyle   = p.hue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Hieroglyph dividers
    ctx.strokeStyle = '#3A2000';
    ctx.lineWidth   = 1;
    this._drawHieroglyphBand(ctx, W, H * 0.10);
    this._drawHieroglyphBand(ctx, W, H * 0.90);

    // Title
    const titleY = H * 0.22;
    ctx.save();
    ctx.shadowColor = '#FF6600';
    ctx.shadowBlur  = 18;
    ctx.fillStyle   = '#FFD700';
    ctx.font        = `900 ${Math.floor(W * 0.11)}px "Cinzel", serif`;
    ctx.textAlign   = 'center';
    ctx.fillText('CRYPT', W / 2, titleY);
    ctx.shadowBlur  = 12;
    ctx.fillStyle   = '#FFA820';
    ctx.fillText('RAIDER', W / 2, titleY + Math.floor(W * 0.12));
    ctx.restore();

    ctx.fillStyle = '#886633';
    ctx.font      = `italic ${Math.floor(W * 0.035)}px "Cinzel", serif`;
    ctx.textAlign = 'center';
    ctx.fillText('The Lost Tombs of Dr. Carter', W / 2, H * 0.38);

    // Menu buttons
    const buttons = [
      { label: '▶  NEW GAME',    col: '#FFD700', bg: 'rgba(255,160,0,0.14)', border: '#AA7700' },
      { label: '🔑  ENTER CODE', col: '#CCAA44', bg: 'rgba(180,120,0,0.08)', border: '#6A5010' },
      { label: '🏆  HIGH SCORE', col: '#CCAA44', bg: 'rgba(180,120,0,0.08)', border: '#6A5010' },
    ];

    const btnH  = Math.floor(H * 0.072);
    const btnW  = Math.floor(W * 0.78);
    const btnX  = (W - btnW) / 2;
    const startY = H * 0.47;
    const gap   = btnH + 10;
    const font  = '"Share Tech Mono", monospace';

    buttons.forEach((btn, i) => {
      const by = startY + i * gap;
      ctx.fillStyle = btn.bg;
      ctx.beginPath();
      ctx.roundRect(btnX, by, btnW, btnH, 6);
      ctx.fill();
      ctx.strokeStyle = btn.border;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.roundRect(btnX, by, btnW, btnH, 6);
      ctx.stroke();
      ctx.fillStyle = btn.col;
      ctx.font      = `bold ${Math.floor(H * 0.022)}px ${font}`;
      ctx.textAlign = 'center';
      ctx.fillText(btn.label, W / 2, by + btnH * 0.64);
    });

    // High score
    ctx.fillStyle = '#554422';
    ctx.font      = `${Math.floor(H * 0.018)}px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText(`BEST SCORE: ${session?.highScore || 0}`, W / 2, H * 0.92);

    // Torch flicker glows
    const tf = 0.6 + Math.sin(this._frame * 0.14) * 0.4;
    [[W * 0.06, H * 0.5], [W * 0.94, H * 0.5]].forEach(([tx, ty]) => {
      ctx.save();
      ctx.globalAlpha = tf * 0.35;
      ctx.fillStyle   = '#FF8800';
      ctx.beginPath();
      ctx.arc(tx, ty, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Tap prompt
    const tapAlpha = 0.5 + Math.sin(this._frame * 0.08) * 0.5;
    ctx.save();
    ctx.globalAlpha = tapAlpha;
    ctx.fillStyle   = '#886633';
    ctx.font        = `${Math.floor(H * 0.016)}px ${font}`;
    ctx.textAlign   = 'center';
    ctx.fillText('tap to select', W / 2, H * 0.86);
    ctx.restore();
  }

  _drawHieroglyphBand(ctx, W, y) {
    ctx.save();
    ctx.strokeStyle = '#3A2000';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    // mini glyphs
    const glyphs = ['𓂀','𓆣','𓋴','𓏏','𓈖','𓆑'];
    ctx.fillStyle = '#2A1400';
    ctx.font      = '9px serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < 8; i++) {
      ctx.fillText(glyphs[i % glyphs.length], (W / 8) * i + W / 16, y + 10);
    }
    ctx.restore();
  }

  // ── STORY screen ─────────────────────────────────────────
  _renderStory() {
    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;
    const font = '"Share Tech Mono", monospace';

    // Background
    ctx.fillStyle = '#050200';
    ctx.fillRect(0, 0, W, H);

    // Scroll parchment
    ctx.fillStyle = 'rgba(40,25,5,0.85)';
    ctx.beginPath();
    ctx.roundRect(12, 36, W - 24, H - 80, 8);
    ctx.fill();
    ctx.strokeStyle = '#3A2000';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.roundRect(12, 36, W - 24, H - 80, 8);
    ctx.stroke();

    ctx.fillStyle = '#FFD700';
    ctx.font      = `900 ${Math.floor(W * 0.065)}px "Cinzel", serif`;
    ctx.textAlign = 'center';
    ctx.fillText('THE LEGEND', W / 2, 70);
    ctx.fillStyle = '#AA8833';
    ctx.font      = `${Math.floor(W * 0.038)}px "Cinzel", serif`;
    ctx.fillText('OF DR. CARTER', W / 2, 90);

    const lines = [
      'Deep within the lost tombs of Egypt,',
      'Dr. Carter seeks the mystical blue',
      'crystals of the ancient pharaohs.',
      '',
      'Beware the mummies and flies',
      'that guard the sacred chambers.',
      '',
      'Collect all crystals, deposit them',
      'in the machine, escape the portal',
      'before time runs out!',
    ];

    ctx.fillStyle = '#C8A860';
    ctx.font      = `${Math.floor(W * 0.036)}px ${font}`;
    const lineH   = Math.floor(H * 0.052);
    lines.forEach((line, i) => ctx.fillText(line, W / 2, 118 + i * lineH));

    // Controls reminder
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.roundRect(W * 0.1, H - 58, W * 0.8, 34, 6);
    ctx.fill();
    ctx.fillStyle = '#888855';
    ctx.font      = `${Math.floor(W * 0.032)}px ${font}`;
    ctx.fillText('SWIPE to move · Double-tap TNT', W / 2, H - 38);

    // Tap to begin
    const pulse = 0.5 + Math.sin(this._frame * 0.1) * 0.5;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle   = '#FFD700';
    ctx.font        = `bold ${Math.floor(W * 0.04)}px ${font}`;
    ctx.fillText('— Tap to Begin —', W / 2, H - 14);
    ctx.restore();
  }

  // ── CODE ENTRY ────────────────────────────────────────────
  _renderCodeEntry(session) {
    const ctx  = this.ctx;
    const W    = this.canvas.width;
    const H    = this.canvas.height;
    const font = '"Share Tech Mono", monospace';

    ctx.fillStyle = '#050200';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#FFD700';
    ctx.font      = `900 ${Math.floor(W * 0.07)}px "Cinzel", serif`;
    ctx.textAlign = 'center';
    ctx.fillText('ENTER CODE', W / 2, H * 0.22);

    // Code box
    const boxW = Math.floor(W * 0.72);
    const boxX = (W - boxW) / 2;
    const boxY = H * 0.33;
    const boxH = Math.floor(H * 0.09);

    ctx.fillStyle   = '#0d0600';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 6);
    ctx.fill();
    ctx.strokeStyle = '#CCAA44';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 6);
    ctx.stroke();

    ctx.fillStyle = '#FFD700';
    ctx.font      = `bold ${Math.floor(H * 0.042)}px ${font}`;
    
    // Draw individual slots for better readability on small screens
    const code = session?._codeInput || "";
    for (let i = 0; i < 6; i++) {
      const char = code[i] || "_";
      ctx.fillText(char, (W/2 - 100) + (i * 40), boxY + boxH * 0.68);
    }

    ctx.fillStyle = '#CCAA44';
    ctx.font      = `${Math.floor(H * 0.02)}px ${font}`;
    ctx.fillText('TAP TO OPEN VIRTUAL KEYBOARD', W / 2, H * 0.6);
    ctx.fillText('— Tap to return to menu —', W / 2, H * 0.72);
  }

  // ── LEVEL WIN ─────────────────────────────────────────────
  _renderLevelWin(session) {
    const ctx  = this.ctx;
    const W    = this.canvas.width;
    const H    = this.canvas.height;
    const font = '"Share Tech Mono", monospace';
    const cinzel = '"Cinzel", serif';

    // Dark green background
    ctx.fillStyle = '#030d06';
    ctx.fillRect(0, 0, W, H);

    // Particle shower — reuse existing particle system in gold
    for (const p of this._particles) {
      ctx.save();
      ctx.globalAlpha = Math.min(p.life, 1) * 0.85;
      ctx.fillStyle   = p.life > 0.5 ? '#FFD700' : '#00FF88';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Hieroglyph accent lines
    this._drawHieroglyphBand(ctx, W, H * 0.08);
    this._drawHieroglyphBand(ctx, W, H * 0.92);

    // ── Title ──
    ctx.save();
    ctx.textAlign   = 'center';
    ctx.shadowColor = '#00FF88';
    ctx.shadowBlur  = 24;
    ctx.fillStyle   = '#00FF88';
    ctx.font        = `900 ${Math.floor(W * 0.1)}px ${cinzel}`;
    ctx.fillText('LEVEL', W / 2, H * 0.22);
    ctx.shadowColor = '#FFD700';
    ctx.fillStyle   = '#FFD700';
    ctx.fillText('CLEAR!', W / 2, H * 0.32);
    ctx.restore();

    // Level number badge
    const badgeY = H * 0.37;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,215,0,0.10)';
    ctx.beginPath(); ctx.roundRect(W * 0.3, badgeY - 18, W * 0.4, 24, 12); ctx.fill();
    ctx.fillStyle = '#AA8822';
    ctx.font      = `bold ${Math.floor(H * 0.022)}px ${font}`;
    ctx.fillText(`— LEVEL ${session.currentLevel + 1} —`, W / 2, badgeY);
    ctx.restore();

    // ── Stats panel ──
    const panW = Math.floor(W * 0.82);
    const panX = (W - panW) / 2;
    const panY = H * 0.43;
    const panH = Math.floor(H * 0.28);
    const r    = 10;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 30, 15, 0.92)';
    ctx.strokeStyle = '#00AA55';
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.roundRect(panX, panY, panW, panH, r); ctx.fill();
    ctx.beginPath(); ctx.roundRect(panX, panY, panW, panH, r); ctx.stroke();
    ctx.restore();

    // Inner glow line
    ctx.save();
    ctx.strokeStyle = 'rgba(0,255,136,0.15)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.roundRect(panX + 4, panY + 4, panW - 8, panH - 8, r - 2); ctx.stroke();
    ctx.restore();

    // Stat rows
    const statFont  = `${Math.floor(H * 0.024)}px ${font}`;
    const labelCol  = '#667766';
    const valueCol  = '#FFD700';
    const row1Y = panY + panH * 0.25;
    const row2Y = panY + panH * 0.52;
    const row3Y = panY + panH * 0.78;
    const lx    = panX + panW * 0.12;
    const vx    = panX + panW * 0.88;

    ctx.font     = statFont;
    ctx.textAlign = 'left';

    // Score
    ctx.fillStyle = labelCol;
    ctx.fillText('SCORE', lx, row1Y);
    ctx.textAlign = 'right';
    ctx.fillStyle = valueCol;
    ctx.fillText(session.score.toLocaleString(), vx, row1Y);

    // Lives
    ctx.textAlign = 'left';
    ctx.fillStyle = labelCol;
    ctx.fillText('LIVES', lx, row2Y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FF6666';
    ctx.fillText('♥'.repeat(Math.max(0, session.lives)), vx, row2Y);

    // Time bonus hint
    ctx.textAlign = 'left';
    ctx.fillStyle = labelCol;
    ctx.fillText('LEVEL', lx, row3Y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#88FFCC';
    ctx.fillText(`${session.currentLevel + 1} / 100`, vx, row3Y);

    // ── Next level code ──
    const nextIdx = session.currentLevel + 1;
    if (nextIdx < 100) {
      import('../systems/levelCodes.js').then(({ generateCode }) => {
        // Store code for synchronous rendering
        this._nextLevelCode = generateCode(nextIdx);
      }).catch(() => {});

      if (this._nextLevelCode) {
        const codeY = H * 0.77;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(100,60,180,0.15)';
        ctx.beginPath(); ctx.roundRect(panX, codeY - 20, panW, 28, 6); ctx.fill();
        ctx.fillStyle = '#AA88FF';
        ctx.font      = `${Math.floor(H * 0.019)}px ${font}`;
        ctx.fillText(`NEXT CODE: ${this._nextLevelCode}`, W / 2, codeY);
        ctx.restore();
      }
    }

    // ── Tap to continue — pulsing CTA ──
    const pulse = 0.45 + Math.sin(this._frame * 0.12) * 0.55;
    ctx.save();
    ctx.textAlign   = 'center';
    ctx.globalAlpha = pulse;
    // Glow
    ctx.shadowColor = '#00FF88';
    ctx.shadowBlur  = 12;
    ctx.fillStyle   = '#00FF88';
    ctx.font        = `bold ${Math.floor(H * 0.03)}px ${cinzel}`;
    ctx.fillText('▶  TAP TO CONTINUE  ◀', W / 2, H * 0.88);
    ctx.restore();
  }

  // ── LEVEL FAIL ────────────────────────────────────────────
  _renderLevelFail(session) {
    const ctx    = this.ctx;
    const W      = this.canvas.width;
    const H      = this.canvas.height;
    const font   = '"Share Tech Mono", monospace';
    const cinzel = '"Cinzel", serif';

    ctx.fillStyle = '#100000';
    ctx.fillRect(0, 0, W, H);

    // Red radial glow
    const glow = ctx.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, W * 0.7);
    glow.addColorStop(0,   'rgba(200,0,0,0.3)');
    glow.addColorStop(0.6, 'rgba(80,0,0,0.1)');
    glow.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    this._drawHieroglyphBand(ctx, W, H * 0.08);
    this._drawHieroglyphBand(ctx, W, H * 0.92);

    // Title
    ctx.save();
    ctx.textAlign   = 'center';
    ctx.shadowColor = '#FF0000';
    ctx.shadowBlur  = 28;
    ctx.fillStyle   = '#FF3333';
    ctx.font        = `900 ${Math.floor(W * 0.13)}px ${cinzel}`;
    ctx.fillText('YOU', W / 2, H * 0.24);
    ctx.fillStyle = '#FF5555';
    ctx.fillText('DIED', W / 2, H * 0.36);
    ctx.restore();

    // Lives remaining panel
    const panW = Math.floor(W * 0.78);
    const panX = (W - panW) / 2;
    const panY = H * 0.43;
    const panH = Math.floor(H * 0.22);
    ctx.fillStyle   = 'rgba(40,0,0,0.9)';
    ctx.strokeStyle = '#881111';
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.roundRect(panX, panY, panW, panH, 8); ctx.fill();
    ctx.beginPath(); ctx.roundRect(panX, panY, panW, panH, 8); ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#664444';
    ctx.font      = `${Math.floor(H * 0.019)}px ${font}`;
    ctx.fillText('LIVES REMAINING', W / 2, panY + panH * 0.3);

    // Heart icons
    const hearts   = Math.max(0, session.lives);
    const heartStr = hearts > 0 ? '♥ '.repeat(hearts).trim() : '✕  NONE';
    ctx.fillStyle  = hearts > 0 ? '#FF4444' : '#664444';
    ctx.font       = `bold ${Math.floor(H * 0.038)}px ${font}`;
    ctx.fillText(heartStr, W / 2, panY + panH * 0.68);

    // CTA
    const pulse = 0.45 + Math.sin(this._frame * 0.12) * 0.55;
    ctx.save();
    ctx.textAlign   = 'center';
    ctx.globalAlpha = pulse;
    ctx.shadowColor = '#FF4444';
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = '#FF8888';
    ctx.font        = `bold ${Math.floor(H * 0.03)}px ${cinzel}`;
    ctx.fillText('▶  TAP TO RETRY  ◀', W / 2, H * 0.82);
    ctx.restore();
  }

  // ── GAME OVER ─────────────────────────────────────────────
  _renderGameOver(session) {
    this._renderOverlay('#180000', 0.94);
    const ctx  = this.ctx;
    const W    = this.canvas.width;
    const H    = this.canvas.height;
    const font = '"Share Tech Mono", monospace';

    ctx.save();
    ctx.shadowColor = '#FF0000';
    ctx.shadowBlur  = 28;
    ctx.fillStyle   = '#FF3333';
    ctx.font        = `900 ${Math.floor(W * 0.1)}px "Cinzel", serif`;
    ctx.textAlign   = 'center';
    ctx.fillText('GAME', W / 2, H * 0.28);
    ctx.fillText('OVER', W / 2, H * 0.4);
    ctx.restore();

    const panW = Math.floor(W * 0.76);
    const panX = (W - panW) / 2;
    const panY = H * 0.47;
    const panH = Math.floor(H * 0.2);
    ctx.fillStyle = 'rgba(40,0,0,0.8)';
    ctx.beginPath(); ctx.roundRect(panX, panY, panW, panH, 8); ctx.fill();
    ctx.strokeStyle = '#881111'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(panX, panY, panW, panH, 8); ctx.stroke();

    ctx.fillStyle = '#FFD700';
    ctx.font      = `${Math.floor(H * 0.028)}px ${font}`;
    ctx.fillText(`Score: ${session.score}`, W / 2, panY + panH * 0.38);
    ctx.fillStyle = '#CC8844';
    ctx.fillText(`Best:  ${session.highScore}`, W / 2, panY + panH * 0.68);

    const pulse = 0.5 + Math.sin(this._frame * 0.1) * 0.5;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle   = '#FFAAAA';
    ctx.font        = `bold ${Math.floor(H * 0.026)}px ${font}`;
    ctx.fillText('Tap to return to menu', W / 2, H * 0.85);
    ctx.restore();
  }

  // ── PAUSE ─────────────────────────────────────────────────
  _renderPause(session) {
    this._renderGame(session);
    this._renderOverlay('#000000', 0.65);
    const ctx  = this.ctx;
    const W    = this.canvas.width;
    const H    = this.canvas.height;
    const font = '"Share Tech Mono", monospace';

    ctx.save();
    ctx.shadowColor = '#FFAA00';
    ctx.shadowBlur  = 14;
    ctx.fillStyle   = '#FFD700';
    ctx.font        = `900 ${Math.floor(W * 0.1)}px "Cinzel", serif`;
    ctx.textAlign   = 'center';
    ctx.fillText('PAUSED', W / 2, H * 0.42);
    ctx.restore();

    ctx.fillStyle = '#CC9944';
    ctx.font      = `${Math.floor(H * 0.026)}px ${font}`;
    ctx.fillText('Tap to resume', W / 2, H * 0.58);
  }

  // ── GAME WIN ──────────────────────────────────────────────
  _renderGameWin(session) {
    this._renderOverlay('#000800', 0.94);
    const ctx  = this.ctx;
    const W    = this.canvas.width;
    const H    = this.canvas.height;
    const font = '"Share Tech Mono", monospace';

    for (const p of this._particles) {
      ctx.save();
      ctx.globalAlpha = p.life * 0.9;
      ctx.fillStyle   = '#FFD700';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur  = 30;
    ctx.fillStyle   = '#FFD700';
    ctx.font        = `900 ${Math.floor(W * 0.1)}px "Cinzel", serif`;
    ctx.textAlign   = 'center';
    ctx.fillText('YOU', W / 2, H * 0.22);
    ctx.fillText('WIN!', W / 2, H * 0.34);
    ctx.restore();

    ctx.fillStyle = '#AAFFDD';
    ctx.font      = `${Math.floor(H * 0.022)}px ${font}`;
    ctx.fillText('ALL 100 LEVELS COMPLETE!', W / 2, H * 0.46);

    ctx.fillStyle = '#FFD700';
    ctx.font      = `bold ${Math.floor(H * 0.028)}px ${font}`;
    ctx.fillText(`Final Score: ${session.score}`, W / 2, H * 0.57);

    ctx.fillStyle = '#886633';
    ctx.font      = `italic ${Math.floor(H * 0.022)}px "Cinzel", serif`;
    ctx.fillText('"The tombs are safe once more…"', W / 2, H * 0.7);

    const pulse = 0.5 + Math.sin(this._frame * 0.1) * 0.5;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle   = '#CCAA44';
    ctx.font        = `bold ${Math.floor(H * 0.026)}px ${font}`;
    ctx.fillText('Tap to return to menu', W / 2, H * 0.86);
    ctx.restore();
  }

  // ── Shared overlay helper ─────────────────────────────────
  _renderOverlay(color = '#000', alpha = 0.7) {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle   = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  // ── HIGH SCORES ───────────────────────────────────────────
  _renderHighScores(session) {
    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;
    const font = '"Share Tech Mono", monospace';

    ctx.fillStyle = '#050200';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#FFD700';
    ctx.font      = `900 ${Math.floor(W * 0.08)}px "Cinzel", serif`;
    ctx.textAlign = 'center';
    ctx.fillText('HALL OF FAME', W / 2, H * 0.22);

    // Score Table
    const tableY = H * 0.35;
    const rowH   = H * 0.06;
    ctx.fillStyle = '#CCAA44';
    ctx.font      = `${Math.floor(H * 0.024)}px ${font}`;

    ctx.fillText(`CURRENT BEST: ${session?.highScore || 0}`, W / 2, tableY);
    
    ctx.fillStyle = '#664422';
    ctx.font      = `${Math.floor(H * 0.018)}px ${font}`;
    ctx.fillText('Global rankings coming soon...', W / 2, tableY + rowH * 2);

    // Tap to return
    const pulse = 0.5 + Math.sin(this._frame * 0.08) * 0.5;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle   = '#886633';
    ctx.font        = `${Math.floor(H * 0.02)}px ${font}`;
    ctx.fillText('— Tap to return —', W / 2, H * 0.85);
    ctx.restore();
  }

  // ── LEVEL START ───────────────────────────────────────────
  _renderLevelStart(session) {
    // Show blurred game behind
    this._renderGame(session);
    this._renderOverlay('#000000', 0.78);

    const ctx    = this.ctx;
    const W      = this.canvas.width;
    const H      = this.canvas.height;
    const font   = '"Share Tech Mono", monospace';
    const cinzel = '"Cinzel", serif';

    this._drawHieroglyphBand(ctx, W, H * 0.34);
    this._drawHieroglyphBand(ctx, W, H * 0.64);

    // Level number
    ctx.save();
    ctx.textAlign   = 'center';
    ctx.shadowColor = '#FF8800';
    ctx.shadowBlur  = 16;
    ctx.fillStyle   = '#664400';
    ctx.font        = `${Math.floor(H * 0.02)}px ${font}`;
    ctx.fillText('— ENTERING —', W / 2, H * 0.32);
    ctx.restore();

    ctx.save();
    ctx.textAlign   = 'center';
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur  = 20;
    ctx.fillStyle   = '#FFD700';
    ctx.font        = `900 ${Math.floor(W * 0.115)}px ${cinzel}`;
    ctx.fillText(`LEVEL`, W / 2, H * 0.44);
    ctx.fillStyle   = '#FFA820';
    ctx.shadowColor = '#FF8800';
    ctx.fillText(`${session.currentLevel + 1}`, W / 2, H * 0.54);
    ctx.restore();

    const levelName = LEVELS[session.currentLevel]?.name || 'The Deep Tombs';
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#AA8833';
    ctx.font      = `italic ${Math.floor(H * 0.026)}px ${cinzel}`;
    ctx.fillText(levelName, W / 2, H * 0.66);
    ctx.restore();

    // Pulsing CTA
    const pulse = 0.45 + Math.sin(this._frame * 0.12) * 0.55;
    ctx.save();
    ctx.textAlign   = 'center';
    ctx.globalAlpha = pulse;
    ctx.shadowColor = '#88CCFF';
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = '#88CCFF';
    ctx.font        = `bold ${Math.floor(H * 0.028)}px ${cinzel}`;
    ctx.fillText('▶  TAP TO BEGIN  ◀', W / 2, H * 0.80);
    ctx.restore();
  }
}
