const { Engine, Render, Runner, World, Bodies, Body, Events, Constraint } = Matter;

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
const SNAP_DISTANCE = 26;

/* Game state */
let engine, render, runner;
let spaghettiBodies = [];
let connectorMarshmallows = [];
let glueConstraints = [];
let finalTopMarshmallow = null;

let spaghettiLeft = 20;
let connectorMarshmallowsLeft = 10;
let score = 0;
let timeLeft = 30;
let rotation = 0;
let buildMode = "spaghetti"; // spaghetti | connector
let gameEnded = false;
let finalMarshmallowPlaced = false;

let countdownInterval = null;
let stabilityInterval = null;
let previewX = window.innerWidth / 2;
let previewY = window.innerHeight / 2;

/* Init */
function initGame() {
  stopTimers();
  stopMatter();

  spaghettiBodies = [];
  connectorMarshmallows = [];
  glueConstraints = [];
  finalTopMarshmallow = null;

  spaghettiLeft = 20;
  connectorMarshmallowsLeft = 10;
  score = 0;
  timeLeft = 30;
  rotation = 0;
  buildMode = "spaghetti";
  gameEnded = false;
  finalMarshmallowPlaced = false;

  previewX = window.innerWidth / 2;
  previewY = window.innerHeight / 2;

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

  createWorld();
  attachHandlers();

  Render.run(render);
  Runner.run(runner, engine);

  updateHud();
  statusEl.innerText =
    "Build with spaghetti or connector marshmallows. When time ends, place the final marshmallow.";
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
      label: "ground",
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
function createSpaghetti(x, y, angle = 0) {
  const stick = Bodies.rectangle(x, y, SPAGHETTI_LENGTH, SPAGHETTI_THICKNESS, {
    label: "spaghetti",
    density: 0.0004,
    friction: 0.4,
    restitution: 0.1,
    render: { fillStyle: "#f4d03f" }
  });
  Body.setAngle(stick, angle);
  return stick;
}

function createConnectorMarshmallow(x, y) {
  return Bodies.circle(x, y, CONNECTOR_RADIUS, {
    label: "connector",
    density: 0.008,
    friction: 0.8,
    restitution: 0.05,
    render: { fillStyle: "#fffaf5" }
  });
}

function createFinalMarshmallow(x, y) {
  return Bodies.circle(x, y, FINAL_MARSHMALLOW_RADIUS, {
    label: "finalMarshmallow",
    density: 0.01,
    friction: 0.6,
    restitution: 0.05,
    render: { fillStyle: "#ffffff" }
  });
}

/* Glue helpers */
function worldPointOnBody(body, localX, localY = 0) {
  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);
  return {
    x: body.position.x + localX * cos - localY * sin,
    y: body.position.y + localX * sin + localY * cos
  };
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function stickEndpoints(stick) {
  return [
    { localX: -SPAGHETTI_LENGTH / 2, world: worldPointOnBody(stick, -SPAGHETTI_LENGTH / 2, 0) },
    { localX:  SPAGHETTI_LENGTH / 2, world: worldPointOnBody(stick,  SPAGHETTI_LENGTH / 2, 0) }
  ];
}

function addGlueConstraint(connector, stick, localXOnStick) {
  const c = Constraint.create({
    bodyA: connector,
    pointA: { x: 0, y: 0 },
    bodyB: stick,
    pointB: { x: localXOnStick, y: 0 },
    length: 0,
    stiffness: 0.9,
    damping: 0.08,
    render: { visible: false }
  });

  glueConstraints.push(c);
  World.add(engine.world, c);
}

function attachSpaghettiToNearbyConnectors(stick) {
  const endpoints = stickEndpoints(stick);

  for (const endpoint of endpoints) {
    for (const connector of connectorMarshmallows) {
      if (distance(endpoint.world, connector.position) <= SNAP_DISTANCE) {
        addGlueConstraint(connector, stick, endpoint.localX);
      }
    }
  }
}

function attachConnectorToNearbySpaghetti(connector) {
  for (const stick of spaghettiBodies) {
    const endpoints = stickEndpoints(stick);
    for (const endpoint of endpoints) {
      if (distance(endpoint.world, connector.position) <= SNAP_DISTANCE) {
        addGlueConstraint(connector, stick, endpoint.localX);
      }
    }
  }
}

/* Placement */
function placeSpaghetti(x, y) {
  if (gameEnded) return;
  if (timeLeft <= 0) {
    statusEl.innerText = "Time is up — place the final marshmallow.";
    return;
  }
  if (spaghettiLeft <= 0) {
    statusEl.innerText = "No spaghetti left.";
    return;
  }

  const stick = createSpaghetti(x, y, rotation);
  spaghettiBodies.push(stick);
  World.add(engine.world, stick);

  attachSpaghettiToNearbyConnectors(stick);

  spaghettiLeft--;
  updateScore();
  updateHud();
  statusEl.innerText = "Spaghetti placed.";
}

function placeConnectorMarshmallow(x, y) {
  if (gameEnded) return;
  if (timeLeft <= 0) {
    statusEl.innerText = "Time is up — place the final marshmallow.";
    return;
  }
  if (connectorMarshmallowsLeft <= 0) {
    statusEl.innerText = "No connector marshmallows left.";
    return;
  }

  const connector = createConnectorMarshmallow(x, y);
  connectorMarshmallows.push(connector);
  World.add(engine.world, connector);

  attachConnectorToNearbySpaghetti(connector);

  connectorMarshmallowsLeft--;
  updateScore();
  updateHud();
  statusEl.innerText = "Connector marshmallow placed and glued to nearby spaghetti.";
}

function placeFinalTopMarshmallow(x, y) {
  if (gameEnded) return;
  if (finalMarshmallowPlaced) return;
  if (timeLeft > 0) {
    statusEl.innerText = "You can only place the final marshmallow when time reaches 0.";
    return;
  }

  finalTopMarshmallow = createFinalMarshmallow(x, y);
  finalMarshmallowPlaced = true;
  World.add(engine.world, finalTopMarshmallow);

  statusEl.innerText = "Final marshmallow placed. Tower must stand for 10 seconds…";
  startStabilityCheck();
}

/* Rotation */
function rotateNextPiece(delta) {
  if (gameEnded) return;
  if (timeLeft <= 0) return;
  if (buildMode !== "spaghetti") return;

  rotation += delta;
  updateHud();
}

/* Input */
function attachHandlers() {
  canvas.onmousemove = (event) => {
    const rect = canvas.getBoundingClientRect();
    previewX = event.clientX - rect.left;
    previewY = event.clientY - rect.top;
  };

  canvas.onclick = (event) => {
    if (gameEnded) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (x < HUD_SAFE_WIDTH && y < HUD_SAFE_HEIGHT) return;

    if (timeLeft > 0) {
      if (buildMode === "spaghetti") {
        placeSpaghetti(x, y);
      } else {
        placeConnectorMarshmallow(x, y);
      }
    } else if (!finalMarshmallowPlaced) {
      placeFinalTopMarshmallow(x, y);
    }
  };

  rotateLeftBtn.onclick = () => rotateNextPiece(-ROT_STEP);
  rotateRightBtn.onclick = () => rotateNextPiece(ROT_STEP);

  toggleMaterialBtn.onclick = () => {
    if (timeLeft <= 0) return;
    buildMode = buildMode === "spaghetti" ? "connector" : "spaghetti";
    updateHud();
    statusEl.innerText = `Current material: ${buildMode === "spaghetti" ? "spaghetti" : "connector marshmallow"}.`;
  };

  addBtn.onclick = () => {
    if (gameEnded) return;

    if (timeLeft > 0) {
      if (buildMode === "spaghetti") {
        placeSpaghetti(canvas.width / 2, 120);
      } else {
        placeConnectorMarshmallow(canvas.width / 2, 120);
      }
    } else if (!finalMarshmallowPlaced) {
      placeFinalTopMarshmallow(canvas.width / 2, 90);
    }
  };

  resetBtn.onclick = () => initGame();
  playAgainBtn.onclick = () => initGame();

  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "r") rotateNextPiece(ROT_STEP);
    if (event.key === "ArrowLeft") rotateNextPiece(-ROT_STEP);
    if (event.key === "ArrowRight") rotateNextPiece(ROT_STEP);

    if (event.key.toLowerCase() === "m" && timeLeft > 0) {
      buildMode = buildMode === "spaghetti" ? "connector" : "spaghetti";
      updateHud();
    }
  }, { once: true });

  Events.on(engine, "afterUpdate", () => {
    if (gameEnded) return;
    if (!finalMarshmallowPlaced) return;

    updateScore();

    if (hasTowerFailed()) {
      endGame(false);
    }
  });

  Events.on(render, "afterRender", () => {
    if (gameEnded) return;
    if (timeLeft <= 0) return;
    if (previewX < HUD_SAFE_WIDTH && previewY < HUD_SAFE_HEIGHT) return;

    const ctx = render.context;
    ctx.save();
    ctx.translate(previewX, previewY);
    ctx.globalAlpha = 0.45;

    if (buildMode === "spaghetti" && spaghettiLeft > 0) {
      ctx.rotate(rotation);
      ctx.fillStyle = "#d4ac0d";
      ctx.fillRect(
        -SPAGHETTI_LENGTH / 2,
        -SPAGHETTI_THICKNESS / 2,
        SPAGHETTI_LENGTH,
        SPAGHETTI_THICKNESS
      );
    } else if (buildMode === "connector" && connectorMarshmallowsLeft > 0) {
      ctx.fillStyle = "#fffaf5";
      ctx.beginPath();
      ctx.arc(0, 0, CONNECTOR_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  });
}

/* Timer */
function startTimer() {
  countdownInterval = setInterval(() => {
    if (gameEnded) return;

    timeLeft--;
    updateHud();

    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      statusEl.innerText = "Time is up — place the final marshmallow.";
    }
  }, 1000);
}

function startStabilityCheck() {
  let secondsRemaining = 10;

  stabilityInterval = setInterval(() => {
    if (gameEnded) return;

    secondsRemaining--;
    updateScore();
    updateHud();

    if (secondsRemaining > 0) {
      statusEl.innerText = `Tower must stand for ${secondsRemaining} seconds…`;
    } else {
      clearInterval(stabilityInterval);
      stabilityInterval = null;
      endGame(true);
    }
  }, 1000);
}

function stopTimers() {
  if (countdownInterval) clearInterval(countdownInterval);
  if (stabilityInterval) clearInterval(stabilityInterval);
}

/* Score / HUD */
function updateScore() {
  const structuralBodies = [...spaghettiBodies, ...connectorMarshmallows];
  if (structuralBodies.length === 0) {
    score = 0;
    return;
  }

  let topY = Infinity;
  for (const body of structuralBodies) {
    if (body && body.bounds && body.bounds.min.y < topY) {
      topY = body.bounds.min.y;
    }
  }

  score = Math.max(0, Math.round(canvas.height - GROUND_HEIGHT - topY));
}

function normalisedDegrees(angleRadians) {
  return ((Math.round((angleRadians * 180) / Math.PI) % 360) + 360) % 360;
}

function updateHud() {
  const mins = Math.floor(timeLeft / 60);
  const secs = String(Math.max(0, timeLeft % 60)).padStart(2, "0");
  timeEl.innerText = `${String(mins).padStart(2, "0")}:${secs}`;
  countEl.innerText = String(spaghettiLeft);
  marshmallowCountEl.innerText = String(connectorMarshmallowsLeft);
  scoreEl.innerText = String(score);
  rotationEl.innerText = `${normalisedDegrees(rotation)}°`;
  buildModeLabelEl.innerText = buildMode === "spaghetti" ? "Spaghetti" : "Connector marshmallow";
  toggleMaterialBtn.innerText =
    buildMode === "spaghetti" ? "Switch to marshmallow" : "Switch to spaghetti";
}

/* End game */
function hasTowerFailed() {
  if (!finalTopMarshmallow) return false;
  const floorLine = canvas.height - GROUND_HEIGHT - 5;
  return finalTopMarshmallow.position.y >= floorLine;
}

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
  finalConnectorUsed.innerText = String(10 - connectorMarshmallowsLeft);
  finalMarshmallow.innerText = finalTopMarshmallow ? "Yes" : "No";

  finalPanel.classList.remove("hidden");
}

function hideFinalPanel() {
  finalPanel.classList.add("hidden");
}

/* Resize */
window.addEventListener("resize", () => {
  initGame();
});

/* Start */
initGame();
