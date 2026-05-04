// ============================================================
// CRYPT RAIDER — Frame Buffer (TIME STATE STORAGE)
// ============================================================

const MAX_FRAMES = 600; // ~10 seconds at 60fps

export class FrameBuffer {
  constructor() {
    this.frames = new Array(MAX_FRAMES);
    this.index = 0;
    this.size = 0;
  }

  push(frame) {
    this.frames[this.index] = frame;

    this.index = (this.index + 1) % MAX_FRAMES;
    this.size = Math.min(this.size + 1, MAX_FRAMES);
  }

  get(offsetBack = 0) {
    if (this.size === 0) return null;

    const idx = (this.index - 1 - offsetBack + MAX_FRAMES) % MAX_FRAMES;
    return this.frames[idx];
  }

  clear() {
    this.frames.fill(null);
    this.index = 0;
    this.size = 0;
  }
}