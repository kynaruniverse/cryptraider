// ============================================================
// CRYPT RAIDER — Game Session
// Orchestrates a single level: init, update, win/lose logic
// ============================================================

import { TILE, STATE, CONFIG, SCORE } from './constants.js';
import { Grid }        from './grid.js';
import { Physics }     from './physics.js';
import { Player }      from '../entities/player.js';
import { EnemyManager }from '../entities/enemies.js';
import { LEVELS }      from '../levels/levelData.js';
import { Storage } from './storage.js';

export class GameSession {
  constructor(eventBus, audio, input) { // ADDED input here
    this.events  = eventBus;
    this.audio   = audio;
    this.input   = input;             // STORE input here
    this.grid    = null;
    this.physics = null;
    this.player  = null;
    this.enemies = null;
    this._unsubs = [];

    // Persistent across levels
    this.lives        = CONFIG.STARTING_LIVES;
    this.score        = 0;
    this.highScore    = parseInt(Storage.get('cr_high', '0'), 10);
    this.currentLevel = 0;

    // Per-level state
    this.timeLeft     = CONFIG.LEVEL_TIME;
    this.crystalsTotal    = 0;
    this.crystalsDeposited = 0;
    this.portalOpen   = false;
    this.state        = STATE.BOOT;

    // Visual effects queue
    this.effects = []; // [{type, x, y, frame, maxFrame}]

    this._bindPersistentEvents();
  }

  // ── Start / restart a level ───────────────────────────────
  startLevel(levelIndex) {
    this._cleanupLevel();

    this.currentLevel      = Math.max(0, Math.min(levelIndex, LEVELS.length - 1));
    this.timeLeft          = CONFIG.LEVEL_TIME;
    this.crystalsDeposited  = 0;
    this.crystalsCollected  = 0;
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
  update(dt) { // REMOVED inputDir (using this.input instead)
    if (this.state !== STATE.PLAYING) return;

    // Countdown timer
    this.timeLeft -= dt / 1000;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this._onTimeUp();
      return;
    }

    // Player: Pass the InputSystem instance so it can poll only when ready
    this.player.update(dt, this.input);

    // Physics
    this.physics.update(dt);

    // Enemies
    this.enemies.update(dt, this.player.x, this.player.y);

    // Effects decay — rebuild array only when an effect has expired.
    let effectsChanged = false;
    for (const fx of this.effects) {
      fx.frame++;
      if (fx.frame >= fx.maxFrame) effectsChanged = true;
    }
    if (effectsChanged) {
      this.effects = this.effects.filter(fx => fx.frame < fx.maxFrame);
    }
  }

  // ── Input: place dynamite ─────────────────────────────────
  placeDynamite() {
    if (this.state !== STATE.PLAYING) return;
    if (!this.player.placeDynamite()) return;

    this.audio.placeBomb();

    // Dynamite position is captured at the moment of placement and stored
    // on the session — NOT written to the grid cell the player stands on.
    // This prevents moveEntity from copying the dynamite tile when player moves.
    const bombX = this.player.bombX;
    const bombY = this.player.bombY;

    // Render a visual marker at the bomb position (grid cell behind player).
    // Write to the cell the player just vacated — the cell the player was on
    // before they stepped aside is stored as bombX/bombY in player.placeDynamite().
    this.grid.set(bombX, bombY, TILE.DYNAMITE);
    this.grid.dirtyCells.add(this.grid.idx(bombX, bombY));

    const activeLevel = this.currentLevel;
    this.physics._defer(() => {
      if (this.state === STATE.PLAYING && this.currentLevel === activeLevel && this.physics) {
        // Clear the visual marker before exploding so explosion rendering is clean.
        if (this.grid.get(bombX, bombY) === TILE.DYNAMITE) {
          this.grid.set(bombX, bombY, TILE.EMPTY);
          this.grid.dirtyCells.add(this.grid.idx(bombX, bombY));
        }
        this.physics.explode(bombX, bombY, 2);
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
        // Increment collected count — deposit check happens separately at the machine.
        this.crystalsCollected = (this.crystalsCollected || 0) + 1;
      } else {
        this.audio.collect();
      }
    });

    on('player_at_machine', () => this._depositCrystal());
    
    on('portal_opened', () => {
      if (this.physics) this.physics.shake(15);
      // Keep machine cells in dirtyCells every frame so renderer repaints
      // the active machine state continuously (mirroring how animated cells work).
      this._machinesDirtyInterval = setInterval(() => {
        if (this.state !== STATE.PLAYING || !this.grid) {
          clearInterval(this._machinesDirtyInterval);
          return;
        }
        this.grid.findAll(TILE.MACHINE).forEach(({ x, y }) => {
          this.grid.dirtyCells.add(this.grid.idx(x, y));
        });
      }, 100);
    });

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

    on('player_fall_death', () => {
      if (this.state !== STATE.PLAYING) return;
      this.audio.playerDie();
      this._loseLife();
    });

    on('player_landed', () => { /* thud sound hook — extend audio later */ });

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

  _depositCrystal() {
    // Require the player to have collected all crystals before depositing opens the portal.
    const collected = this.crystalsCollected || 0;
    if (collected >= this.crystalsTotal) {
      this.crystalsDeposited = collected;
      this._openPortal();
    } else {
      this.audio.denied?.();
    }
  }


  _openPortal() {
    if (this.portalOpen) return;
    this.portalOpen = true;

    // Transform portal tiles → PORTAL_OPEN so the renderer shows active sprite.
    const portals = this.grid.findAll(TILE.PORTAL);
    portals.forEach(({ x, y }) => {
      this.grid.set(x, y, TILE.PORTAL_OPEN);
      this.grid.setMeta(x, y, { active: true, animFrame: 0 });
    });

    // Mark machines dirty so the renderer repaints them as active/charged.
    // setMeta already adds to dirtyCells; also force-add the cell index.
    const machines = this.grid.findAll(TILE.MACHINE);
    machines.forEach(({ x, y }) => {
      this.grid.setMeta(x, y, { active: true, charged: true });
      // grid.setMeta already marks dirty — but also force-add animated cell
      // index so it's redrawn every frame while portal is open.
      this.grid.dirtyCells.add(this.grid.idx(x, y));
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
  resetGlobalProgress() {
    this.lives        = CONFIG.STARTING_LIVES;
    this.score        = 0;
    this.currentLevel = 0;
    this.codeInput    = ''; // renamed: public surface kept minimal
  }
    _checkHighScore() {
      if (this.score > this.highScore) {
        this.highScore = this.score;
        Storage.set('cr_high', this.highScore);
      }
    }


  _cleanupLevel() {
    this._unsubs.forEach(fn => fn());
    this._unsubs = [];
    if (this._machinesDirtyInterval) {
      clearInterval(this._machinesDirtyInterval);
      this._machinesDirtyInterval = null;
    }

    // Null all level-scoped objects so the GC can collect them immediately.
    // physics._pending may hold deferred closures that reference the old grid —
    // clearing it here prevents stale cross-level explosions.
    if (this.physics) this.physics.destroy();
    this.grid    = null;
    this.physics = null;
    this.player  = null;
    this.enemies = null;
    this.effects = [];
  }
}
