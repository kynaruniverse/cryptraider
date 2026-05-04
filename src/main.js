// ============================================================
// CRYPT RAIDER v2 — Main Entry Point
// Portrait-first, swipe-only controls
// ============================================================

import { loadAllSprites }  from './assets/sprites.js';
import { EventBus }        from './engine/eventBus.js';
import { GameSession }     from './engine/gameSession.js';
import { Renderer }        from './ui/renderer.js';
import { InputSystem }     from './systems/input.js';
import { AudioSystem }     from './systems/audio.js';
import { TILE_SIZE, COLS, ROWS, STATE, HUD_OFFSET } from './engine/constants.js';
import { generateCode, validateCode } from './systems/levelCodes.js';

// ── Application state — encapsulated to avoid module-level side effects ───
class App {
  constructor() {
    this.renderer      = null;
    this.session       = null;
    this.input         = null;
    this.audio         = null;
    this.events        = null;
    this.uiState       = STATE.MENU;
    this.lastTime      = 0;
    this._hintShown    = false;
    this._keydownHandler = null;
    this._bootComplete = false;
  }
}
const app = new App();
// Aliases kept for backward-compat with remaining module-level functions;
// new code should access via `app.*` directly.
let renderer, session, input, audio, events;
let uiState = STATE.MENU;
let _hintShown = false;
let lastTime = 0;
let _keydownHandler = null;

// ── Canvas setup — portrait fill ─────────────────────────
const canvas = document.getElementById('gameCanvas');

function resizeCanvas() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const logicalW = TILE_SIZE * COLS;
  const logicalH = (TILE_SIZE * ROWS) + HUD_OFFSET; // include HUD strip in logical height

  const scale = Math.min(vw / logicalW, vh / logicalH);

  canvas.width  = logicalW;
  canvas.height = logicalH;

  const displayW = Math.floor(logicalW * scale);
  const displayH = Math.floor(logicalH * scale);

  canvas.style.width    = `${displayW}px`;
  canvas.style.height   = `${displayH}px`;
  canvas.style.position = 'absolute';
  canvas.style.left     = `${Math.floor((vw - displayW) / 2)}px`;
  canvas.style.top      = `${Math.floor((vh - displayH) / 2)}px`;
  
  // THE FIX: Only call updateLayout if renderer actually exists
  if (renderer && typeof renderer.updateLayout === 'function') {
    renderer.updateLayout();
  }
}


window.addEventListener('resize', resizeCanvas);

if (screen?.orientation?.lock) {
  screen.orientation.lock('portrait').catch(() => {});
}

// ── Boot ──────────────────────────────────────────────────
async function boot() {
  const loadScreen = document.getElementById('loadScreen');

  // 1. Initialize Core Infrastructure
  events = new EventBus(typeof DEBUG_MODE !== 'undefined' && DEBUG_MODE);
  audio  = new AudioSystem();
  
  // 2. Load Assets
  const sprites = await loadAllSprites();
  

  // 3. Initialize Systems with Assets
  renderer = new Renderer(canvas, sprites);
  input    = new InputSystem(canvas, () => uiState);
  // Pass 'input' into the session so the player can access it
  session  = new GameSession(events, audio, input); 
  session.codeInput = '';

  // 4. Setup
  resizeCanvas();
  _bindSessionEvents();
  _bindInputToUI();

  // 5. Ready
  if (loadScreen) loadScreen.style.display = 'none';
  canvas.style.display = 'block';

  _bootComplete = true;
  requestAnimationFrame(loop);
}

// ── Game loop ─────────────────────────────────────────────
let _bootComplete = false;

function loop(ts) {
  if (!_bootComplete) { requestAnimationFrame(loop); return; }

  const dt = Math.min(ts - lastTime, 50);
  lastTime = ts;

  const action = input.pollAction();

  _handleAction(action);

  // Update logic
  if (uiState === STATE.PLAYING) {
    try {
      session.update(dt);
    } catch (err) {
      console.error('[CryptRaider] session.update threw:', err);
      uiState = STATE.MENU; // recover to menu rather than locking the thread
    }
    if (session.state !== STATE.PLAYING) {
      uiState = session.state;
    }
  }

  // Render
  renderer.render(uiState, session, input);

  requestAnimationFrame(loop);
}

// ── Action handler ────────────────────────────────────────
function _handleAction(action) {
  if (!action) return;

  if (action === 'bomb' && uiState === STATE.PLAYING) {
    session.placeDynamite();
    return;
  }

  if (action === 'pause') {
    if      (uiState === STATE.PLAYING) uiState = STATE.PAUSED;
    else if (uiState === STATE.PAUSED)  uiState = STATE.PLAYING;
    return;
  }

  if (action === 'confirm') {
    _handleConfirm();
  }
}

function _handleConfirm() {
  // Mobile audio context unlock via public API
  audio.unlock();

  switch (uiState) {
    case STATE.MENU: {
      const tap = input.getLastTapPosition();
      // If there's no tap data (like a keyboard 'Enter' press), just start the game
      if (!tap) {
        _startNewGame();
        break;
      }

      const screenY = tap.y;
      console.log("Tap Y detected at:", screenY); // Useful for debugging

      // Adjusting these ranges to be much more generous:
      if (screenY > 0.65) { 
        // HIGH SCORES (Bottom button)
        uiState = STATE.HIGH_SCORES;
      } else if (screenY > 0.55) { 
        // CODE ENTRY (Middle button)
        uiState = STATE.CODE_ENTRY;
      } else if (screenY > 0.40) { 
        // NEW GAME (Top button - covers roughly 40% to 55% of screen height)
        _startNewGame();
      }
      break;
    }


    case STATE.STORY:
      uiState = STATE.LEVEL_START;
      break;
      
    case STATE.LEVEL_START:
      uiState = STATE.PLAYING;
      if (session) session.state = STATE.PLAYING;
      console.log("State transition: PLAYING");
      break;


    case STATE.LEVEL_WIN:
      session.nextLevel();
      uiState = STATE.LEVEL_START; // Go to level intro before playing
      break;
      
    case STATE.LEVEL_FAIL:
      session.retryLevel();
      uiState = STATE.LEVEL_START;
      break;
      
    case STATE.GAME_OVER:
    case STATE.GAME_WIN:
      session.resetGlobalProgress();
      uiState = STATE.MENU;
      break;
      
    case STATE.HIGH_SCORES:
      uiState = STATE.MENU;
      break;
      
    case STATE.CODE_ENTRY: {
      const code = session.codeInput || '';
      if (code.length === 6) {
        const result = validateCode(code);
        if (result !== null) {
          audio.codeSuccess();
          session.jumpToLevel(result.index);
        } else {
          audio.codeFail();
          session.codeInput = '';
        }
      } else {
        uiState = STATE.MENU;
      }
      break;
    }
    
    case STATE.PAUSED:
      uiState = STATE.PLAYING;
      break;
      
    default: break;
  }
}

function _startNewGame() {
  session.lives = 3;
  session.score = 0;
  session.startLevel(0);
  uiState = STATE.STORY;

  if (!_hintShown) {
    _hintShown = true;
    const hint = document.getElementById('swipeHint');
    if (hint) {
      hint.style.display = 'flex';
      setTimeout(() => { hint.style.display = 'none'; }, 3200);
    }
  }
}

// ── Session event bridging ────────────────────────────────
function _bindSessionEvents() {
  events.on('level_won',    () => { uiState = STATE.LEVEL_WIN;  });
  events.on('level_failed', () => { uiState = STATE.LEVEL_FAIL; });
  events.on('game_over',    () => { uiState = STATE.GAME_OVER;  });
  events.on('game_won',     () => { uiState = STATE.GAME_WIN;   });

  // UPGRADE 1: Undo feedback
  events.on('undo_performed', () => {
    if (renderer) {
      renderer.triggerUndoFlash();
      renderer.triggerShake(3, 80);
    }
  });
  
  // Feedback sounds
  events.on('collect',      () => audio.collect());
  events.on('explosion',    ({ amount }) => { if (renderer) renderer.applyShake(amount ?? 10); });
  events.on('camera_shake', ({ amount }) => { if (renderer) renderer.applyShake(amount); });
}

function _bindInputToUI() {
  // Global keyboard listener for Code Entry and Pause — stored for future teardown
  _keydownHandler = (e) => {
    if (e.code === 'Enter') _handleConfirm();
    if (e.code === 'Escape') input.triggerAction('pause');

    // UPGRADE 1: Undo on U key
    if ((e.code === 'KeyU') && uiState === STATE.PLAYING && session) {
      e.preventDefault();
      if (session.performUndo()) {
        renderer.triggerUndoFlash();
        renderer.triggerShake(3, 80); // subtle tactile bump
      }
      return;
    }

    if (uiState === STATE.CODE_ENTRY && session) {
      const code = session.codeInput || '';
      if (e.key.match(/^[A-Za-z0-9]$/) && code.length < 6) {
        session.codeInput = (code + e.key.toUpperCase()).slice(0, 6);
        e.preventDefault();
      } else if (e.code === 'Backspace' && code.length > 0) {
        session.codeInput = code.slice(0, -1);
        e.preventDefault();
      }
    }
  };
  window.addEventListener('keydown', _keydownHandler);

  // Ensure BGM starts on user interaction
  canvas.addEventListener('pointerdown', () => {
    audio.startBGM();
  }, { once: true });
}

// ── Start ─────────────────────────────────────────────────
boot();
