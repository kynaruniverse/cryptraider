// ============================================================
// CRYPT RAIDER v2 — Main Entry Point
// Portrait-first, swipe-only controls
// ============================================================

import { loadAllSprites }  from './sprites.js';
import { EventBus }        from './eventBus.js';
import { GameSession }     from './gameSession.js';
import { Renderer }        from './renderer.js';
import { InputSystem }     from './input.js';
import { AudioSystem }     from './audio.js';
import { STATE, TILE_SIZE, COLS, ROWS } from './constants.js';
import { generateCode, validateCode } from './systems/levelCodes.js';

// Expose level codes globally for renderer
window._CR_levelCodes = { generateCode, validateCode };

// ── Canvas setup — portrait fill ─────────────────────────
const canvas = document.getElementById('gameCanvas');

function resizeCanvas() {
  // Portrait: fill the viewport height, centre horizontally
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Logical canvas size (game units)
  const logicalW = TILE_SIZE * COLS;
  const logicalH = TILE_SIZE * ROWS;

  // Scale to fit viewport keeping aspect ratio, portrait priority
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
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ── Try to lock orientation to portrait (where API is available) ──
if (screen?.orientation?.lock) {
  screen.orientation.lock('portrait').catch(() => {});
}

// ── Core systems ──────────────────────────────────────────
const events  = new EventBus();
const audio   = new AudioSystem();
const input   = new InputSystem(canvas);

// ── State ─────────────────────────────────────────────────
let uiState   = STATE.MENU;
let session   = null;
let renderer  = null;
let _hintShown = false;

// ── Boot ──────────────────────────────────────────────────
async function boot() {
  const loadScreen = document.getElementById('loadScreen');

  const sprites = await loadAllSprites();
  renderer = new Renderer(canvas, sprites);

  session = new GameSession(events, audio);
  session._codeInput = '';

  _bindSessionEvents();
  _bindInputToUI();

  if (loadScreen) loadScreen.style.display = 'none';
  canvas.style.display = 'block';

  requestAnimationFrame(loop);
}

// ── Game loop ─────────────────────────────────────────────
let lastTime = 0;
function loop(ts) {
  const dt = Math.min(ts - lastTime, 50);
  lastTime = ts;

  const dir    = input.pollDir();
  const action = input.pollAction();

  _handleAction(action);

  // Update logic
  if (uiState === STATE.PLAYING) {
    session.update(dt, dir);
    if (session.state !== STATE.PLAYING) {
      uiState = session.state;
    }
  }

  // Single Render call - Handles all states internally
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
  audio.menuSelect(); // Play feedback on every confirm action
  switch (uiState) {
    case STATE.MENU: {
      // Get the relative tap position from InputSystem
      const tap = input.getLastTapPosition();
      const screenY = tap ? tap.y : 0;
      
      // Menu layout: Top = Start, Mid = High Scores, Bottom = Code Entry
      // Button layout: NEW GAME ~47%, HIGH SCORES ~54%, CODE ENTRY ~61%
      if (screenY > 0.57) {
        uiState = STATE.CODE_ENTRY;
      } else if (screenY > 0.50) {
        uiState = STATE.HIGH_SCORES;
      } else {
        _startNewGame();
      }
      break;
    }

    case STATE.STORY:
      uiState = STATE.LEVEL_START;
      break;
    case STATE.LEVEL_START:
      uiState = STATE.PLAYING;
      break;

    case STATE.LEVEL_WIN:
      session.nextLevel();
      uiState = STATE.PLAYING;
      break;
    case STATE.LEVEL_FAIL:
      session.retryLevel();
      uiState = STATE.PLAYING;
      break;
    case STATE.GAME_OVER:
    case STATE.GAME_WIN:
      uiState = STATE.MENU;
      session.resetGlobalProgress(); // We'll add this to GameSession if not there
      session._codeInput = '';
      break;
    case STATE.HIGH_SCORES:
      uiState = STATE.MENU;
      break;
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

  // Show swipe hint the first time only
  if (!_hintShown) {
    _hintShown = true;
    const hint = document.getElementById('swipeHint');
    if (hint) {
      hint.style.display = 'flex';
      // Auto-hide handled by CSS animation, but also clean up after
      setTimeout(() => { hint.style.display = 'none'; }, 3200);
    }
  }
}

// ── Session event bridging ────────────────────────────────
function _bindSessionEvents() {
  events.on('level_won',   () => { uiState = STATE.LEVEL_WIN;  });
  events.on('level_failed',() => { uiState = STATE.LEVEL_FAIL; });
  events.on('game_over',   () => { uiState = STATE.GAME_OVER;  });
  events.on('game_won',    () => { uiState = STATE.GAME_WIN;   });
}

// ── Touch / pointer input for UI screens ─────────────────
// NOTE: No d-pad here. All in-game movement is via swipe (InputSystem).
// UI screens just need a tap → confirm.
function _bindInputToUI() {
  // Unlock audio context and start BGM on first user gesture
  canvas.addEventListener('pointerdown', () => {
    const ctx = audio._getCtx();
    if (ctx.state === 'suspended') ctx.resume();
    audio.startBGM();
  }, { once: true });

  // Keyboard shortcut for menus
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Enter') input.triggerAction('confirm');
  });
}

// ── Start ─────────────────────────────────────────────────
boot();
