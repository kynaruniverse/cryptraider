export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;

    this.renderX = x;
    this.renderY = y;

    this.moving = false;
    this.moveSpeed = 0.15;
  }

  update() {
    this.renderX += (this.x - this.renderX) * this.moveSpeed;
    this.renderY += (this.y - this.renderY) * this.moveSpeed;
  }

  move(dx, dy, world, onWin) {
    if (this.moving) return;

    const targetX = this.x + dx;
    const targetY = this.y + dy;

    const targetTile = world.get(targetX, targetY);

    // WALL
    if (targetTile === 1) return;

    // BOX PUSH
    if (targetTile === 3) {
      const nextX = targetX + dx;
      const nextY = targetY + dy;

      const nextTile = world.get(nextX, nextY);

      if (nextTile !== 0) return;

      world.set(nextX, nextY, 3);
      world.set(targetX, targetY, 0);

      // 🔊 BOX PUSH SOUND
      window.GameAudio?.play("push", 0.9);
    }

    // EXIT
    if (targetTile === 4) {
      if (onWin) onWin();
    }

    // SWITCH
    if (targetTile === 6) {
      world.toggleSwitch(`${targetX},${targetY}`, true);

      // 🔊 SWITCH SOUND
      window.GameAudio?.play("switch", 0.7);
    }

    this.x = targetX;
    this.y = targetY;

    this.moving = true;

    setTimeout(() => {
      this.moving = false;
    }, 120);
  }
}