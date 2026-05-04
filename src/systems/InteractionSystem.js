// ============================================================
// CRYPT RAIDER — Interaction System
// ============================================================

import { TILE } from '../engine/constants.js';

export class InteractionSystem {
  constructor() {
    this.enabled = true;
  }

  update(dt, { player, input, grid, physics, events, audio }) {
    const action = input.pollAction();

    if (!action) return;

    if (action === 'bomb') {
      if (player.inventory.dynamite <= 0) return;

      player.inventory.dynamite--;

      const { x, y } = player.position;

      player.bomb.x = x;
      player.bomb.y = y;

      grid.set(x, y, TILE.DYNAMITE);

      events.emit('dynamite_placed', { x, y });
      audio?.placeBomb?.();
    }

    if (action === 'pause') {
      events.emit('pause_toggled');
    }
  }
}