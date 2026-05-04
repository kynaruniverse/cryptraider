// ============================================================
// CRYPT RAIDER — Main Entry (Controller-Driven Architecture)
// Single responsibility: boot, loop, render
// ============================================================

import { loadAllSprites } from './assets/sprites.js';
import { EventBus }       from './engine/eventBus.js';
import { GameSession }    from './engine/gameSession.js';
import { GameController } from './engine/GameController.js';
import { Renderer }       from './ui/renderer.js';
import { InputSystem }    from './systems/input.js';
import { AudioSystem }    from './systems/audio.js';
import { TILE_SIZE, COLS, ROWS, HUD_OFFSET } from './engine/constants.js';

// ── Canvas ────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');

function resizeCanvas(renderer) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const logicalW = TILE_SIZE * COLS;
  const logicalH = (TILE_SIZE * ROWS) + HUD_OFFSET;

  const scale = Math.min(vw / logicalW, vh / logicalH);

  canvas.width  = logicalW;
  canvas.height = logicalH;

  canvas.style.width  = `${Math.floor(logicalW * scale)}px`;
  canvas.style.height = `${Math.floor(logicalH * scale)}px`;
  canvas.style.left   = `${Math.floor((vw - canvas.width * scale) / 2)}px`;
  canvas.style.top    = `${Math.floor((vh - canvas.height * scale) / 2)}px`;
  canvas.style.position = 'absolute';

  renderer?.updateLayout?.();
}

window.addEventListener('resize', () => resizeCanvas(renderer));

if (screen?.orientation?.lock) {
  screen.orientation.lock('portrait').catch(() => {});
}

// ── Boot ──────────────────────────────────────────────────
let renderer, controller, lastTime = 0;

async function boot() {
  const events  = new EventBus();
  const audio   = new AudioSystem();
  const input   = new InputSystem(canvas);
  const sprites = await loadAllSprites();

  renderer = new Renderer(canvas, sprites);

  const session = new GameSession(events, audio, input);
  session.codeInput = '';

  controller = new GameController({
    session,
    audio,
    input,
    events
  });

  resizeCanvas(renderer);

  canvas.addEventListener('pointerdown', () => audio.startBGM(), { once: true });

  requestAnimationFrame(loop);
}

// ── Loop ──────────────────────────────────────────────────
function loop(ts) {
  const dt = Math.min(ts - lastTime, 50);
  lastTime = ts;

  controller.update(dt);

  renderer.render(
    controller.getState(),
    controller.session,
    controller.input
  );

  requestAnimationFrame(loop);
}

// ── Start ─────────────────────────────────────────────────
boot();