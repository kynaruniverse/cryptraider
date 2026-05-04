import { PLAYER_MOVE_INTERVAL_MS } from '../constants.js';

export class Simulation {
  constructor(world, systems = []) {
    this.world = world;
    this.systems = systems;
    this.accumulator = 0;
  }

  tick(dt) {
    this.accumulator += dt;

    // fixed-step simulation (prevents frame drift bugs)
    while (this.accumulator >= PLAYER_MOVE_INTERVAL_MS) {
      this.step(PLAYER_MOVE_INTERVAL_MS);
      this.accumulator -= PLAYER_MOVE_INTERVAL_MS;
    }
  }

  step(dt) {
    // STRICT ORDER = deterministic ECS pipeline

    for (const system of this.systems) {
      system.pre?.(dt, this.world);
    }

    for (const system of this.systems) {
      system.update?.(dt, this.world);
    }

    for (const system of this.systems) {
      system.post?.(dt, this.world);
    }
  }
}