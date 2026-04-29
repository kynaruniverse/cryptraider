// ============================================================
// CRYPT RAIDER — Game Session
// Orchestrates a single level: init, update, win/lose logic
// ============================================================

import { TILE, STATE, CONFIG, SCORE } from '../engine/constants.js';
import { Grid }        from '../engine/grid.js';
import { Physics }     from '../engine/physics.js';
import { Player }      from '../entities/player.js';
import { EnemyManager }from '../entities/enemies.js';
import { LEVELS }      from '../levels/levelData.js';

export class GameSession {
  constructor(eventBus, audio) {
    this.events  = eventBus;
    this.audio   = audio;
    this.grid    = null;
    this.physics = null;
    this.player  = null;
    this.enemies = null;
    this._unsubs = [];

    // Persistent across levels
    this.lives        = CONFIG.STARTING_LIVES;
    this.score        = 0;
    this.highScore    = parseInt(localStorage.getItem('cr_high') || '0', 10);
    this.currentLevel = 0;

    // Per-level state
    this.timeLeft     = CONFIG.LEVEL_TIME;
    this.crystalsTotal    = 0;
    this.crystalsDeposited = 0;
    this.portalOpen   = false;
    this.state        = STATE.MENU;

    // Visual effects queue
    this.effects = []; // [{type, x, y, frame, maxFrame}]

    this._bindPersistentEvents();
  }

  // ── Start / restart a level ───────────────────────────────
  startLevel(levelIndex) {
    this._cleanupLevel();

    this.currentLevel      = Math.max(0, Math.min(levelIndex, LEVELS.length - 1));
    this.timeLeft          = CONFIG.LEVEL_TIME;
    this.crystalsDeposited = 0;
    this.portalOpen        = false;
    this.effects           = [];

    // Build grid
    this.grid = new Grid();
    this.grid.loadArray(LEVELS[this.currentLevel]);

    // Count crystals
    this.crystalsTotal = this.grid.count(TILE.CRYSTAL);

    // Physics
    this.physics = new Physics(this.grid, this.events);

    // Player
    this.player = new Player(this.grid, this.events);

    // Enemies
    this.enemies = new EnemyManager(this.grid, this.events);
    this.enemies.spawnFromGrid();

    // Bind level events
    this._bindLevelEvents();

    this.state = STATE.PLAYING;
    this.audio.startBGM();
  }

  // ── Main update tick ──────────────────────────────────────
  update(dt, inputDir) {
    if (this.state !== STATE.PLAYING) return;

    // Countdown timer
    this.timeLeft -= dt / 1000;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this._onTimeUp();
      return;
    }

    // Player
    this.player.update(dt, inputDir);

    // Physics
    this.physics.update(dt);

    // Enemies
    this.enemies.update(dt, this.player.x, this.player.y);

    // Effects decay
    for (const fx of this.effects) fx.frame++;
    this.effects = this.effects.filter(fx => fx.frame < fx.maxFrame);
  }

  // ── Input: place dynamite ─────────────────────────────────
  placeDynamite() {
    if (this.state !== STATE.PLAYING) return;
    if (!this.player.placeDynamite()) return;

    this.audio.placeBomb();
    const { x, y } = this.player;

    // Short fuse — explode after 1.5s (Logic synced to current level)
    const activeLevel = this.currentLevel;
    setTimeout(() => {
      // Safety: Only explode if we are still playing the SAME level
      if (this.state === STATE.PLAYING && this.currentLevel === activeLevel) {
        this.physics.explode(x, y, 2);
        this.audio.explosion();
      }
    }, 1500);
  }

  // ── Level events ──────────────────────────────────────────
  _bindLevelEvents() {
    const on = (ev, fn) => {
      const unsub = this.events.on(ev, fn);
      this._unsubs.push(unsub);
    };

    on('tile_dug',      () => this.audio.dig());
    on('boulder_pushed',() => this.audio.boulder());

    on('item_collected', ({ type, points }) => {
      this.score += points;
      this._checkHighScore();
      if (type === TILE.CRYSTAL) {
        this.audio.collectCrystal();
        this._checkAllCrystals();
      } else {
        this.audio.collect();
      }
    });

    on('player_at_machine', () => this._depositCrystal());

    on('player_entered_portal', () => {
      if (this.portalOpen) this._winLevel();
    });

    on('player_hit', ({ energy }) => {
      this.audio.playerHit();
      if (energy <= 0) this._loseLife();
    });

    on('player_crushed', () => {
      if (this.state !== STATE.PLAYING) return;
      this.audio.playerDie();
      this._loseLife();
    });

    on('player_died', () => {
      if (this.state !== STATE.PLAYING) return;
      this._loseLife();
    });


    on('enemy_killed', ({ points }) => {
      this.score += points || SCORE.ENEMY;
      this.audio.enemyDie();
      this._checkHighScore();
    });

    on('enemy_crushed', ({ x, y, type }) => {
      this.enemies.killAt(x, y);
      this.score += SCORE.ENEMY;
      this._checkHighScore();
      this.audio.enemyDie();
    });

    on('enemy_touched_player', () => {
      this.player._hit();
    });

    on('explosion', ({ x, y, radius }) => {
      this.effects.push({ type: 'explosion', x, y, radius, frame: 0, maxFrame: 8 });
    });

    on('object_fell', ({ to, type }) => {
      if (type === TILE.BOULDER) this.audio.boulder();
    });
  }

  _bindPersistentEvents() {
    // nothing persistent for now — lives/score managed internally
  }

  // ── Crystal / Portal logic ────────────────────────────────
  _checkAllCrystals() {
    // All crystals collected when grid has none left + we've collected all
    const remaining = this.grid.count(TILE.CRYSTAL);
    if (remaining === 0 && this.crystalsDeposited >= this.crystalsTotal) {
      this._openPortal();
    }
  }

  _depositCrystal() {
    // Player must have just walked into machine — auto-deposit
    // In original game, crystals must be physically carried.
    // We simplify: collected crystals auto-deposit on machine touch.
    // But first check if all collected.
    const remaining = this.grid.count(TILE.CRYSTAL);
    if (remaining === 0) {
      this._openPortal();
    }
  }

  _openPortal() {
    if (this.portalOpen) return;
    this.portalOpen = true;

    // Physically transform the tiles so Physics/Renderer recognize the state change
    const portals = this.grid.findAll(TILE.PORTAL);
    portals.forEach(({ x, y }) => {
      this.grid.set(x, y, TILE.PORTAL_OPEN);
      this.grid.setMeta(x, y, { active: true, animFrame: 0 });
    });

    const machines = this.grid.findAll(TILE.MACHINE);
    machines.forEach(({ x, y }) => {
      this.grid.setMeta(x, y, { active: true, charged: true });
    });

    this.audio.portalOpen();
    this.events.emit('portal_opened', { level: this.currentLevel });
  }


  // ── Win / Lose ────────────────────────────────────────────
  _winLevel() {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.LEVEL_WIN;

    // Time bonus
    const bonus = Math.floor(this.timeLeft) * SCORE.TIME_BONUS_PER_SEC;
    this.score += bonus;
    this._checkHighScore();

    this.audio.stopBGM();
    this.audio.levelComplete();
    this.events.emit('level_won', {
      level: this.currentLevel,
      score: this.score,
      timeBonus: bonus,
      lives: this.lives,
    });
  }

  _loseLife() {
    if (this.state !== STATE.PLAYING) return;
    this.lives--;
    this.audio.stopBGM();

    if (this.lives <= 0) {
      this.state = STATE.GAME_OVER;
      this.events.emit('game_over', { score: this.score });
    } else {
      this.state = STATE.LEVEL_FAIL;
      this.events.emit('level_failed', { lives: this.lives, level: this.currentLevel });
    }
  }

  _onTimeUp() {
    this._loseLife();
  }

  // ── Navigation ────────────────────────────────────────────
  nextLevel() {
    if (this.currentLevel + 1 >= LEVELS.length) {
      this.state = STATE.GAME_WIN;
      this.events.emit('game_won', { score: this.score });
    } else {
      this.startLevel(this.currentLevel + 1);
    }
  }

  retryLevel() {
    this.startLevel(this.currentLevel);
  }

  jumpToLevel(idx) {
    this.lives = CONFIG.STARTING_LIVES;
    this.score = 0;
    this.startLevel(idx);
  }

  // ── Misc ──────────────────────────────────────────────────
  _checkHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('cr_high', String(this.highScore));
    }
  }

  _cleanupLevel() {
    this._unsubs.forEach(fn => fn());
    this._unsubs = [];
  }
}
