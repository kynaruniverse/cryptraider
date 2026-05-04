import { STATE, CONFIG, TILE } from './constants.js';
import { Grid } from './grid.js';
import { LEVELS } from '../levels/levelData.js';

import { ECSWorld } from '../ecs/core/ECSWorld.js';

import { MovementSystem } from '../systems/MovementSystem.js';
import { InputSystem } from '../systems/InputSystem.js';
import { PhysicsSystem } from '../systems/PhysicsSystem.js';

export class GameSession {
  constructor(events, audio) {
    this.events = events;
    this.audio = audio;

    this.world = null;
    this.systems = [];

    this.currentLevel = 0;
    this.state = STATE.BOOT;
  }

  startLevel(i) {
    this.currentLevel = Math.max(0, Math.min(i, LEVELS.length - 1));

    const grid = new Grid();
    grid.loadArray(LEVELS[this.currentLevel]);

    const world = new ECSWorld();

    this.systems = [
      new InputSystem(this.events),
      new MovementSystem(),
      new PhysicsSystem()
    ];

    const player = world.createEntity();

    const start = grid.findFirst(TILE.PLAYER);

    world.addEntity(player, ['position', 'input', 'physics'], {
      position: start || { x: 1, y: 1 },
      input: {},
      physics: {}
    });

    // enemies
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        const t = grid.get(x, y);

        if (t === TILE.ENEMY_M || t === TILE.ENEMY_F) {
          const id = world.createEntity();

          world.addEntity(id, ['position', 'enemy'], {
            position: { x, y },
            enemy: { type: t }
          });
        }
      }
    }

    this.world = world;
    this.grid = grid;

    this.state = STATE.PLAYING;
    this.audio?.startBGM?.();

    this.events.emit('level_started', { level: this.currentLevel });
  }

  update(dt) {
    if (!this.world) return;

    for (const sys of this.systems) {
      sys.update(this.world, dt);
    }
  }

  nextLevel() {
    this.startLevel(this.currentLevel + 1);
  }

  retryLevel() {
    this.startLevel(this.currentLevel);
  }
}