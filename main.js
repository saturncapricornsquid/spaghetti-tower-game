const { Engine, Render, Runner, World, Bodies, Body, Events, Constraint } = Matter;

/* DOM */
const canvas = document.getElementById("game");
const hud = document.getElementById("hud");

const timeEl = document.getElementById("time");
const countEl = document.getElementById("count");
const marshmallowCountEl = document.getElementById("marshmallowCount");
const scoreEl = document.getElementById("score");
const rotationEl = document.getElementById("rotation");
const buildModeLabelEl = document.getElementById("buildModeLabel");
const statusEl = document.getElementById("status");

const rotateLeftBtn = document.getElementById("rotateLeft");
const rotateRightBtn = document.getElementById("rotateRight");
const toggleMaterialBtn = document.getElementById("toggleMaterial");
const addBtn = document.getElementById("add");
const resetBtn = document.getElementById("reset");

const finalPanel = document.getElementById("finalPanel");
const finalTitle = document.getElementById("finalTitle");
const finalMessage = document.getElementById("finalMessage");
const finalScore = document.getElementById("finalScore");
const finalUsed = document.getElementById("finalUsed");
const finalConnectorUsed = document.getElementById("finalConnectorUsed");
const finalMarshmallow = document.getElementById("finalMarshmallow");
const playAgainBtn = document.getElementById("playAgain");

/* Constants */
const GROUND_HEIGHT = 80;
const ROT_STEP = Math.PI / 12; // 15°
const SPAGHETTI_LENGTH = 140;
const SPAGHETTI_THICKNESS = 6;
const CONNECTOR_RADIUS = 12;
const FINAL_MARSHMALLOW_RADIUS = 22;
const SNAP_DISTANCE = 28;

/* State */
let engine;
let render;
let runner;

let spaghettiBodies = [];
let connectorBodies = [];
let glueConstraints = [];
let finalMarshmallowBody = null;

let spaghettiLeft = 20;
let connectorLeft = 10;
let score = 0;
let timeLeft = 30;
let rotation = 0;
let buildMode = "spaghetti"; // spaghetti | connector
let gameEnded = false;
let finalPlaced = false;
let testStarted = false;

let timerId = null;
let stabilityId = null;
let previewX = window.innerWidth / 2;
let previewY = window.innerHeight / 2;
let handlersAttached = false;
let previewAttached = false;
let keyboardAttached = false;

/* Init */
function initGame() {
  stopTimers();
  stopMatter();

  spaghettiBodies = [];
  connectorBodies = [];
  glueConstraints = [];
  finalMarshmallowBody = null;

  spaghettiLeft = 20;
  connectorLeft = 10;
  score = 0;
  timeLeft = 30;
  rotation = 0;
  buildMode = "spaghetti";
  gameEnded = false;
  finalPlaced = false;
  testStarted = false;

  previewX = window.innerWidth / 2;
  previewY = window.innerHeight / 2;

  hideFinalPanel();

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  engine = Engine.create();

  /* Gravity OFF during build */
  engine.world.gravity.y = 0;

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

  createWorld();
  attachHandlers();

  Render.run(render);
  Runner.run(runner, engine);

  updateHud();
  statusEl.innerText =
    "Build phase: pieces stay fixed while you assemble. Switch material, place pieces, then place the final marshmallow to start the test.";
  startTimer();
}

function createWorld() {
  const ground = Bodies.rectangle(
    canvas.width / 2,
    canvas.height - GROUND_HEIGHT / 2,
    canvas.width,
    GROUND_HEIGHT,
    {
      isStatic: true,
      render: { fillStyle: "#666" }
    }
  );

  const leftWall = Bodies.rectangle(-25, canvas.height / 2, 50, canvas.height, {
    isStatic: true,
    render: { visible: false }
  });

  const rightWall = Bodies.rectangle(canvas.width + 25, canvas.height / 2, 50, canvas.height, {
    isStatic: true,
    render: { visible: false }
  });

  World.add(engine.world, [ground, leftWall, rightWall]);
}

function stopMatter() {
  if (runner) Runner.stop(runner);
  if (render) Render.stop(render);
}

/* Factories */
function createSpaghetti(x, y) {
