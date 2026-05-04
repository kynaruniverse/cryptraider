export class World {
  constructor(grid, player) {
    this.grid = grid;
    this.player = player;

    this.events = null; // optional external event bus
  }
}