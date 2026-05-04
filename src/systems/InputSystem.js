import { InputComponent } from '../components/InputComponent.js';

export class InputSystem {
  constructor(eventBus) {
    this.events = eventBus;

    this.dir = null;

    this.events.on?.('input_dir', d => {
      this.dir = d;
    });
  }

  update(world) {
    const players = world.query(['position', 'input']);

    for (const e of players) {
      const input = e.data.input[e.index];
      input.dir = this.dir;
    }

    this.dir = null;
  }
}