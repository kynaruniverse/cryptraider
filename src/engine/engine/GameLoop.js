// ============================================================
// CRYPT RAIDER — GAME LOOP (ECS DRIVER)
// ============================================================

export class GameLoop {
  constructor(world) {
    this.world = world;
    this.last = performance.now();
  }

  start() {
    requestAnimationFrame(this.tick.bind(this));
  }

  tick(now) {
    const dt = now - this.last;
    this.last = now;

    this.world.update(dt);

    requestAnimationFrame(this.tick.bind(this));
  }
}