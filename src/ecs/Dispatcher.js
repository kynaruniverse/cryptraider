// ============================================================
// CRYPT RAIDER — Command Dispatcher (EXECUTION LAYER)
// ============================================================

import { CMD } from './CommandTypes.js';
import { TILE } from '../engine/constants.js';

export class Dispatcher {
  constructor(grid, events, session, enemyManager) {
    this.grid = grid;
    this.events = events;
    this.session = session;
    this.enemyManager = enemyManager;
  }

  execute(commands) {
    for (const cmd of commands) {
      switch (cmd.type) {

        case CMD.MOVE_PLAYER: {
          const tile = this.grid.get(cmd.x, cmd.y);

          if (tile === TILE.STONE) return;

          this.session.world.player.position.x = cmd.x;
          this.session.world.player.position.y = cmd.y;

          this.events.emit('player_moved', cmd);
          break;
        }

        case CMD.ADD_SCORE: {
          this.session.addScore(cmd.amount);
          break;
        }

        case CMD.DAMAGE_PLAYER: {
          const p = this.session.world.player;
          p.energy -= cmd.amount;

          if (p.energy <= 0) {
            p.alive = false;
            this.events.emit('player_died');
          }
          break;
        }

        case CMD.DESTROY_TILE: {
          this.grid.clear(cmd.x, cmd.y);
          break;
        }

        case CMD.PLACE_DYNAMITE: {
          const p = this.session.world.player;
          p.inventory.dynamite--;
          this.grid.set(p.position.x, p.position.y, TILE.DYNAMITE);
          break;
        }

        case CMD.KILL_PLAYER: {
          this.session.world.player.alive = false;
          this.events.emit('player_died');
          break;
        }

        default:
          break;
      }
    }
  }
}