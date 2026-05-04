// ============================================================
// CRYPT RAIDER — ECS Game Loop Coordinator
// ============================================================

export class GameLoop {
  constructor(entities) {
    this.entities = entities;
  }

  update(dt) {
    for (const e of this.entities) {
      if (e.update) e.update(dt);
    }
  }
}