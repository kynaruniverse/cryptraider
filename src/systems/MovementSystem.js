export class MovementSystem {
  update(world) {
    const entities = world.query(['position', 'input']);

    for (const e of entities) {
      const pos = e.data.position[e.index];
      const input = e.data.input[e.index];

      if (!input?.dir) continue;

      switch (input.dir) {
        case 'LEFT':  pos.x--; break;
        case 'RIGHT': pos.x++; break;
        case 'UP':    pos.y--; break;
        case 'DOWN':  pos.y++; break;
      }

      input.dir = null;
    }
  }
}