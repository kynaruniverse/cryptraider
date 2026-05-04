import { Input } from "./engine/input.js";
import { TouchInput } from "./engine/touchInput.js";
import { Renderer } from "./engine/renderer.js";
import { UI } from "./ui/ui.js";
import { GameState } from "./game/state.js";
import { Player } from "./game/player.js";
import { World } from "./game/world.js";
import { loadLevelFile } from "./game/levelLoader.js";
import { HorrorSystem } from "./game/horror.js";
import { AudioSystem } from "./engine/audio.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// -------------------------
// CORE SYSTEMS
// -------------------------
const input = new Input();
const touch = new TouchInput(canvas);
const renderer = new Renderer(canvas, ctx);
const horror = new HorrorSystem();
const audio = new AudioSystem();
audio.startAmbience();

window.GameAudio = audio;
// -------------------------
// CAMERA + JUICE SYSTEM
// -------------------------
let camera = { x: 0, y: 0 };
let shake = 0;

function addShake(amount) {
  shake = Math.min(shake + amount, 10);
}

// -------------------------
// GAME STATE
// -------------------------
let gameState = GameState.MENU;

let currentLevelIndex = 1;
let world;
let player;

// -------------------------
// UI
// -------------------------
const ui = new UI(startGame, openLevelSelect);
ui.setState(GameState.MENU);
function showLevelIntro(levelName) {
  ui.showLevelIntro(levelName);
}
// -------------------------
// LEVEL LOADING
// -------------------------
async function loadLevel(index) {
  const level = await loadLevelFile(`assets/levels/level${index}.json`);

  world = new World(level.grid, level.puzzleData);
  player = new Player(level.playerStart.x, level.playerStart.y);

  // 🎬 LEVEL INTRO CARD
  ui.showLevelIntro(level.name || `Level ${index}`);
}

// -------------------------
// START INITIAL LOAD
// -------------------------
loadLevel(currentLevelIndex);

// -------------------------
// MOBILE BUTTONS (SAFE BIND)
// -------------------------
function bindControls() {
  const controls = document.querySelectorAll("#controls button");

  controls.forEach(btn => {
    btn.addEventListener("click", () => {
      if (!player || gameState !== GameState.PLAYING) return;

      const dir = btn.dataset.dir;

      if (!player || gameState !== GameState.PLAYING) return;

      if (dir === "up") player.move(0, -1, world, nextLevel);
      if (dir === "down") player.move(0, 1, world, nextLevel);
      if (dir === "left") player.move(-1, 0, world, nextLevel);
      if (dir === "right") player.move(1, 0, world, nextLevel);

      addShake(1.2);
      audio.play("footstep", 0.6);
    });
  });
}

bindControls();

// -------------------------
// LEVEL FLOW
// -------------------------
async function nextLevel() {
  currentLevelIndex++;

  try {
    await loadLevel(currentLevelIndex);
  } catch (e) {
    winGame();
  }
}

function restartLevel() {
  loadLevel(currentLevelIndex);
}

// -------------------------
// GAME FLOW
// -------------------------
async function startGame() {
  gameState = GameState.PLAYING;
  ui.setState(GameState.PLAYING);

  currentLevelIndex = 1;
  await loadLevel(currentLevelIndex);
}

function openLevelSelect() {
  startGame();
}

function winGame() {
  gameState = GameState.WIN;

  ui.setState(GameState.WIN);

  // soft fade-in effect
  ui.targetFade = 0;
}

// -------------------------
// UPDATE LOOP
// -------------------------
function update() {
  if (gameState !== GameState.PLAYING) return;

  const swipe = touch.consumeSwipe();

  // CAMERA FOLLOW (SMOOTH)
  if (player) {
    camera.x += ((player.renderX * 32) - camera.x) * 0.08;
    camera.y += ((player.renderY * 32) - camera.y) * 0.08;
  }

  // SWIPE INPUT
  if (swipe.dx !== 0 || swipe.dy !== 0) {
    player.move(swipe.dx, swipe.dy, world, nextLevel);
    addShake(1.5);
    audio.play("footstep", 0.6);
  }

  // HORROR SYSTEM
  horror.update(player, world);
  audio.setAmbienceIntensity(horror.intensity);
  // KEY INPUT
  if (input.isDown("r")) restartLevel();

  if (input.isDown("ArrowUp")) {
    player.move(0, -1, world, nextLevel);
    addShake(1.2);
    audio.play("footstep", 0.6);
  }

  if (input.isDown("ArrowDown")) {
    player.move(0, 1, world, nextLevel);
    addShake(1.2);
    audio.play("footstep", 0.6);
  }

  if (input.isDown("ArrowLeft")) {
    player.move(-1, 0, world, nextLevel);
    addShake(1.2);
    audio.play("footstep", 0.6);
  }

if (input.isDown("ArrowRight")) {
  player.move(1, 0, world, nextLevel);
  addShake(1.2);
  audio.play("footstep", 0.6);
}

  if (player) player.update();

  // decay shake
  shake *= 0.85;
  // optional safety (prevents undefined crashes)
  if (!window.GameAudio) window.GameAudio = audio;
}

// -------------------------
// DRAW LOOP
// -------------------------
function draw() {
  renderer.clear();

  ctx.save();

  // CAMERA + SHAKE COMBINED
  const shakeX = (Math.random() - 0.5) * shake;
  const shakeY = (Math.random() - 0.5) * shake;

  ctx.translate(
    -camera.x + canvas.width / 2 - 16 + shakeX,
    -camera.y + canvas.height / 2 - 16 + shakeY
  );

  // -------------------------
  // TILE RENDER
  // -------------------------
  if (world) {
    for (let y = 0; y < world.grid.length; y++) {
      for (let x = 0; x < world.grid[y].length; x++) {

        let tile = world.grid[y][x];
        let color = "#111";

        if (Math.random() < horror.intensity * 0.01) {
          color = "#1f2a3a";
        }

        if (tile === 1) color = "#2b2f3a";
        if (tile === 0) color = "#141822";
        if (tile === 3) color = "#c08a3a";
        if (tile === 4) color = "#3af0a0";

        if (tile === 6) color = "#7a5cff";
        if (tile === 7) color = "#3a3a4a";
        if (tile === 8) color = "#2cff9a";

        renderer.drawTile(x, y, color);
      }
    }
  }

  // -------------------------
  // PLAYER RENDER
  // -------------------------
  if (player) {
    const jitter = horror.intensity * 2;

    ctx.fillStyle = "#e6e6e6";
    ctx.fillRect(
      player.renderX * 32 + jitter,
      player.renderY * 32 + jitter,
      32,
      32
    );
  }

  ctx.restore();
}

// -------------------------
// MAIN LOOP
// -------------------------
function loop() {
  update();
  ui.update();
  draw();
  ui.draw(ctx, canvas);
  requestAnimationFrame(loop);
}

loop();