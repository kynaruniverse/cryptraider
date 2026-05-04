export class World {
  constructor(grid, puzzleData = {}) {
    this.originalGrid = grid;
    this.grid = this.clone(grid);

    // stores switch states
    this.switchStates = {};

    // door mapping system
    this.doorMap = puzzleData.doorMap || {};
  }

  clone(grid) {
    return grid.map(row => [...row]);
  }

  load(grid, puzzleData = {}) {
    this.originalGrid = grid;
    this.grid = this.clone(grid);
    this.doorMap = puzzleData.doorMap || {};
    this.switchStates = {};
  }

  reset() {
    this.grid = this.clone(this.originalGrid);
    this.switchStates = {};
  }

  get(x, y) {
    if (!this.grid[y]) return 1;
    return this.grid[y][x] ?? 1;
  }

  set(x, y, value) {
    if (!this.grid[y]) return;
    this.grid[y][x] = value;
  }

  toggleSwitch(id, state) {
    this.switchStates[id] = state;
    this.updateDoors();
  }

  updateDoors() {
    for (const switchId in this.doorMap) {
      const isActive = this.switchStates[switchId];

      const doors = this.doorMap[switchId];

      for (const d of doors) {
        const { x, y } = d;

        if (isActive) {
          this.grid[y][x] = 8; // OPEN
        } else {
          this.grid[y][x] = 7; // CLOSED
        }
      }
    }
  }
}