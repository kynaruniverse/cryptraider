export class AudioSystem {
  constructor() {
    this.sounds = {};

    this.load("footstep", "assets/audio/footstep.mp3");
    this.load("push", "assets/audio/push.mp3");
    this.load("switch", "assets/audio/switch.mp3");

    this.ambience = new Audio("assets/audio/ambience.mp3");
    this.ambience.loop = true;
    this.ambience.volume = 0.4;
  }

  load(name, src) {
    const audio = new Audio(src);
    audio.preload = "auto";
    this.sounds[name] = audio;
  }

  play(name, volume = 1) {
    const sound = this.sounds[name];
    if (!sound) return;

    const clone = sound.cloneNode();
    clone.volume = volume;
    clone.play();
  }

  startAmbience() {
    if (!this.ambiencePlaying) {
      this.ambience.play().catch(() => {});
      this.ambiencePlaying = true;
    }
  }

  setAmbienceIntensity(intensity) {
    this.ambience.volume = 0.2 + intensity * 0.3;
  }
}