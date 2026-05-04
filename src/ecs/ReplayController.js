// ============================================================
// CRYPT RAIDER — Replay Controller
// ============================================================

export class ReplayController {
  constructor(frameBuffer) {
    this.buffer = frameBuffer;
    this.playing = false;
    this.index = 0;
  }

  start() {
    this.playing = true;
    this.index = 0;
  }

  stop() {
    this.playing = false;
  }

  step() {
    if (!this.playing) return null;

    const frame = this.buffer.get(this.index);
    this.index++;

    if (!frame) {
      this.stop();
      return null;
    }

    return frame;
  }

  jumpTo(offset) {
    return this.buffer.get(offset);
  }
}