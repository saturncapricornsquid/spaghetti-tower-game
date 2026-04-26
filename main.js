const { Engine, Render, Runner, World, Bodies, Body, Events, Constraint } = Matter;const {shmallowCount");
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
const SNAP_DISTANCE = 26;

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

let timerId = null;
let stabilityId = null;
let previewX = window.innerWidth / 2;
let previewY = window.innerHeight / 2;
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
  statusEl.innerText = "Click anywhere outside the panel to place material. Press M to switch material.";
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

function spaghettiEndpoints(stick) {
  return [
    { localX: -SPAGHETTI_LENGTH / 2, world: worldPointOnBody(stick, -SPAGHETTI_LENGTH / 2, 0) },
    { localX:  SPAGHETTI_LENGTH / 2, world: worldPointOnBody(stick,  SPAGHETTI_LENGTH / 2, 0) }
  ];
}

function addGlue(connector, stick, localXOnStick) {
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
  const endpoints = spaghettiEndpoints(stick);

  for (const endpoint of endpoints) {
    for (const connector of connectorBodies) {
      if (distance(endpoint.world, connector.position) <= SNAP_DISTANCE) {
        addGlue(connector, stick, endpoint.localX);
      }
    }
  }
}

function attachConnectorToNearbySpaghetti(connector) {
  for (const stick of spaghettiBodies) {
    const endpoints = spaghettiEndpoints(stick);
    for (const endpoint of endpoints) {
      if (distance(endpoint.world, connector.position) <= SNAP_DISTANCE) {
        addGlue(connector, stick, endpoint.localX);
      }
    }
  }
}

/* Placement */
function placeSpaghetti(x, y) {
  if (timeLeft <= 0 || spaghettiLeft <= 0 || gameEnded) return;

  const stick = createSpaghetti(x, y);
  spaghettiBodies.push(stick);
  World.add(engine.world, stick);

  attachSpaghettiToNearbyConnectors(stick);

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

  attachConnectorToNearbySpaghetti(connector);

  connectorLeft--;
  updateScore();
  updateHud();
  statusEl.innerText = "Connector marshmallow placed and glued to nearby spaghetti.";
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
function attachHandlers() {
  canvas.onmousemove = (event) => {
    const rect = canvas.getBoundingClientRect();
    previewX = event.clientX - rect.left;
    previewY = event.clientY - rect.top;
  };

  canvas.onclick = (event) => {
    if (gameEnded) return;

    const canvasRect = canvas.getBoundingClientRect();
    const x = event.clientX - canvasRect.left;
    const y = event.clientY - canvasRect.top;

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

    if (timeLeft > 0) {
      if (buildMode === "spaghetti") {
        placeSpaghetti(x, y);
      } else {
        placeConnector(x, y);
      }
    } else {
      placeFinalMarshmallow(x, y);
    }
  };

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

  if (!keyboardAttached) {
    keyboardAttached = true;
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
  }

  Events.on(render, "afterRender", () => {
    if (gameEnded) return;
    if (timeLeft <= 0) return;

    const ctx = render.context;

    // Don’t draw preview inside HUD
    const hudRect = hud.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const insideHud =
      previewX + canvasRect.left >= hudRect.left &&
      previewX + canvasRect.left <= hudRect.right &&
      previewY + canvasRect.top >= hudRect.top &&
      previewY + canvasRect.top <= hudRect.bottom;

    if (insideHud) return;

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
    } else if (buildMode === "connector" && connectorLeft > 0) {
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

/* DOM */
const canvas = document.getElementById("game");
const hud = document.getElementById("hud");

const timeEl = document.getElementById("time");
const countEl = document.getElementById("count");
