const { Engine, Render, Runner, World, Bodies, Events, Body } = Matter;const { Engine, Render, Runner, World, Bodies,Id("count");
const scoreEl = document.getElementById("score");
const rotationEl = document.getElementById("rotation");
const statusEl = document.getElementById("status");
const addBtn = document.getElementById("add");
const resetBtn = document.getElementById("reset");
const currentPlayerEl = document.getElementById("currentPlayer");

const rotateLeftBtn = document.getElementById("rotateLeft");
const rotateRightBtn = document.getElementById("rotateRight");

const finalPanel = document.getElementById("finalPanel");
const finalTitle = document.getElementById("finalTitle");
const finalMessage = document.getElementById("finalMessage");
const finalScore = document.getElementById("finalScore");
const finalHeight = document.getElementById("finalHeight");
const finalUsed = document.getElementById("finalUsed");
const finalMarshmallow = document.getElementById("finalMarshmallow");
const finalBuilder = document.getElementById("finalBuilder");
const playAgainBtn = document.getElementById("playAgain");
const closePanelBtn = document.getElementById("closePanel");

/* =========================
   Constants
========================= */
const GROUND_HEIGHT = 80;
const HUD_SAFE_WIDTH = 440;
const HUD_SAFE_HEIGHT = 320;
const SPAGHETTI_LENGTH = 140;
const SPAGHETTI_THICKNESS = 6;
const ROTATION_STEP = Math.PI / 12; // 15 degrees

/* =========================
   Customisable player names
   Change these to your team names
========================= */
let players = ["Jo", "Alex", "Priya"];

/* =========================
   Game state
========================= */
let engine;
let render;
let runner;
let ground;
let leftWall;
let rightWall;

let spaghettiBodies = [];
let marshmallowBody = null;

let spaghettiLeft = 20;
let marshmallowPlaced = false;
let gameEnded = false;
let timeLeft = 30; // change to 18 * 60 later if you want
let countdownInterval = null;
let stabilityInterval = null;
let score = 0;

/* Turn-taking */
let currentPlayerIndex = 0;
let lastBuilder = players[0];

/* Preview / placement */
let previewX = window.innerWidth / 2;
let previewY = window.innerHeight / 2;
let nextRotation = 0;

/* Listener guard */
let keyboardListenerAttached = false;

/* =========================
   Initialisation
========================= */
function initGame() {
  clearTimers();

  spaghettiBodies = [];
  marshmallowBody = null;
  spaghettiLeft = 20;
  marshmallowPlaced = false;
  gameEnded = false;
  timeLeft = 30;
  score = 0;
  nextRotation = 0;
  previewX = window.innerWidth / 2;
  previewY = window.innerHeight / 2;

  currentPlayerIndex = 0;
  lastBuilder = players[0];

  hideFinalPanel();

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  if (render) {
    Render.stop(render);
  }

  if (runner) {
    Runner.stop(runner);
  }

  engine = Engine.create();
  engine.world.gravity.y = 1;

  render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
      width: canvas.width,
      height: canvas.height,
      wireframes: false,
      background: "#f4f4f4"
    }
  });

  runner = Runner.create();

  createWorldBounds();
  attachCanvasHandlers();
  attachUiHandlers();
  attachEngineHandlers();
  attachRenderPreview();

  updateHud();
  updateCurrentPlayer();

  statusEl.innerText =
    `Current builder: ${players[currentPlayerIndex]}. Move your mouse in the grey area. Press R or use rotate buttons. Click to place spaghetti.`;

  Render.run(render);
  Runner.run(runner, engine);

  startCountdown();
}

/* =========================
   World setup
========================= */
function createWorldBounds() {
  ground = Bodies.rectangle(
    canvas.width / 2,
    canvas.height - GROUND_HEIGHT / 2,
    canvas.width,
    GROUND_HEIGHT,
    {
      isStatic: true,
      label: "ground",
      render: { fillStyle: "#666" }
    }
  );

  leftWall = Bodies.rectangle(
    -25,
    canvas.height / 2,
    50,
    canvas.height,
    {
      isStatic: true,
      render: { visible: false }
    }
  );

  rightWall = Bodies.rectangle(
    canvas.width + 25,
    canvas.height / 2,
    50,
    canvas.height,
    {
      isStatic: true,
      render: { visible: false }
    }
  );

  World.add(engine.world, [ground, leftWall, rightWall]);
}

/* =========================
   Factories
========================= */
function createSpaghetti(x, y, angle = 0) {
  const body = Bodies.rectangle(
    x,
    y,
    SPAGHETTI_LENGTH,
    SPAGHETTI_THICKNESS,
    {
      label: "spaghetti",
      density: 0.0004,
      friction: 0.4,
      restitution: 0.1,
      render: { fillStyle: "#f4d03f" }
    }
  );

  Body.setAngle(body, angle);
  return body;
}

function createMarshmallow(x, y) {
  return Bodies.circle(x, y, 22, {
    label: "marshmallow",
    density: 0.01,
    friction: 0.6,
    restitution: 0.05,
    render: { fillStyle: "#ffffff" }
  });
}

/* =========================
   Turn-taking helpers
========================= */
function updateCurrentPlayer() {
  if (currentPlayerEl) {
    currentPlayerEl.innerText = players[currentPlayerIndex];
  }
}

function advanceTurn() {
  lastBuilder = players[currentPlayerIndex];
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  updateCurrentPlayer();
}

/* =========================
   Placement helpers
========================= */
function placeSpaghetti(x, y, angle = nextRotation) {
  if (gameEnded) return;

  if (timeLeft <= 0) {
    statusEl.innerText = "Building time is over. Place the marshmallow now.";
    return;
  }

  if (spaghettiLeft <= 0) {
    statusEl.innerText = "No spaghetti left. Wait for the marshmallow phase.";
    return;
  }

  const builderName = players[currentPlayerIndex];

  const stick = createSpaghetti(x, y, angle);
  spaghettiBodies.push(stick);
  World.add(engine.world, stick);

  spaghettiLeft--;
  updateScore();
  updateHud();

  statusEl.innerText = `${builderName} placed spaghetti.`;

  advanceTurn();
}

function placeMarshmallow(x, y) {
  if (gameEnded) return;
  if (marshmallowPlaced) return;

  if (timeLeft > 0) {
    statusEl.innerText = "You can only place the marshmallow when the timer reaches 0.";
    return;
  }

  const builderName = players[currentPlayerIndex];

  marshmallowBody = createMarshmallow(x, y);
  marshmallowPlaced = true;
  World.add(engine.world, marshmallowBody);

  statusEl.innerText = `${builderName} placed the marshmallow. Tower must stand for 10 seconds...`;

  /* Count marshmallow as a turn as well */
  advanceTurn();

  startStabilityCheck();
}

/* =========================
   Rotation helpers
========================= */
function rotateNextPiece(deltaRadians) {
  if (gameEnded) return;
  if (timeLeft <= 0) return;

  nextRotation += deltaRadians;
  updateHud();

  const degrees = ((Math.round((nextRotation * 180) / Math.PI) % 360) + 360) % 360;


/* =========================
   DOM references
========================= */
const canvas = document.getElementById("game");
const timeEl = document.getElementById("time");
