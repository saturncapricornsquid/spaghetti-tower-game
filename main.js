const { Engine, Render, Runner, World, Bodies, Body, Events, Constraint } = Matter;const { Engine, Render, Runner, World, Bodies,ElementById("count");
const marshmallowCountEl = document.getElementById("marshmallowCount");
const scoreEl = document.getElementById("score");
const rotationEl = document.getElementById("rotation");
const buildModeLabelEl = document.getElementById("buildModeLabel");
const currentPlayerEl = document.getElementById("currentPlayer");
const statusEl = document.getElementById("status");

const rotateLeftBtn = document.getElementById("rotateLeft");
const rotateRightBtn = document.getElementById("rotateRight");
const addBtn = document.getElementById("add");
const resetBtn = document.getElementById("reset");
const toggleMaterialBtn = document.getElementById("toggleMaterial");

const setupPanel = document.getElementById("setupPanel");
const startGameBtn = document.getElementById("startGame");
const playerInputs = Array.from(document.querySelectorAll(".playerInput"));

const finalPanel = document.getElementById("finalPanel");
const finalTitle = document.getElementById("finalTitle");
const finalMessage = document.getElementById("finalMessage");
const finalScore = document.getElementById("finalScore");
const finalHeight = document.getElementById("finalHeight");
const finalUsed = document.getElementById("finalUsed");
const finalConnectorUsed = document.getElementById("finalConnectorUsed");
const finalMarshmallow = document.getElementById("finalMarshmallow");
const finalBuilder = document.getElementById("finalBuilder");
const playAgainBtn = document.getElementById("playAgain");
const changeTeamBtn = document.getElementById("changeTeam");

/* Constants */
const GROUND_HEIGHT = 80;
const ROT_STEP = Math.PI / 12; // 15°
const SPAGHETTI_LENGTH = 140;
const SPAGHETTI_THICKNESS = 6;
const CONNECTOR_RADIUS = 12;
const FINAL_MARSHMALLOW_RADIUS = 22;
const HUD_SAFE_WIDTH = 520;
const HUD_SAFE_HEIGHT = 360;
const SNAP_DISTANCE = 26;

/* Game state */
let engine = null;
let render = null;
let runner = null;

let spaghettiBodies = [];
let connectorMarshmallows = [];
let glueConstraints = [];
let finalTopMarshmallow = null;

let players = [];
let currentPlayerIndex = 0;
let lastBuilder = "";

let spaghettiLeft = 20;
let connectorMarshmallowsLeft = 10;
let score = 0;
let timeLeft = 30; // change to 18 * 60 later if you want
let rotation = 0;
let gameEnded = false;
let finalMarshmallowPlaced = false;

let buildMode = "spaghetti"; // spaghetti | connector
let countdownInterval = null;
let stabilityInterval = null;
let previewX = window.innerWidth / 2;
let previewY = window.innerHeight / 2;

let keyboardHandlerAttached = false;

/* Setup */
startGameBtn.onclick = () => {
  const enteredNames = playerInputs
    .map(input => input.value.trim())
    .filter(name => name.length > 0);

  if (enteredNames.length < 2) {
    alert("Please enter at least 2 player names.");
    return;
  }

  players = enteredNames;
  setupPanel.style.display = "none";
  initGame();
};

playAgainBtn.onclick = () => {
  hideFinalPanel();
  initGame();
};

changeTeamBtn.onclick = () => {
  hideFinalPanel();
  setupPanel.style.display = "flex";
};

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
  gameEnded = false;
  finalMarshmallowPlaced = false;
  buildMode = "spaghetti";

  currentPlayerIndex = 0;
  lastBuilder = players[0] || "—";

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
  attachCanvasHandlers();
  attachUIHandlers();
  attachEngineHandlers();
  attachPreviewRenderer();
  attachKeyboardHandlerOnce();

  Render.run(render);
  Runner.run(runner, engine);

  updateHud();
  statusEl.innerText =
    `${players[currentPlayerIndex]}'s turn. Current material: spaghetti.`;
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

  const leftWall = Bodies.rectangle(
    -25,
    canvas.height / 2,
    50,
    canvas.height,
    { isStatic: true, render: { visible: false } }
  );

  const rightWall = Bodies.rectangle(
    canvas.width + 25,
    canvas.height / 2,
    50,
    canvas.height,
    { isStatic: true, render: { visible: false } }
  );

  World.add(engine.world, [ground, leftWall, rightWall]);
}

function stopMatter() {
  if (runner) {
    Runner.stop(runner);
    runner = null;
  }
  if (render) {
    Render.stop(render);
    render = null;
  }
  engine = null;
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
    label: "connectorMarshmallow",
    density: 0.008,
    friction: 0.8,
    restitution: 0.05,
    render: { fillStyle: "#fffaf5" }
  });
}

function createFinalTopMarshmallow(x, y) {
  return Bodies.circle(x, y, FINAL_MARSHMALLOW_RADIUS, {
    label: "finalMarshmallow",
    density: 0.01,
    friction: 0.6,
    restitution: 0.05,
    render: { fillStyle: "#ffffff" }
  });
}

/* Turn-taking */
function updateCurrentPlayer() {
  currentPlayerEl.innerText = players[currentPlayerIndex] || "—";
}

function advanceTurn() {
  lastBuilder = players[currentPlayerIndex] || "—";
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  updateCurrentPlayer();
}

/* Geometry helpers */
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

function stickEndpoints(body) {
  return [
    { localX: -SPAGHETTI_LENGTH / 2, world: worldPointOnBody(body, -SPAGHETTI_LENGTH / 2, 0) },
    { localX:  SPAGHETTI_LENGTH / 2, world: worldPointOnBody(body,  SPAGHETTI_LENGTH / 2, 0) }
  ];
}

function addGlueConstraint(connectorBody, stickBody, localXOnStick) {
  const constraint = Constraint.create({
    bodyA: connectorBody,
    pointA: { x: 0, y: 0 },
    bodyB: stickBody,
    pointB: { x: localXOnStick, y: 0 },
    length: 0,
    stiffness: 0.9,
    damping: 0.08,
    render: { visible: false }
  });

  glueConstraints.push(constraint);
  World.add(engine.world, constraint);
}

function attachSpaghettiToNearbyConnectors(stickBody) {
  const endpoints = stickEndpoints(stickBody);

  for (const endpoint of endpoints) {
    for (const connector of connectorMarshmallows) {
      if (distance(endpoint.world, connector.position) <= SNAP_DISTANCE) {
        addGlueConstraint(connector, stickBody, endpoint.localX);
      }
    }
  }
}

function attachConnectorToNearbySpaghetti(connectorBody) {
  for (const stick of spaghettiBodies) {
    const endpoints = stickEndpoints(stick);

    for (const endpoint of endpoints) {
      if (distance(endpoint.world, connectorBody.position) <= SNAP_DISTANCE) {
        addGlueConstraint(connectorBody, stick, endpoint.localX);
      }
    }
  }
}

/* Placement */
function placeSpaghetti(x, y, angle = rotation) {
  if (gameEnded) return;
  if (timeLeft <= 0) {
    statusEl.innerText = "Building time is over. Place the final marshmallow now.";
    return;
  }
  if (spaghettiLeft <= 0) {
    statusEl.innerText = "No spaghetti left.";
    return;
  }

  const builderName = players[currentPlayerIndex];
  const stick = createSpaghetti(x, y, angle);

  spaghettiBodies.push(stick);
  World.add(engine.world, stick);

  // Auto-glue to nearby connector marshmallows
  attachSpaghettiToNearbyConnectors(stick);

  spaghettiLeft--;
  updateScore();
  updateHud();

  statusEl.innerText = `${builderName} placed spaghetti.`;
  advanceTurn();
}

function placeConnectorMarshmallow(x, y) {
  if (gameEnded) return;
  if (timeLeft <= 0) {
    statusEl.innerText = "Building time is over. Place the final marshmallow now.";
    return;
  }
  if (connectorMarshmallowsLeft <= 0) {
    statusEl.innerText = "No connector marshmallows left.";
    return;
  }

  const builderName = players[currentPlayerIndex];
  const connector = createConnectorMarshmallow(x, y);

  connectorMarshmallows.push(connector);
  World.add(engine.world, connector);

  // Auto-glue to nearby spaghetti endpoints
  attachConnectorToNearbySpaghetti(connector);

  connectorMarshmallowsLeft--;
  updateScore();
  updateHud();

  statusEl.innerText = `${builderName} placed a connector marshmallow.`;
  advanceTurn();
}

function placeFinalTopMarshmallow(x, y) {
  if (gameEnded) return;
  if (finalMarshmallowPlaced) return;
  if (timeLeft > 0) {
    statusEl.innerText = "You can only place the final marshmallow when the timer reaches 0.";
    return;
  }

  const builderName = players[currentPlayerIndex];

  finalTopMarshmallow = createFinalTopMarshmallow(x, y);
  finalMarshmallowPlaced = true;
  World.add(engine.world, finalTopMarshmallow);

  statusEl.innerText = `${builderName} placed the final marshmallow. Tower must stand for 10 seconds...`;

  advanceTurn();
  startStabilityCheck();
}

/* Rotation */
function rotateNextPiece(delta) {
  if (gameEnded) return;
  if (timeLeft <= 0) return;
  if (buildMode !== "spaghetti") return;

  rotation += delta;
  updateHud();

  const degrees = normalisedDegrees(rotation);
  statusEl.innerText = `Rotation set to ${degrees}°. ${players[currentPlayerIndex]}'s turn.`;
}

function normalisedDegrees(angleRadians) {
  return ((Math.round((angleRadians * 180) / Math.PI) % 360) + 360) % 360;
}

/* Input */
function attachCanvasHandlers() {
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
        placeSpaghetti(x, y, rotation);
      } else {
        placeConnectorMarshmallow(x, y);
      }
    } else if (!finalMarshmallowPlaced) {
      placeFinalTopMarshmallow(x, y);
    }
  };
}

function attachUIHandlers() {
  rotateLeftBtn.onclick = () => rotateNextPiece(-ROT_STEP);
  rotateRightBtn.onclick = () => rotateNextPiece(ROT_STEP);

  toggleMaterialBtn.onclick = () => {
    if (timeLeft <= 0) return;

    buildMode = buildMode === "spaghetti" ? "connector" : "spaghetti";
    updateHud();
    statusEl.innerText = `${players[currentPlayerIndex]}'s turn. Current material: ${
      buildMode === "spaghetti" ? "spaghetti" : "connector marshmallow"
    }.`;
  };

  addBtn.onclick = () => {
    if (gameEnded) return;

    if (timeLeft > 0) {
      if (buildMode === "spaghetti") {
        placeSpaghetti(canvas.width / 2, 120, rotation);
      } else {
        placeConnectorMarshmallow(canvas.width / 2, 120);
      }
    } else if (!finalMarshmallowPlaced) {
      placeFinalTopMarshmallow(canvas.width / 2, 90);
    }
  };

  resetBtn.onclick = () => {
    initGame();
  };
}

function attachKeyboardHandlerOnce() {
  if (keyboardHandlerAttached) return;
  keyboardHandlerAttached = true;

  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "r") rotateNextPiece(ROT_STEP);
    if (event.key === "ArrowLeft") rotateNextPiece(-ROT_STEP);
    if (event.key === "ArrowRight") rotateNextPiece(ROT_STEP);

    if (event.key.toLowerCase() === "m" && timeLeft > 0) {
      buildMode = buildMode === "spaghetti" ? "connector" : "spaghetti";
      updateHud();
      statusEl.innerText = `${players[currentPlayerIndex]}'s turn. Current material: ${
        buildMode === "spaghetti" ? "spaghetti" : "connector marshmallow"
      }.`;
    }
  });
}

/* Engine events */
function attachEngineHandlers() {
  Events.on(engine, "afterUpdate", () => {
    if (gameEnded) return;
    if (!finalMarshmallowPlaced) return;

    updateScore();

    if (hasTowerFailed()) {
      endGame(false);
    }
  });
}

function attachPreviewRenderer() {
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
    }

    if (buildMode === "connector" && connectorMarshmallowsLeft > 0) {
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
      statusEl.innerText = `${players[currentPlayerIndex]}'s turn to place the final marshmallow.`;
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
      statusEl.innerText = `Tower must stand for ${secondsRemaining} seconds...`;
    } else {
      clearInterval(stabilityInterval);
      stabilityInterval = null;
      endGame(true);
    }
  }, 1000);
}

function stopTimers() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  if (stabilityInterval) {
    clearInterval(stabilityInterval);
    stabilityInterval = null;
  }
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

function updateHud() {
  const mins = Math.floor(timeLeft / 60);
  const secs = String(Math.max(0, timeLeft % 60)).padStart(2, "0");
  timeEl.innerText = `${String(mins).padStart(2, "0")}:${secs}`;
  countEl.innerText = String(spaghettiLeft);
  marshmallowCountEl.innerText = String(connectorMarshmallowsLeft);
  scoreEl.innerText = String(score);
  rotationEl.innerText = `${normalisedDegrees(rotation)}°`;
  buildModeLabelEl.innerText = buildMode === "spaghetti" ? "Spaghetti" : "Connector marshmallow";
  updateCurrentPlayer();

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
  finalHeight.innerText = String(score);
  finalUsed.innerText = String(20 - spaghettiLeft);
  finalConnectorUsed.innerText = String(10 - connectorMarshmallowsLeft);
  finalMarshmallow.innerText = finalTopMarshmallow ? "Yes" : "No";
  finalBuilder.innerText = lastBuilder;

  finalPanel.classList.remove("hidden");
}

function hideFinalPanel() {
  finalPanel.classList.add("hidden");
}

/* Resize */
window.addEventListener("resize", () => {
  if (players.length > 0 && setupPanel.style.display === "none") {
    initGame();
  }
});

/* DOM references */
const canvas = document.getElementById("game");
const timeEl = document.getElementById("time");
