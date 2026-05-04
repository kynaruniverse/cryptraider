// ============================================================
// CRYPT RAIDER — Command Queue (INTENT LAYER)
// ============================================================

export class CommandQueue {
  constructor() {
    this.queue = [];
  }

  push(cmd) {
    this.queue.push(cmd);
  }

  drain() {
    const out = this.queue;
    this.queue = [];
    return out;
  }

  clear() {
    this.queue.length = 0;
  }
}