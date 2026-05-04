const canvas = document.getElementById("editorCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 640;
canvas.height = 640;

const TILE_SIZE = 32;
const COLS = 20;
const ROWS = 20;

let selectedTile = 1;
let playerStart = { x: 1, y: 1 };

let grid = Array.from({ length: ROWS }, () =>
  Array.from({ length: COLS }, () => 0)
);

// toolbar selection
document.querySelectorAll("button[data-tile]").forEach(btn => {
  btn.onclick = () => {
    selectedTile = parseInt(btn.dataset.tile);
  };
});

// player tool
document.getElementById("playerBtn").onclick = () => {
  selectedTile = "player";
};

// export
document.getElementById("exportBtn").onclick = () => {
  const levelData = {
    name: "New Level",
    playerStart,
    grid
  };

  const blob = new Blob([JSON.stringify(levelData, null, 2)], {
    type: "application/json"
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "level.json";
  a.click();
};

// placing tiles
canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();

  const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
  const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);

  if (selectedTile === "player") {
    playerStart = { x, y };
    return;
  }

  grid[y][x] = selectedTile;
});

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {

      let tile = grid[y][x];
      let color = "#222";

      if (tile === 1) color = "#2b2f3a";
      if (tile === 0) color = "#141822";
      if (tile === 3) color = "#c08a3a";
      if (tile === 4) color = "#3af0a0";
      if (tile === 6) color = "#7a5cff";
      if (tile === 7) color = "#3a3a4a";

      ctx.fillStyle = color;
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  // player marker
  ctx.fillStyle = "#fff";
  ctx.fillRect(
    playerStart.x * TILE_SIZE,
    playerStart.y * TILE_SIZE,
    TILE_SIZE,
    TILE_SIZE
  );

  requestAnimationFrame(draw);
}

draw();