const { Engine, Render, Runner, World, Bodies, Body, Events } = Matter;");
const startGameBtn = document.getElementById("startGame");

const finalPanel = document.getElementById("finalPanel");
const finalTitle = document.getElementById("finalTitle");
const finalMessage = document.getElementById("finalMessage");
const finalScore = document.getElementById("finalScore");
const finalUsed = document.getElementById("finalUsed");
const finalBuilder = document.getElementById("finalBuilder");
const playAgainBtn = document.getElementById("playAgain");

/* Constants */
const GROUND_HEIGHT = 80;
const ROT_STEP = Math.PI / 12;

/* Game state */
let engine, render, runner;
let spaghetti = [];
let marshmallow = null;

let players = [];
let currentPlayer = 0;
let lastBuilder = "";

let spaghettiLeft = 20;
let score = 0;
let timeLeft = 30;
let rotation = 0;
let gameEnded = false;

/* Setup */
startGameBtn.onclick = () => {
  const inputs = document.querySelectorAll(".playerInput");
  players = [...inputs].map(i => i.value.trim()).filter(v => v);

  if (players.length < 2) {
    alert("Please enter at least 2 player names");
    return;
  }

  setupPanel.style.display = "none";
  initGame();
};

playAgainBtn.onclick = () => {
  finalPanel.classList.add("hidden");
  setupPanel.style.display = "flex";
};

/* Init */
function initGame() {
  spaghetti = [];
  marshmallow = null;
  spaghettiLeft = 20;
  score = 0;
  timeLeft = 30;
  rotation = 0;
  currentPlayer = 0;
  lastBuilder = players[0];
  gameEnded = false;

  updateHud();

  engine = Engine.create();
  engine.world.gravity.y = 1;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  render = Render.create({
    canvas,
    engine,
    options: {
      width: canvas.width,
      height: canvas.height,
      wireframes: false,
      background: "#f4f4f4"
    }
  });

  runner = Runner.create();
  Render.run(render);
  Runner.run(runner, engine);

  const ground = Bodies.rectangle(
    canvas.width / 2,
    canvas.height - GROUND_HEIGHT / 2,
    canvas.width,
    GROUND_HEIGHT,
    { isStatic: true }
  );

  World.add(engine.world, ground);

  startTimer();
}

/* Placement */
canvas.onclick = e => {
  if (gameEnded) return;

  const x = e.clientX;
  const y = e.clientY;

  if (timeLeft > 0 && spaghettiLeft > 0) {
    placeSpaghetti(x, y);
  } else if (!marshmallow) {
    placeMarshmallow(x, y);
  }
};

function placeSpaghetti(x, y) {
  const stick = Bodies.rectangle(x, y, 140, 6);
  Body.setAngle(stick, rotation);
  spaghetti.push(stick);
  World.add(engine.world, stick);

  spaghettiLeft--;
  lastBuilder = players[currentPlayer];
  currentPlayer = (currentPlayer + 1) % players.length;

  updateScore();
  updateHud();
}

function placeMarshmallow(x, y) {
  marshmallow = Bodies.circle(x, y, 22, { density: 0.01 });
  World.add(engine.world, marshmallow);

  statusEl.innerText = "Marshmallow placed – hold for 10 seconds!";
  setTimeout(() => endGame(true), 10000);
}

/* Controls */
rotateLeftBtn.onclick = () => rotation -= ROT_STEP;
rotateRightBtn.onclick = () => rotation += ROT_STEP;

document.addEventListener("keydown", e => {
  if (e.key.toLowerCase() === "r") rotation += ROT_STEP;
});

addBtn.onclick = () => placeSpaghetti(canvas.width / 2, 120);
resetBtn.onclick = () => location.reload();

/* Timer */
function startTimer() {
  const interval = setInterval(() => {
    if (gameEnded) return;

    timeLeft--;
    updateHud();

    if (timeLeft <= 0) {
      clearInterval(interval);
      statusEl.innerText = "Place the marshmallow!";
    }
  }, 1000);
}

/* Score */
function updateScore() {
  let top = Infinity;
  spaghetti.forEach(s => top = Math.min(top, s.bounds.min.y));
  score = Math.max(0, Math.round(canvas.height - GROUND_HEIGHT - top));
}

/* HUD */
function updateHud() {
  timeEl.innerText = `00:${String(timeLeft).padStart(2, "0")}`;
  countEl.innerText = spaghettiLeft;
  scoreEl.innerText = score;
  rotationEl.innerText = `${Math.round(rotation * 180 / Math.PI) % 360}°`;
  currentPlayerEl.innerText = players[currentPlayer];
  statusEl.innerText = `${players[currentPlayer]}'s turn`;
}

/* End */
function endGame(success) {
  gameEnded = true;

  finalTitle.innerText = success ? "✅ Success!" : "❌ Failed";
  finalMessage.innerText = "Round complete";
  finalScore.innerText = score;
  finalUsed.innerText = 20 - spaghettiLeft;
  finalBuilder.innerText = lastBuilder;

  finalPanel.classList.remove("hidden");
}

/* DOM */
const canvas = document.getElementById("game");
const timeEl = document.getElementById("time");
const countEl = document.getElementById("count");
const scoreEl = document.getElementById("score");
const rotationEl = document.getElementById("rotation");
const currentPlayerEl = document.getElementById("currentPlayer");
const statusEl = document.getElementById("status");

const rotateLeftBtn = document.getElementById("rotateLeft");
const rotateRightBtn = document.getElementById("rotateRight");
const addBtn = document.getElementById("add");
const resetBtn = document.getElementById("reset");

