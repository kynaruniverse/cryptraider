export class TouchInput {
  constructor(canvas) {
    this.canvas = canvas;

    this.swipe = { dx: 0, dy: 0 };
    this.threshold = 30;

    this.startX = 0;
    this.startY = 0;

    this.bindEvents();
  }

  bindEvents() {
    this.canvas.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      this.startX = t.clientX;
      this.startY = t.clientY;
    });

    this.canvas.addEventListener("touchend", (e) => {
      const t = e.changedTouches[0];

      const dx = t.clientX - this.startX;
      const dy = t.clientY - this.startY;

      this.swipe = this.resolveSwipe(dx, dy);
    });
  }

  resolveSwipe(dx, dy) {
    if (Math.abs(dx) < this.threshold && Math.abs(dy) < this.threshold) {
      return { dx: 0, dy: 0 };
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? { dx: 1, dy: 0 } : { dx: -1, dy: 0 };
    } else {
      return dy > 0 ? { dx: 0, dy: 1 } : { dx: 0, dy: -1 };
    }
  }

  consumeSwipe() {
    const result = this.swipe;
    this.swipe = { dx: 0, dy: 0 };
    return result;
  }
}