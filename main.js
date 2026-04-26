const { Engine, Render, Runner, World, Bodies, Body } = Matter;

/* Canvas */
const canvas = document.getElementById("game");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

/* HUD */
const timeEl = document.getElementById("time");
const countEl = document.getElementById("count");
const scoreEl = document.getElementById("score");
const rotationEl = document.getElementById("rotation");
const statusEl = document.getElementById("status");
const currentPlayerEl = document.getElementById("currentPlayer");

const rotateLeftBtn = document.getElementById("rotateLeft");
const rotateRightBtn = document.getElementById("rotateRight");
const addBtn = document.getElementById("add");
const resetBtn = document.getElementById("reset");

/* Game state */
let players = ["Player 1", "Player 2", "Player 3"];
let currentPlayer = 0;
let spaghettiLeft = 20;
let rotation = 0;
let timeLeft = 30;
let score = 0;

/* Engine */
const engine = Engine.create();
engine.world.gravity.y = 1;

const render = Render.create({
  canvas,
  engine,
  options: {
    width: canvas.width,
    height: canvas.height,
    wireframes: false,
    background: "#f4f4f4"
  }
});

Runner.run(Runner.create(), engine);
Render.run(render);

/* Ground */
const ground = Bodies.rectangle(
  canvas.width / 2,
  canvas.height - 40,
  canvas.width,
  80,
  { isStatic: true }
);

World.add(engine.world, ground);

/* Helpers */
function updateHUD() {
  timeEl.innerText = `00:${String(timeLeft).padStart(2, "0")}`;
  countEl.innerText = spaghettiLeft;
  scoreEl.innerText = score;
  rotationEl.innerText = `${Math.round(rotation * 180 / Math.PI) % 360}°`;
  currentPlayerEl.innerText = players[currentPlayer];
}

function placeSpaghetti(x, y) {
  if (spaghettiLeft <= 0) return;

  const stick = Bodies.rectangle(x, y, 140, 6);
  Body.setAngle(stick, rotation);
  World.add(engine.world, stick);

  spaghettiLeft--;
  score += 10;

  currentPlayer = (currentPlayer + 1) % players.length;
  updateHUD();
}

/* Controls */
canvas.addEventListener("click", e => {
  placeSpaghetti(e.clientX, e.clientY);
  statusEl.innerText = `${players[currentPlayer]}'s turn`;
});

rotateLeftBtn.onclick = () => {
  rotation -= Math.PI / 12;
  updateHUD();
};

rotateRightBtn.onclick = () => {
  rotation += Math.PI / 12;
  updateHUD();
};

addBtn.onclick = () => {
  placeSpaghetti(canvas.width / 2, 120);
};

resetBtn.onclick = () => {
  location.reload();
};

/* Timer */
setInterval(() => {
  if (timeLeft <= 0) return;
  timeLeft--;
  updateHUD();
}, 1000);

updateHUD();
