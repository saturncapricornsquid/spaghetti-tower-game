const { Engine, Render, Runner, World, Bodies, Body } = Matter;const { Engine, Render, Runner, World, Bodies");
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

const GROUND_HEIGHT = 80;
const ROT_STEP = Math.PI / 12; // 15°
const SPAGHETTI_LENGTH = 140;
const SPAGHETTI_THICKNESS = 6;
const CONNECTOR_RADIUS = 12;

let engine;
let render;
let runner;

let spaghettiBodies = [];
let connectorBodies = [];

let spaghettiLeft = 20;
let connectorLeft = 10;
let score = 0;
let timeLeft = 30;
let rotation = 0;
let buildMode = "spaghetti";

let timerId = null;

function initGame() {
  stopGame();

  spaghettiBodies = [];
  connectorBodies = [];

  spaghettiLeft = 20;
  connectorLeft = 10;
  score = 0;
  timeLeft = 30;
  rotation = 0;
  buildMode = "spaghetti";

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  engine = Engine.create();
  engine.world.gravity.y = 0; // stable build phase

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

  World.add(engine.world, [ground]);

  Render.run(render);
  Runner.run(runner, engine);

  updateHud();
  statusEl.innerText = "Buttons should work now. Click outside the panel to place material.";
  startTimer();
}

function stopGame() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  if (runner) Runner.stop(runner);
  if (render) Render.stop(render);
}

function createSpaghetti(x, y) {
  const stick = Bodies.rectangle(x, y, SPAGHETTI_LENGTH, SPAGHETTI_THICKNESS, {
    isStatic: true,
    render: { fillStyle: "#f4d03f" }
  });
  Body.setAngle(stick, rotation);
  return stick;
}

function createConnector(x, y) {
  return Bodies.circle(x, y, CONNECTOR_RADIUS, {
    isStatic: true,
    render: { fillStyle: "#fffaf5" }
  });
}

function placeSpaghetti(x, y) {
  if (spaghettiLeft <= 0) return;

  const stick = createSpaghetti(x, y);
  spaghettiBodies.push(stick);
  World.add(engine.world, stick);

  spaghettiLeft--;
  score += 5;
  updateHud();
  statusEl.innerText = "Spaghetti placed.";
}

function placeConnector(x, y) {
  if (connectorLeft <= 0) return;

  const connector = createConnector(x, y);
  connectorBodies.push(connector);
  World.add(engine.world, connector);

  connectorLeft--;
  score += 2;
  updateHud();
  statusEl.innerText = "Connector marshmallow placed.";
}

function updateHud() {
  const mins = Math.floor(timeLeft / 60);
  const secs = String(Math.max(0, timeLeft % 60)).padStart(2, "0");
  timeEl.innerText = `${String(mins).padStart(2, "0")}:${secs}`;
  countEl.innerText = String(spaghettiLeft);
  marshmallowCountEl.innerText = String(connectorLeft);
  scoreEl.innerText = String(score);
  rotationEl.innerText = `${((Math.round(rotation * 180 / Math.PI) % 360) + 360) % 360}°`;
  buildModeLabelEl.innerText = buildMode === "spaghetti" ? "Spaghetti" : "Connector marshmallow";
  toggleMaterialBtn.innerText =
    buildMode === "spaghetti" ? "Switch to marshmallow" : "Switch to spaghetti";
}

function startTimer() {
  timerId = setInterval(() => {
    timeLeft--;
    updateHud();
    if (timeLeft <= 0) {
      clearInterval(timerId);
      timerId = null;
      statusEl.innerText = "Time is up.";
    }
  }, 1000);
}

canvas.addEventListener("click", (event) => {
  const hudRect = hud.getBoundingClientRect();
  const clickedInsideHud =
    event.clientX >= hudRect.left &&
    event.clientX <= hudRect.right &&
    event.clientY >= hudRect.top &&
    event.clientY <= hudRect.bottom;

  if (clickedInsideHud) {
    statusEl.innerText = "Click outside the control panel to place material.";
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  if (buildMode === "spaghetti") {
    placeSpaghetti(x, y);
  } else {
    placeConnector(x, y);
  }
});

rotateLeftBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  rotation -= ROT_STEP;
  updateHud();
  statusEl.innerText = "Rotated -15°.";
});

rotateRightBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  rotation += ROT_STEP;
  updateHud();
  statusEl.innerText = "Rotated +15°.";
});

toggleMaterialBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  buildMode = buildMode === "spaghetti" ? "connector" : "spaghetti";
  updateHud();
  statusEl.innerText = `Build mode switched to ${buildMode === "spaghetti" ? "spaghetti" : "connector marshmallow"}.`;
});

addBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();

  if (buildMode === "spaghetti") {
    placeSpaghetti(canvas.width / 2, 120);
  } else {
    placeConnector(canvas.width / 2, 120);
  }
});

resetBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  initGame();
});

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "m") {
    buildMode = buildMode === "spaghetti" ? "connector" : "spaghetti";
    updateHud();
  }
  if (event.key.toLowerCase() === "r") {
    rotation += ROT_STEP;
    updateHud();
  }
});

initGame();

const canvas = document.getElementById("game");
const hud = document.getElementById("hud");

