import { GameState } from "../game/state.js";

export class UI {
  constructor(onStart, onLevelSelect) {
    this.onStart = onStart;
    this.onLevelSelect = onLevelSelect;

    this.state = GameState.MENU;

    this.fade = 1;
    this.targetFade = 1;

    this.levelName = "";
    this.showLevelIntro = false;

    this.bindMenu();
  }

  bindMenu() {
    const startBtn = document.getElementById("startBtn");
    const levelBtn = document.getElementById("levelBtn");

    if (startBtn) startBtn.onclick = () => this.onStart();
    if (levelBtn) levelBtn.onclick = () => this.onLevelSelect();
  }

  setState(state) {
    this.state = state;

    const menu = document.getElementById("menuScreen");
    const win = document.getElementById("winScreen");

    if (menu) menu.style.display = state === GameState.MENU ? "flex" : "none";
    if (win) win.style.display = state === GameState.WIN ? "flex" : "none";

    this.targetFade = 1;
  }

  showLevelIntro(name) {
    this.levelName = name;
    this.showLevelIntro = true;

    this.targetFade = 0;
    setTimeout(() => {
      this.showLevelIntro = false;
      this.targetFade = 1;
    }, 1500);
  }

  update() {
    // smooth fade
    this.fade += (this.targetFade - this.fade) * 0.08;
  }

  draw(ctx, canvas) {
    // global fade overlay
    ctx.fillStyle = `rgba(0,0,0,${1 - this.fade})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // level intro card
    if (this.showLevelIntro) {
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#fff";
      ctx.font = "24px sans-serif";
      ctx.textAlign = "center";

      ctx.fillText(
        this.levelName,
        canvas.width / 2,
        canvas.height / 2
      );

      ctx.font = "14px sans-serif";
      ctx.fillText(
        "Simulation Initialising...",
        canvas.width / 2,
        canvas.height / 2 + 30
      );
    }
  }
}