const { Engine, Render, Runner, World, Bodies, Events, Body } = Matter;

/* =========================
   DOM references
========================= */
const canvas = document.getElementById("game");
const timeEl = document.getElementById("time");
const countEl = document.getElementById("count");
const scoreEl = document.getElementById("score");
const rotationEl = document.getElementById("rotation");
const statusEl = document.getElementById("status");
const addBtn = document.getElementById("add");
const resetBtn = document.getElementById("reset");

/* =========================
   Constants
========================= */
const GROUND_HEIGHT = 80;
const HUD_SAFE_WIDTH = 360;
const HUD_SAFE_HEIGHT = 260;
const SPAGHETTI_LENGTH = 140;
const SPAGHETTI_THICKNESS = 6;

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
let stabilityRemaining = 10;
let score = 0;

/* Placement preview */
let previewX = window.innerWidth / 2;
let previewY = window.innerHeight / 2;
let nextRotation = 0; // in radians

/* =========================
   Init
========================= */
function initGame() {
  clearTimers();

  spaghettiBodies = [];
  marshmallowBody = null;
  spaghettiLeft = 20;
  marshmallowPlaced = false;
  gameEnded = false;
  timeLeft = 30;
  stabilityRemaining = 10;
  score = 0;
  nextRotation = 0;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  if (render) Render.stop(render);
  if (runner) Runner.stop(runner);

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
  attachEvents();

  updateHud();
  statusEl.innerText = "Move your mouse in the grey area. Press R to rotate. Click to place spaghetti.";

  Render.run(render);
  Runner.run(runner, engine);

  startCountdown();
  startPreviewLoop();
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
    { isStatic: true, render: { visible: false } }
  );

  rightWall = Bodies.rectangle(
    canvas.width + 25,
    canvas.height / 2,
    50,
    canvas.height,
    { isStatic: true, render: { visible: false } }
  );

  World.add(engine.world, [ground, leftWall, rightWall]);
}

/* =========================
   Factories
========================= */
function createSpaghetti(x, y, angle = 0) {
  const body = Bodies.rectangle(x, y, SPAGHETTI_LENGTH, SPAGHETTI_THICKNESS, {
    label: "spaghetti",
    density: 0.0004,
    friction: 0.4,
    restitution: 0.1,
    render: { fillStyle: "#f4d03f" }
  });

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

  const stick = createSpaghetti(x, y, angle);
  spaghettiBodies.push(stick);
  World.add(engine.world, stick);

  spaghettiLeft--;
  updateScore();
  updateHud();
  statusEl.innerText = "Spaghetti placed. Keep building.";
}

function placeMarshmallow(x, y) {
  if (gameEnded) return;
  if (marshmallowPlaced) return;
  if (timeLeft > 0) {
    statusEl.innerText = "You can only place the marshmallow when the timer reaches 0.";
    return;
  }

  marshmallowBody = createMarshmallow(x, y);
  marshmallowPlaced = true;
  World.add(engine.world, marshmallowBody);

  statusEl.innerText = "Marshmallow placed. Tower must stand for 10 seconds...";
  startStabilityCheck();
}

/* =========================
   Input wiring
========================= */
let eventsAttached = false;

function attachEvents() {
  if (eventsAttached) return;
  eventsAttached = true;

  addBtn.onclick = () => {
    if (gameEnded) return;

    if (timeLeft > 0) {
      placeSpaghetti(canvas.width / 2, 120, nextRotation);
    } else if (!marshmallowPlaced) {
      placeMarshmallow(canvas.width / 2, 90);
    }
  };

  resetBtn.onclick = () => {
    eventsAttached = false;
    initGame();
  };

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
      placeSpaghetti(x, y, nextRotation);
    } else if (!marshmallowPlaced) {
      placeMarshmallow(x, y);
    }
  };

  window.onkeydown = (event) => {
    if (event.key.toLowerCase() === "r") {
      nextRotation += Math.PI / 12; // 15 degrees
      rotationEl.innerText = `${Math.round(nextRotation * 180 / Math.PI) % 360}°`;
    }
  };

  Events.on(engine, "afterUpdate", () => {
    if (gameEnded) return;
    if (!marshmallowPlaced) return;

    updateScore();

    if (hasTowerFailed()) {
      endGame(false);
    }
  });
}

/* =========================
   Preview drawing
========================= */
function startPreviewLoop() {
  function drawPreview() {
    if (!gameEnded && timeLeft > 0 && spaghettiLeft > 0) {
      const ctx = canvas.getContext("2d");

      // redraw preview after Matter render
      requestAnimationFrame(() => {
        const ctx2 = canvas.getContext("2d");

        if (previewX >= HUD_SAFE_WIDTH || previewY >= HUD_SAFE_HEIGHT) {
          ctx2.save();
          ctx2.translate(previewX, previewY);
          ctx2.rotate(nextRotation);
          ctx2.globalAlpha = 0.45;
          ctx2.fillStyle = "#d4ac0d";
          ctx2.fillRect(
            -SPAGHETTI_LENGTH / 2,
            -SPAGHETTI_THICKNESS / 2,
            SPAGHETTI_LENGTH,
            SPAGHETTI_THICKNESS
          );
          ctx2.restore();
        }

        drawPreview();
      });
    }
  }

  drawPreview();
}

/* =========================
   Timer
========================= */
function startCountdown() {
  countdownInterval = setInterval(() => {
    if (gameEnded) return;

    if (timeLeft > 0) {
      timeLeft--;
      updateHud();

      if (timeLeft === 0) {
        statusEl.innerText = "Time is up! Click in the grey area or press “Add spaghetti (centre)” to place the marshmallow.";
      }
    }
  }, 1000);
}

function startStabilityCheck() {
  stabilityRemaining = 10;

  stabilityInterval = setInterval(() => {
    if (gameEnded) return;

    stabilityRemaining--;
    updateScore();
    updateHud();

    if (stabilityRemaining > 0) {
      statusEl.innerText = `Tower must stand for ${stabilityRemaining} seconds...`;
    } else {
      endGame(true);
    }
  }, 1000);
}

function clearTimers() {
  if (countdownInterval) clearInterval(countdownInterval);
  if (stabilityInterval) clearInterval(stabilityInterval);
}

/* =========================
   Score
========================= */
function updateScore() {
  if (spaghettiBodies.length === 0) {
    score = 0;
    scoreEl.innerText = "0";
    return;
  }

  let topY = Infinity;

  for (const body of spaghettiBodies) {
    if (body && body.bounds && body.bounds.min.y < topY) {
      topY = body.bounds.min.y;
    }
  }

  const towerHeight = (canvas.height - GROUND_HEIGHT) - topY;
  score = Math.max(0, Math.round(towerHeight));
  scoreEl.innerText = String(score);
}

function updateHud() {
  const mins = Math.floor(timeLeft / 60);
  const secs = String(timeLeft % 60).padStart(2, "0");
  timeEl.innerText = `${String(mins).padStart(2, "0")}:${secs}`;
  countEl.innerText = String(spaghettiLeft);
  scoreEl.innerText = String(score);
  rotationEl.innerText = `${Math.round(nextRotation * 180 / Math.PI) % 360}°`;
}

/* =========================
   Fail / success
========================= */
function hasTowerFailed() {
  if (!marshmallowBody) return false;

  const floorLine = canvas.height - GROUND_HEIGHT - 5;
  if (marshmallowBody.position.y >= floorLine) return true;

  return false;
}

function endGame(success) {
  if (gameEnded) return;

  gameEnded = true;
  clearTimers();
  updateScore();
  updateHud();

  if (success) {
    statusEl.innerText = `✅ Success! Tower stood for 10 seconds. Final score: ${score}`;
  } else {
    statusEl.innerText = `❌ Tower failed. Final score: ${score}`;
  }
}

/* =========================
   Resize
========================= */
window.onresize = () => {
  eventsAttached = false;
  initGame();
};

/* =========================
   Start
========================= */
initGame();
