const { Engine, Render, Runner, World, Bodies, Body } = Matter;

/* DOM */
const canvas = document.getElementById("game");
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
const HUD_SAFE_WIDTH = 520;
const HUD_SAFE_HEIGHT = 260;

/* State */
let engine;
let render;
let runner;

let spaghettiBodies = [];
let connectorBodies = [];
let finalMarshmallowBody = null;

let spaghettiLeft = 20;
let connectorLeft = 10;
let score = 0;
let timeLeft = 30;
let rotation = 0;
let buildMode = "spaghetti"; // spaghetti | connector
let gameEnded = false;
let finalPlaced = false;

let timerId = null;
let stabilityId = null;

/* Init */
function initGame() {
  stopTimers();
  stopMatter();

  spaghettiBodies = [];
  connectorBodies = [];
  finalMarshmallowBody = null;

  spaghettiLeft = 20;
  connectorLeft = 10;
  score = 0;
  timeLeft = 30;
  rotation = 0;
  buildMode = "spaghetti";
  gameEnded = false;
  finalPlaced = false;

  hideFinalPanel();

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  engine = Engine.create();
  engine.world.gravity.y = 1;

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
    { isStatic: true, render: { fillStyle: "#666" } }
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

  Render.run(render);
  Runner.run(runner, engine);

  updateHud();
  statusEl.innerText = "Click in the grey area to place material. Press M to switch material.";
  startTimer();
}

/* Factories */
function createSpaghetti(x, y) {
  const stick = Bodies.rectangle(x, y, SPAGHETTI_LENGTH, SPAGHETTI_THICKNESS, {
    density: 0.0004,
    friction: 0.4,
    restitution: 0.1,
    render: { fillStyle: "#f4d03f" }
  });
  Body.setAngle(stick, rotation);
  return stick;
}

function createConnector(x, y) {
  return Bodies.circle(x, y, CONNECTOR_RADIUS, {
    density: 0.008,
    friction: 0.8,
    restitution: 0.05,
    render: { fillStyle: "#fffaf5" }
  });
}

function createFinalMarshmallow(x, y) {
  return Bodies.circle(x, y, FINAL_MARSHMALLOW_RADIUS, {
    density: 0.01,
    friction: 0.6,
    restitution: 0.05,
    render: { fillStyle: "#ffffff" }
  });
}

/* Placement */
function placeSpaghetti(x, y) {
  if (timeLeft <= 0 || spaghettiLeft <= 0 || gameEnded) return;

  const stick = createSpaghetti(x, y);
  spaghettiBodies.push(stick);
  World.add(engine.world, stick);

  spaghettiLeft--;
  updateScore();
  updateHud();
  statusEl.innerText = "Spaghetti placed.";
}

function placeConnector(x, y) {
  if (timeLeft <= 0 || connectorLeft <= 0 || gameEnded) return;

  const connector = createConnector(x, y);
  connectorBodies.push(connector);
  World.add(engine.world, connector);

  connectorLeft--;
  updateScore();
  updateHud();
  statusEl.innerText = "Connector marshmallow placed.";
}

function placeFinalMarshmallow(x, y) {
  if (timeLeft > 0 || finalPlaced || gameEnded) return;

  finalMarshmallowBody = createFinalMarshmallow(x, y);
  finalPlaced = true;
  World.add(engine.world, finalMarshmallowBody);

  statusEl.innerText = "Final marshmallow placed. Tower must stand for 10 seconds.";
  startStabilityCheck();
}

/* Input */
canvas.addEventListener("click", (event) => {
  if (gameEnded) return;

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  if (x < HUD_SAFE_WIDTH && y < HUD_SAFE_HEIGHT) return;

  if (timeLeft > 0) {
    if (buildMode === "spaghetti") {
      placeSpaghetti(x, y);
    } else {
      placeConnector(x, y);
    }
  } else {
    placeFinalMarshmallow(x, y);
  }
});

rotateLeftBtn.onclick = () => {
  if (buildMode === "spaghetti" && timeLeft > 0) {
    rotation -= ROT_STEP;
    updateHud();
  }
};

rotateRightBtn.onclick = () => {
  if (buildMode === "spaghetti" && timeLeft > 0) {
    rotation += ROT_STEP;
    updateHud();
  }
};

toggleMaterialBtn.onclick = () => {
  if (timeLeft <= 0) return;
  buildMode = buildMode === "spaghetti" ? "connector" : "spaghetti";
  updateHud();
  statusEl.innerText = `Build mode switched to ${buildMode === "spaghetti" ? "spaghetti" : "connector marshmallow"}.`;
};

addBtn.onclick = () => {
  if (timeLeft > 0) {
    if (buildMode === "spaghetti") {
      placeSpaghetti(canvas.width / 2, 120);
    } else {
      placeConnector(canvas.width / 2, 120);
    }
  } else {
    placeFinalMarshmallow(canvas.width / 2, 90);
  }
};

resetBtn.onclick = () => {
  initGame();
};

playAgainBtn.onclick = () => {
  initGame();
};

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "m" && timeLeft > 0) {
    buildMode = buildMode === "spaghetti" ? "connector" : "spaghetti";
    updateHud();
  }
  if (event.key.toLowerCase() === "r" && buildMode === "spaghetti" && timeLeft > 0) {
    rotation += ROT_STEP;
    updateHud();
  }
});

/* Timer */
function startTimer() {
  timerId = setInterval(() => {
    if (gameEnded) return;

    timeLeft--;
    updateHud();

    if (timeLeft <= 0) {
      clearInterval(timerId);
      timerId = null;
      statusEl.innerText = "Time is up — place the final marshmallow.";
    }
  }, 1000);
}

function startStabilityCheck() {
  let secondsRemaining = 10;

  stabilityId = setInterval(() => {
    if (gameEnded) return;

    secondsRemaining--;
    updateScore();
    updateHud();

    if (finalMarshmallowBody && finalMarshmallowBody.position.y >= canvas.height - GROUND_HEIGHT - 5) {
      endGame(false);
      return;
    }

    if (secondsRemaining <= 0) {
      endGame(true);
    } else {
      statusEl.innerText = `Tower must stand for ${secondsRemaining} seconds.`;
    }
  }, 1000);
}

function stopTimers() {
  if (timerId) clearInterval(timerId);
  if (stabilityId) clearInterval(stabilityId);
  timerId = null;
  stabilityId = null;
}

/* Matter */
function stopMatter() {
  if (runner) Runner.stop(runner);
  if (render) Render.stop(render);
}

/* Score / HUD */
function updateScore() {
  const structuralBodies = [...spaghettiBodies, ...connectorBodies];
  if (structuralBodies.length === 0) {
    score = 0;
    return;
  }

  let topY = Infinity;
  for (const body of structuralBodies) {
    if (body.bounds.min.y < topY) {
      topY = body.bounds.min.y;
    }
  }

  score = Math.max(0, Math.round(canvas.height - GROUND_HEIGHT - topY));
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

/* End */
function endGame(success) {
  if (gameEnded) return;
  gameEnded = true;
  stopTimers();
  updateScore();
  updateHud();

  finalTitle.innerText = success ? "✅ Success!" : "❌ Failed";
  finalMessage.innerText = success
    ? "The tower held the final marshmallow for 10 seconds."
    : "The tower did not survive the marshmallow test.";
  finalScore.innerText = String(score);
  finalUsed.innerText = String(20 - spaghettiLeft);
  finalConnectorUsed.innerText = String(10 - connectorLeft);
  finalMarshmallow.innerText = finalPlaced ? "Yes" : "No";

  finalPanel.classList.remove("hidden");
}

function hideFinalPanel() {
  finalPanel.classList.add("hidden");
}

/* Start */
initGame();
``
