// ============================================================
// CRYPT RAIDER — GameController (Single Source of Truth State Machine)
// Handles UI state, level flow, input interpretation, and session orchestration
// ============================================================

import { STATE } from './constants.js';
import { validateCode } from '../systems/levelCodes.js';

export class GameController {
  constructor({ session, audio, input, events }) {
    this.session = session;
    this.audio   = audio;
    this.input   = input;
    this.events  = events;
    this._dtAccumulator = 0;

    this.uiState = STATE.MENU;

    this._hintShown = false;

    this._bindEvents();
  }

  // ─────────────────────────────────────────────
  // Public Update (called from main loop)
  // ─────────────────────────────────────────────
  update(dt) {
    dt = Math.min(dt, 50);
    this._dtAccumulator += dt;
  
    // 1. Handle input first (single source of truth)
    const action = this.input.pollAction();
    if (action) this._handleAction(action);
  
    // 2. Enforce controller authority over state
    if (this.session.state !== this.uiState) {
      this.session.state = this.uiState;
    }
  
    // 3. Fixed-step simulation (important for physics consistency)
    const FIXED_STEP = 16; // ~60fps simulation tick
  
    while (this._dtAccumulator >= FIXED_STEP) {
      this._dtAccumulator -= FIXED_STEP;
  
      if (this.uiState === STATE.PLAYING) {
        this.session.update(FIXED_STEP);
      }
    }
  }

  // ─────────────────────────────────────────────
  // Input Handling
  // ─────────────────────────────────────────────
  _handleAction(action) {
    if (!action) return;

    if (action === 'bomb' && this.uiState === STATE.PLAYING) {
      this.session.placeDynamite();
      return;
    }

    if (action === 'pause') {
      this.uiState =
        this.uiState === STATE.PLAYING ? STATE.PAUSED :
        this.uiState === STATE.PAUSED  ? STATE.PLAYING :
        this.uiState;

      return;
    }

    if (action === 'confirm') {
      this._handleConfirm();
    }
  }

  // ─────────────────────────────────────────────
  // UI State Machine
  // ─────────────────────────────────────────────
  _handleConfirm() {
    this.audio?.unlock?.();

    switch (this.uiState) {

      case STATE.MENU: {
        const tap = this.input.getLastTapPosition();

        if (!tap) {
          this._startNewGame();
          break;
        }

        const y = tap.y;

        if (y > 0.65) {
          this.uiState = STATE.HIGH_SCORES;
        }
        else if (y > 0.55) {
          this.uiState = STATE.CODE_ENTRY;
        }
        else if (y > 0.40) {
          this._startNewGame();
        }

        break;
      }

      case STATE.STORY:
        this.uiState = STATE.LEVEL_START;
        break;

      case STATE.LEVEL_START:
        this.uiState = STATE.PLAYING;
        break;

      case STATE.LEVEL_WIN:
        this.session.nextLevel();
        this.uiState = STATE.LEVEL_START;
        break;

      case STATE.LEVEL_FAIL:
        this.session.retryLevel();
        this.uiState = STATE.LEVEL_START;
        break;

      case STATE.GAME_OVER:
      case STATE.GAME_WIN:
        this.session.resetGlobalProgress();
        this._setState(STATE.MENU);
        break;

      case STATE.HIGH_SCORES:
        this.uiState = STATE.MENU;
        break;

      case STATE.CODE_ENTRY: {
        const code = this.session.codeInput || '';

        if (code.length === 6) {
          const result = validateCode(code);

          if (result !== null) {
            this.audio?.codeSuccess?.();
            this.session.jumpToLevel(result.index);
          } else {
            this.audio?.codeFail?.();
            this.session.codeInput = '';
          }
        } else {
          this.uiState = STATE.MENU;
        }

        break;
      }

      case STATE.PAUSED:
        this.uiState = STATE.PLAYING;
        break;
      default:
        break;
    }
  }

  // ─────────────────────────────────────────────
  // Game Flow
  // ─────────────────────────────────────────────
  _startNewGame() {
    this.session.lives = 3;
    this.session.score = 0;
    this.session.startLevel(0);

    this.uiState = STATE.STORY;

    if (!this._hintShown) {
      this._hintShown = true;
      this.events.emit('show_swipe_hint');
    }
  }

  // ─────────────────────────────────────────────
  // Event Bindings
  // ─────────────────────────────────────────────
  _bindEvents() {
    this.events.on('level_won',   () => this._setState(STATE.LEVEL_WIN));
    this.events.on('level_failed',() => this._setState(STATE.LEVEL_FAIL));
    this.events.on('game_over',   () => this._setState(STATE.GAME_OVER));
    this.events.on('game_won',    () => this._setState(STATE.GAME_WIN));

    this.events.on('undo_performed', () => {
      // visual feedback handled by renderer via events (decoupled)
    });

    this.events.on('collect', () => this.audio?.collect?.());
  }

  _setState(state) {
    if (this.uiState === state) return;
    this.uiState = state;
    this.session.state = state;
  }

  // ─────────────────────────────────────────────
  // External access
  // ─────────────────────────────────────────────
  getState() {
    return this.uiState;
  }
  getSession() {
    return this.session;
  }
}