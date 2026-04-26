const { Engine, Render, Runner, World, Bodies, Events } = Matter;

/* =========================
   Basic setup
========================= */
const canvas = document.getElementById("game");
const timeEl = document.getElementById("time");
const countEl = document.getElementById("count");
const scoreEl = document.getElementById("score");
const statusEl = document.getElementById("status");
const resetBtn = document.getElementById("add");

let engine, render, runner;
let ground, leftWall, rightWall;
let spaghettiBodies = [];
let marshmallowBody = null;

let spaghettiLeft = 20;
let marshmallowPlaced = false;
let gameEnded = false;
let timeLeft = 30; // shortened for testing
let countdownInterval = null;
let stabilityInterval = null;
let stabilityRemaining = 10;
let score = 0;

const HUD_BLOCK_WIDTH = 320;
const HUD_BLOCK_HEIGHT = 220;
const GROUND_HEIGHT = 80;

/* =========================
   Initialise game
========================= */
function initGame() {
  clearTimers();

  spaghettiBodies = [];
  marshmallowBody = null;
  spaghettiLeft = 20;
  marshmallowPlaced = false;
  gameEnded = false;
  timeLeft = 30; // set back to 18 * 60 later if you want full length
  stabilityRemaining = 10;
  score = 0;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  /* Clear existing render canvas if reinitialising */
  if (render && render.canvas) {
    render.canvas.remove();
    render.textures = {};
  }

  /* Recreate canvas element because Matter attaches to it */
  const oldCanvas = document.getElementById("game");
  const newCanvas = oldCanvas.cloneNode(false);
  oldCanvas.parentNode.replaceChild(newCanvas, oldCanvas);

  /* Update reference */
  window.gameCanvas = document.getElementById("game");

  engine = Engine.create();
  engine.world.gravity.y = 1;

  render = Render.create({
    canvas: window.gameCanvas,
    engine: engine,
    options: {
      width: window.innerWidth,
      height: window.innerHeight,
      wireframes: false,
      background: "#f4f4f4"
    }
  });

  runner = Runner.create();

  Render.run(render);
  Runner.run(runner, engine);

  createWorldBounds();
  wireCanvasClick();
  wireResetButton();
  wireFailCheck();

  updateHud();
  startCountdown();
}

function createWorldBounds() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  ground = Bodies.rectangle(
    width / 2,
    height - GROUND_HEIGHT / 2,
    width,
    GROUND_HEIGHT,
    {
      isStatic: true,
      label: "ground",
      render: { fillStyle: "#666" }
    }
  );

  leftWall = Bodies.rectangle(
    -25,
    height / 2,
    50,
    height,
    { isStatic: true, render: { visible: false } }
  );

  rightWall = Bodies.rectangle(
    width + 25,
    height / 2,
    50,
    height,
    { isStatic: true, render: { visible: false } }
  );

  World.add(engine.world, [ground, leftWall, rightWall]);
}

/* =========================
   Factories
========================= */
function createSpaghetti(x, y) {
  return Bodies.rectangle(x, y, 140, 6, {
    label: "spaghetti",
    density: 0.0004,
    friction: 0.4,
    restitution: 0.1,
    render: { fillStyle: "#f4d03f" }
  });
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
   Input
========================= */
function wireCanvasClick() {
  window.gameCanvas.onclick = function (event) {
    if (gameEnded) return;

    const rect = window.gameCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    /* Ignore clicks on HUD area */
    if (x < HUD_BLOCK_WIDTH && y < HUD_BLOCK_HEIGHT) return;

    if (!marshmallowPlaced && timeLeft > 0) {
      if (spaghettiLeft <= 0) {
        statusEl.innerText = "No spaghetti left. Wait for the marshmallow phase.";
        return;
      }

      const stick = createSpaghetti(x, y);
      spaghettiBodies.push(stick);
      World.add(engine.world, stick);

      spaghettiLeft--;
      updateScore();
      updateHud();
      statusEl.innerText = "Spaghetti placed. Keep building.";
      return;
    }

    if (!marshmallowPlaced && timeLeft <= 0) {
      marshmallowBody = createMarshmallow(x, y);
      marshmallowPlaced = true;
      World.add(engine.world, marshmallowBody);

      statusEl.innerText = "Marshmallow placed. Tower must stand for 10 seconds...";
      startStabilityCheck();
    }
  };
}

function wireResetButton() {
  resetBtn.onclick = function () {
    initGame();
  };
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
        statusEl.innerText = "Time is up! Click in the grey area to place the marshmallow.";
      }
    }
  }, 1000);
}

function startStabilityCheck() {
  stabilityRemaining = 10;
  updateHud();

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

  const towerHeight = (window.innerHeight - GROUND_HEIGHT) - topY;
  score = Math.max(0, Math.round(towerHeight));
  scoreEl.innerText = String(score);
}

function updateHud() {
  const mins = Math.floor(timeLeft / 60);
  const secs = String(timeLeft % 60).padStart(2, "0");
  timeEl.innerText = `${String(mins).padStart(2, "0")}:${secs}`;
  countEl.innerText = String(spaghettiLeft);
  scoreEl.innerText = String(score);
}

/* =========================
   Fail / success
========================= */
function wireFailCheck() {
  Events.on(engine, "afterUpdate", () => {
    if (gameEnded) return;
    if (!marshmallowPlaced) return;

    updateScore();

    if (hasTowerFailed()) {
      endGame(false);
    }
  });
}

function hasTowerFailed() {
  if (!marshmallowBody) return false;

  const floorLine = window.innerHeight - GROUND_HEIGHT - 5;

  /* Fail if marshmallow reaches the floor zone */
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
window.addEventListener("resize", () => {
  initGame();
});

/* =========================
   Start
========================= */
initGame();
