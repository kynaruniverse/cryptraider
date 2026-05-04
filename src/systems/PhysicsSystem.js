export class PhysicsSystem {
  update(world) {
    const entities = world.query(['position', 'physics']);

    for (const e of entities) {
      const pos = e.data.position[e.index];
      const phys = e.data.physics[e.index];

      if (phys.falling) {
        pos.y += 1;
      }
    }
  }
}