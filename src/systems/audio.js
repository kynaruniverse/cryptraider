// ============================================================
// CRYPT RAIDER — Audio System
// Synthesised sounds via Web Audio API — zero external files
// ============================================================

export class AudioSystem {
  constructor() {
    this._ctx     = null;
    this._enabled = true;
    this._master  = null;
    this._bgNode  = null;
    this._bgGain  = null;
  }

  _getCtx() {
    if (!this._ctx) {
      this._ctx    = new (window.AudioContext || window.webkitAudioContext)();
      this._master = this._ctx.createGain();
      this._master.gain.value = 0.6;
      this._master.connect(this._ctx.destination);
    }
    return this._ctx;
  }

  setEnabled(v) { this._enabled = v; }

  // ── Generic tone helper ────────────────────────────────────
  _tone(freq, type = 'square', duration = 0.1, vol = 0.3, delay = 0) {
    if (!this._enabled) return;
    const ctx  = this._getCtx();
    
    // Android Resume Guard: If context is suspended, sounds won't play.
    if (ctx.state === 'suspended') ctx.resume();

    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type      = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(this._master);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  }

  _noise(duration = 0.15, vol = 0.2) {
    if (!this._enabled) return;
    const ctx    = this._getCtx();
    const size   = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data   = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const src  = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.connect(gain);
    gain.connect(this._master);
    src.start();
  }

  // ── Named sound effects ────────────────────────────────────
  dig() {
    this._noise(0.08, 0.15);
    this._tone(180, 'triangle', 0.06, 0.1);
  }

  collect() {
    this._tone(660,  'sine', 0.08, 0.25);
    this._tone(880,  'sine', 0.08, 0.2,  0.08);
    this._tone(1100, 'sine', 0.1,  0.18, 0.16);
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
    // Add a deep bass impact
    this._tone(45, 'sine', 0.6, 0.5); 
    this._noise(0.5, 0.4);
    this._tone(60,  'sawtooth', 0.4, 0.3, 0.02);
    // Add "debris" scatter sound
    for(let i=0; i<3; i++) {
      this._tone(Math.random()*200 + 100, 'square', 0.1, 0.1, 0.1 + Math.random()*0.2);
    }
  }

  playerHit() {
    this._tone(200, 'sawtooth', 0.15, 0.4);
    this._tone(150, 'sawtooth', 0.15, 0.3, 0.1);
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
    melody.forEach((f, i) => this._tone(f, 'sine', 0.25, 0.4, i * 0.18));
  }

  menuSelect() { this._tone(440, 'sine', 0.06, 0.2); }
  menuMove()   { this._tone(330, 'sine', 0.04, 0.15); }
  placeBomb()  { this._tone(200, 'square', 0.08, 0.2); }
  
  codeSuccess() {
    this._tone(523.25, 'sine', 0.1, 0.3);
    this._tone(659.25, 'sine', 0.15, 0.3, 0.1);
  }

  codeFail() {
    this._tone(110, 'sawtooth', 0.2, 0.3);
    this._tone(90,  'sawtooth', 0.3, 0.2, 0.1);
  }
  
  // ── Background music — simple arpeggiated loop ─────────────
  startBGM() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    if (ctx.state === 'suspended') ctx.resume();
    if (this._bgActive) return;
    const ctx = this._getCtx();
    
    this._bgActive = true;
    this._bgNoteIdx = 0;
    
    if (!this._bgGain) {
      this._bgGain = ctx.createGain();
      this._bgGain.gain.value = 0.08;
      this._bgGain.connect(this._master);
    }

    this._playBgmStep();
  }

  _playBgmStep() {
    if (!this._bgActive || !this._enabled) return;
    
    const ctx = this._getCtx();
    // Use the scheduler's next note time for rock-solid rhythm
    const now = ctx.currentTime;
    
    const notes = [110, 130.81, 146.83, 110, 123.47, 164.81, 110, 146.83]; // Adjusted to a "darker" minor key
    const BPM = 120; // Slightly slower for a more atmospheric feel
    const stepTime = 60 / BPM / 2; // Eighth notes

    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(notes[this._bgNoteIdx % notes.length], now);
    
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + stepTime * 0.9);
    
    osc.connect(gain);
    gain.connect(this._bgGain);
    
    osc.start(now);
    osc.stop(now + stepTime);
    
    this._bgNoteIdx++;
    
    // Schedule the next check in the near future
    this._bgTimer = setTimeout(() => this._playBgmStep(), stepTime * 1000);
  }


  stopBGM() {
    this._bgActive = false;
    if (this._bgTimer) {
      clearTimeout(this._bgTimer);
      this._bgTimer = null;
    }
    // We keep the bgGain connected but silent or disconnected to prevent popping
    if (this._bgGain) {
      this._bgGain.gain.setTargetAtTime(0, this._getCtx().currentTime, 0.03);
    }
  }
}
