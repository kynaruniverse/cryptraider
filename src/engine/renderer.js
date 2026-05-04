import { TILE_SIZE } from "./constants.js";

export class Renderer {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
  }

  clear() {
    this.ctx.fillStyle = "#05060a";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawTile(x, y, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(
      x * TILE_SIZE,
      y * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE
    );
  }
}