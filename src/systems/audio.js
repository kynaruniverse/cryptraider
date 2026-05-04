// ============================================================
// CRYPT RAIDER — Audio System (ECS EVENT-DRIVEN)
// ============================================================

export class AudioSystem {
  constructor(eventBus) {
    this.events = eventBus;

    this._ctx = null;
    this._enabled = true;
    this._master = null;

    this._bgGain = null;
    this._bgActive = false;
    this._bgNoteIdx = 0;
    this._bgTimer = null;

    this._noiseBuffer = null;
    this._noiseCtxRef = null;

    this._bindEvents();
  }

  // ============================================================
  // ECS EVENT BINDING
  // ============================================================

  _bindEvents() {
    const e = this.events;

    e.on?.('audio:dig', () => this.dig());
    e.on?.('audio:collect', () => this.collect());
    e.on?.('audio:crystal', () => this.collectCrystal());
    e.on?.('audio:boulder', () => this.boulder());
    e.on?.('audio:explosion', () => this.explosion());
    e.on?.('audio:player_hit', () => this.playerHit());
    e.on?.('audio:player_die', () => this.playerDie());
    e.on?.('audio:enemy_die', () => this.enemyDie());
    e.on?.('audio:portal_open', () => this.portalOpen());
    e.on?.('audio:level_complete', () => this.levelComplete());
    e.on?.('audio:place_bomb', () => this.placeBomb());
    e.on?.('audio:menu_select', () => this.menuSelect());
    e.on?.('audio:menu_move', () => this.menuMove());
  }

  // ============================================================
  // AUDIO CORE
  // ============================================================

  _getCtx() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._master = this._ctx.createGain();
      this._master.gain.value = 0.6;
      this._master.connect(this._ctx.destination);
    }
    return this._ctx;
  }

  setEnabled(v) {
    this._enabled = v;
  }

  unlock() {
    const ctx = this._getCtx();
    if (ctx.state === 'suspended') ctx.resume();
  }

  // ============================================================
  // CORE SOUND HELPERS
  // ============================================================

  _tone(freq, type = 'square', duration = 0.1, vol = 0.3, delay = 0) {
    if (!this._enabled) return;

    const ctx = this._getCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

    gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + delay + duration
    );

    osc.connect(gain);
    gain.connect(this._master);

    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  }

  // noise system unchanged (already optimized)
  _noise(duration = 0.15, vol = 0.2) {
    if (!this._enabled) return;

    const ctx = this._getCtx();
    if (ctx.state === 'suspended') ctx.resume();

    if (!this._noiseBuffer || this._noiseCtxRef !== ctx) {
      const size = Math.ceil(ctx.sampleRate * 0.5);
      const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
      this._noiseBuffer = buffer;
      this._noiseCtxRef = ctx;
    }

    const src = ctx.createBufferSource();
    const gain = ctx.createGain();

    src.buffer = this._noiseBuffer;
    src.loop = true;

    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + duration
    );

    src.connect(gain);
    gain.connect(this._master);

    src.start();
    src.stop(ctx.currentTime + duration);
  }

  // ============================================================
  // GAME SOUND EFFECTS (PURE SIGNAL RESPONSES)
  // ============================================================

  dig() {
    this._noise(0.08, 0.15);
    this._tone(180, 'triangle', 0.06, 0.1);
  }

  collect() {
    this._tone(660, 'sine', 0.08, 0.25);
    this._tone(880, 'sine', 0.08, 0.2, 0.08);
    this._tone(1100, 'sine', 0.1, 0.18, 0.16);
  }

  collectCrystal() {
    [0, 0.06, 0.12, 0.18].forEach((d, i) => {
      this._tone(440 + i * 220, 'sine', 0.12, 0.3 - i * 0.05, d);
    });
  }

  boulder() {
    this._noise(0.2, 0.3);
    this._tone(80, 'sawtooth', 0.18, 0.2);
  }

  explosion() {
    this._tone(45, 'sine', 0.6, 0.5);
    this._noise(0.5, 0.4);
    this._tone(60, 'sawtooth', 0.4, 0.3, 0.02);
  }

  playerHit() {
    this._tone(200, 'sawtooth', 0.15, 0.4);
  }

  playerDie() {
    [0, 0.1, 0.2, 0.3, 0.4].forEach((d, i) => {
      this._tone(300 - i * 50, 'sawtooth', 0.12, 0.4, d);
    });
  }

  enemyDie() {
    this._tone(300, 'square', 0.05, 0.3);
    this._noise(0.1, 0.2);
  }

  portalOpen() {
    [0, 0.1, 0.2, 0.3].forEach((d, i) => {
      this._tone(220 + i * 110, 'sine', 0.2, 0.3, d);
    });
  }

  levelComplete() {
    const melody = [523, 659, 784, 1047];
    melody.forEach((f, i) =>
      this._tone(f, 'sine', 0.25, 0.4, i * 0.18)
    );
  }

  menuSelect() { this._tone(440, 'sine', 0.06, 0.2); }
  menuMove()   { this._tone(330, 'sine', 0.04, 0.15); }
  placeBomb()  { this._tone(200, 'square', 0.08, 0.2); }
}