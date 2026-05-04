export class HorrorSystem {
  constructor() {
    this.timer = 0;
    this.intensity = 0;

    this.flicker = false;
    this.flickerTimer = 0;
  }

  update(player, world) {
    this.timer++;

    // slow ambient intensity drift
    this.intensity = 0.02 + Math.sin(this.timer * 0.01) * 0.01;

    // occasional flicker event
    if (Math.random() < 0.0015) {
      this.triggerFlicker();
    }

    if (this.flickerTimer > 0) {
      this.flickerTimer--;
      this.flicker = true;
    } else {
      this.flicker = false;
    }

    // "observer effect" (very subtle gameplay reaction)
    if (Math.random() < 0.0005) {
      this.intensity += 0.05;
    }
  }

  triggerFlicker() {
    this.flickerTimer = 8; // short burst
  }
}