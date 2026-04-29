// ============================================================
// CRYPT RAIDER v2 — Renderer
// Portrait-first canvas rendering, no d-pad, upgraded UI
// ============================================================

import { TILE, TILE_SIZE, COLS, ROWS, STATE, CONFIG } from '../engine/constants.js';

const T = TILE_SIZE; // 32

export class Renderer {
  constructor(canvas, sprites) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d', { alpha: false }); // Optimization: Opaque canvas
    this.sprites = sprites;
    
    // AAA Feature: Offscreen Buffer for static layers
    this.bgCanvas = document.createElement('canvas');
    this.bgCtx    = this.bgCanvas.getContext('2d', { alpha: false });
    
    this._frame  = 0;
    this._shake  = 0;
    // Dynamic offset based on screen height to prevent notch-clipping
    this._hudOffset = this.canvas.height / ROWS > 34 ? 44 : 38; 
    this._portalPulse = 0;
    this._particles   = [];
    this._initParticles();
  }

  applyShake(amount = 8) {
    this._shake = amount;
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

  // ── Master render dispatcher ──────────────────────────────
  render(gameState, session, input) {
    this.tick();
    const ctx = this.ctx;
    
    ctx.save();
    // Apply Screen Shake
    if (this._shake > 0.1) {
      const sx = (Math.random() - 0.5) * this._shake;
      const sy = (Math.random() - 0.5) * this._shake;
      ctx.translate(sx, sy);
      this._shake *= 0.85; // Quick decay
    }

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    switch (gameState) {
      case STATE.MENU:        this._renderMenu(session); break;
      case STATE.STORY:       this._renderStory(); break;
      case STATE.CODE_ENTRY:  this._renderCodeEntry(session); break;
      case STATE.PLAYING:     this._renderGame(session); break;
      case STATE.PAUSED:      this._renderPause(session); break;
      case STATE.LEVEL_WIN:   this._renderLevelWin(session); break;
      case STATE.LEVEL_FAIL:  this._renderLevelFail(session); break;
      case STATE.GAME_OVER:   this._renderGameOver(session); break;
      case STATE.GAME_WIN:    this._renderGameWin(session); break;
      default: break;
    }

    if (session?.grid) session.grid.clearDirty();
    ctx.restore();
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
    const coord = this.sprites.coords[key];
    if (!coord) return;
    this.ctx.drawImage(
      this.sprites.atlas,
      coord.x, coord.y, this.sprites.S, this.sprites.S,
      x * T, (y * T) + offsetY, size, size
    );
  }
  
    // AAA Feature: Smoothed entity drawing for falling/moving objects
  _renderMovingEntities(session) {
    const grid = session.grid;
    for (let i = 0; i < grid.cells.length; i++) {
      const meta = grid.meta[i];
      if (meta?.falling && meta.fallAnim !== undefined) {
        const x = i % grid.cols;
        const y = Math.floor(i / grid.cols);
        // Smoothed quadratic easing for the fall
        const ease = meta.fallAnim * meta.fallAnim; 
        const visualOffset = (1 - ease) * -T + this._hudOffset;
        
        const type = grid.cells[i];
        const sprite = type === TILE.GEM ? 'gem' : (type === TILE.CRYSTAL ? 'crystal' : 'boulder');
        this.drawFromAtlas(sprite, x, y, T, visualOffset);
      }
    }
  }

  _renderGrid(grid, session) {
    const portalOpen = session?.portalOpen ?? false;
    const isFullRedraw = grid.fullClearRequested || this._frame === 1;
    const targetCtx = this.ctx;

    // Optimization: Only iterate over cells that actually changed
    const cellsToDraw = isFullRedraw 
      ? Array.from({length: grid.cols * grid.rows}, (_, i) => i) 
      : grid.dirtyCells;

    cellsToDraw.forEach(idx => {
      const x = idx % grid.cols;
      const y = Math.floor(idx / grid.cols);
      const tile = grid.cells[idx];
      const meta = grid.meta[idx];
      const px = x * T, py = y * T;

      // 1. Draw base "floor"
      this.drawFromAtlas('empty', x, y, T, this._hudOffset);


      // 2. Draw Entity
      switch (tile) {
        case TILE.DIRT:    this.drawFromAtlas('dirt', x, y, T, this._hudOffset); break;
        case TILE.STONE:   this.drawFromAtlas('stone', x, y, T, this._hudOffset); break;
        case TILE.GRAVEL:  this.drawFromAtlas('gravel', x, y, T, this._hudOffset); break;
        case TILE.SAND:    this.drawFromAtlas('sand', x, y, T, this._hudOffset); break;
        case TILE.LADDER:  this.drawFromAtlas('ladder', x, y, T, this._hudOffset); break;
        case TILE.BOULDER: this.drawFromAtlas('boulder', x, y, T, this._hudOffset); break;
        case TILE.DYNAMITE:this.drawFromAtlas('dynamite', x, y, T, this._hudOffset); break;
        case TILE.KEY:     this.drawFromAtlas('key', x, y, T, this._hudOffset); break;
        case TILE.DOOR:    
          if (!meta?.open) {
            this.drawFromAtlas('door_closed', x, y, T, this._hudOffset);
          } else {
            // Draw an open passage or floor if the door was just opened
            this.drawFromAtlas('empty', x, y, T, this._hudOffset);
            this.drawFromAtlas('door_open', x, y, T, this._hudOffset);
          }
          break;
        
        case TILE.GEM:
        case TILE.CRYSTAL: {
          const isGem = tile === TILE.GEM;
          const bob = Math.sin(this._frame * 0.1 + x + y) * 2;
          this.drawFromAtlas(isGem ? 'gem' : 'crystal', x, y, T, bob + this._hudOffset);
          break;
        }

        case TILE.PLAYER: 
          break;

        case TILE.ENEMY_M:
          this.drawFromAtlas('mummy', x, y, T, (this._frame % 10 < 5 ? -1 : 1) + this._hudOffset);
          break;

        case TILE.ENEMY_F:
          this.drawFromAtlas('fly', x, y, T, (this._frame % 8 < 4 ? -2 : 0) + this._hudOffset);
          break;

        case TILE.PORTAL: {
          const isActive = session?.portalOpen;
          const pulse    = Math.sin(this._portalPulse) * 2;
          this.drawFromAtlas(isActive ? 'portal_active' : 'portal_inactive', x, y, T, (isActive ? pulse : 0) + this._hudOffset);
          break;
        }

        case TILE.MACHINE: {
          const isOn = session?.portalOpen;
          this.drawFromAtlas(isOn ? 'machine_active' : 'machine_inactive', x, y, T, this._hudOffset);
          break;
        }

        default: break;
      }

    });

    // Removed grid.clearDirty() from here to prevent premature clearing
  }


  renderPlayer(session) {
    if (!session.player?.alive) return;
    const { x, y, dir } = session.player;
    const dirKey = dir?.name?.toLowerCase() || 'down';
    this.drawFromAtlas(`player_${dirKey}`, x, y, T, this._hudOffset);
  }

  // ── Effects ───────────────────────────────────────────────
  _renderEffects(effects) {
    for (const fx of effects) {
      if (fx.type === 'explosion') {
        const frame = Math.min(fx.frame, 7);
        const r = fx.radius * T;
        const coord = this.sprites.coords[`explosion_${frame}`];
        if (coord) {
          this.ctx.drawImage(
            this.sprites.atlas,
            coord.x, coord.y, this.sprites.S, this.sprites.S,
            fx.x * T - r/2, fx.y * T - r/2, r * 2, r * 2
          );
        }
      }
    }
  }


  // ── HUD (portrait) ────────────────────────────────────────
  _renderHUD(session) {
    const ctx = this.ctx;
    const W   = this.canvas.width;

    // Gradient HUD bar
    const grad = ctx.createLinearGradient(0, 0, 0, 38);
    grad.addColorStop(0, 'rgba(5,2,0,0.95)');
    grad.addColorStop(1, 'rgba(5,2,0,0.0)');
    ctx.fillStyle = grad;
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
    const remaining = session.grid ? session.grid.count(TILE.CRYSTAL) : 0;
    ctx.fillStyle = '#55CCFF';
    ctx.font      = `12px ${font}`;
    ctx.textAlign = 'right';
    ctx.fillText(`◆ ${remaining}`, W - 56, 22);

    // ── Timer ──
    const t   = Math.ceil(session.timeLeft);
    const col = t > 30 ? '#88FFFF' : '#FF4444';
    ctx.fillStyle = col;
    ctx.font      = `bold 13px ${font}`;
    ctx.fillText(`${t}s`, W - 8, 22);

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

    // ── Portal open indicator ──
    if (session.portalOpen) {
      const pulse = 0.7 + Math.sin(this._frame * 0.2) * 0.3;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle   = '#00FFCC';
      ctx.font        = `bold 10px ${font}`;
      ctx.textAlign   = 'center';
      ctx.fillText('▶ PORTAL OPEN ◀', W / 2, 50);
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

    // Radial glow behind title
    const glow = ctx.createRadialGradient(W/2, H*0.22, 0, W/2, H*0.22, W*0.7);
    glow.addColorStop(0,   'rgba(180,80,0,0.25)');
    glow.addColorStop(0.5, 'rgba(100,30,0,0.1)');
    glow.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
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
    this._renderOverlay('#001200', 0.88);
    const ctx  = this.ctx;
    const W    = this.canvas.width;
    const H    = this.canvas.height;
    const font = '"Share Tech Mono", monospace';

    ctx.save();
    ctx.shadowColor = '#00FF88';
    ctx.shadowBlur  = 20;
    ctx.fillStyle   = '#00FF88';
    ctx.font        = `900 ${Math.floor(W * 0.09)}px "Cinzel", serif`;
    ctx.textAlign   = 'center';
    ctx.fillText('LEVEL', W / 2, H * 0.28);
    ctx.fillText('CLEAR!', W / 2, H * 0.38);
    ctx.restore();

    // Stats panel
    const panW = Math.floor(W * 0.76);
    const panX = (W - panW) / 2;
    const panY = H * 0.44;
    const panH = Math.floor(H * 0.22);
    ctx.fillStyle = 'rgba(0,40,20,0.8)';
    ctx.beginPath(); ctx.roundRect(panX, panY, panW, panH, 8); ctx.fill();
    ctx.strokeStyle = '#00AA55'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(panX, panY, panW, panH, 8); ctx.stroke();

    ctx.fillStyle = '#FFD700';
    ctx.font      = `${Math.floor(H * 0.026)}px ${font}`;
    ctx.fillText(`Score: ${session.score}`, W / 2, panY + panH * 0.35);
    ctx.fillStyle = '#88FFCC';
    ctx.fillText(`Lives: ${session.lives}`, W / 2, panY + panH * 0.65);

    // Level code
    if (session.currentLevel + 1 < 100) {
      const { generateCode } = window._CR_levelCodes || {};
      if (generateCode) {
        const code = generateCode(session.currentLevel + 1);
        ctx.fillStyle = '#AA88FF';
        ctx.font      = `${Math.floor(H * 0.02)}px ${font}`;
        ctx.fillText(`Next code: ${code}`, W / 2, H * 0.73);
      }
    }

    const pulse = 0.5 + Math.sin(this._frame * 0.1) * 0.5;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle   = '#88FFCC';
    ctx.font        = `bold ${Math.floor(H * 0.028)}px ${font}`;
    ctx.fillText('Tap to continue →', W / 2, H * 0.85);
    ctx.restore();
  }

  // ── LEVEL FAIL ────────────────────────────────────────────
  _renderLevelFail(session) {
    this._renderOverlay('#200000', 0.88);
    const ctx  = this.ctx;
    const W    = this.canvas.width;
    const H    = this.canvas.height;
    const font = '"Share Tech Mono", monospace';

    ctx.save();
    ctx.shadowColor = '#FF2200';
    ctx.shadowBlur  = 22;
    ctx.fillStyle   = '#FF4444';
    ctx.font        = `900 ${Math.floor(W * 0.12)}px "Cinzel", serif`;
    ctx.textAlign   = 'center';
    ctx.fillText('YOU', W / 2, H * 0.28);
    ctx.fillText('DIED', W / 2, H * 0.4);
    ctx.restore();

    ctx.fillStyle = '#FFD700';
    ctx.font      = `${Math.floor(H * 0.026)}px ${font}`;
    ctx.fillText(`Lives remaining: ${session.lives}`, W / 2, H * 0.56);

    const pulse = 0.5 + Math.sin(this._frame * 0.1) * 0.5;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle   = '#FF8888';
    ctx.font        = `bold ${Math.floor(H * 0.028)}px ${font}`;
    ctx.fillText('Tap to retry', W / 2, H * 0.78);
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
}
