// Matter.js aliases
const {
  Engine, Render, Runner, World, Bodies,
  Constraint, Mouse, MouseConstraint, Composite, Events, Bounds
} = Matter;

// Canvas & engine
const canvas = document.getElementById("game");
const engine = Engine.create();
const world = engine.world;

// Renderer
const render = Render.create({
  canvas,
  engine,
  options: {
    width: window.innerWidth,
    height: window.innerHeight,
    wireframes: false,
    background: "#f5f5f5"
  }
});
Render.run(render);
Runner.run(Runner.create(), engine);

// --- GAME SETTINGS ---
const MAX_SPAGHETTI = 20;
const GAME_DURATION = 10 * 60; // ✅ 10 minutes

// State
let spaghettiCount = 0;
let spaghetti = [];
let joints = [];
let lastBody = null;
let selectedBody = null;
let marshmallowPlaced = false;

let timeLeft = GAME_DURATION;
let gameEnded = false;

// Ground
const ground = Bodies.rectangle(
  window.innerWidth / 2,
  window.innerHeight - 20,
  window.innerWidth,
  40,
  { isStatic: true }
);
World.add(world, ground);

// Mouse control
const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, { mouse });
World.add(world, mouseConstraint);
render.mouse = mouse;

Events.on(mouseConstraint, "startdrag", e => selectedBody = e.body);
Events.on(mouseConstraint, "enddrag", () => selectedBody = null);

// UI
const statusEl = document.getElementById("status");
const timerEl = document.getElementById("timer");

function updateUI() {
  statusEl.innerHTML =
    `Spaghetti used: ${spaghettiCount} / ${MAX_SPAGHETTI}<br>` +
    `Marshmallow: ${marshmallowPlaced ? "placed ✅" : "not placed"}`;

  const m = Math.floor(timeLeft / 60);
  const s = String(timeLeft % 60).padStart(2, "0");
  timerEl.innerHTML = `⏱ ${m}:${s}`;
}

// Add spaghetti
function addSpaghetti(x, y) {
  if (spaghettiCount >= MAX_SPAGHETTI || gameEnded) return;

  const stick = Bodies.rectangle(x, y, 70, 5, {
    friction: 0.6,
    restitution: 0.2,
    render: { fillStyle: "#c58a3d" }
  });

  spaghetti.push(stick);
  spaghettiCount++;
  World.add(world, stick);
}

// Add joint (tape / string)
function addJoint(a, b) {
  if (!a || !b || a === b) return;

  const joint = Constraint.create({
    bodyA: a,
    bodyB: b,
    stiffness: 0.8,
    length: 0,
    render: { strokeStyle: "#ffd400", lineWidth: 2 }
  });

  joints.push(joint);
  World.add(world, joint);
}

// Marshmallow (heavy!)
function placeMarshmallow(x, y) {
  if (marshmallowPlaced || gameEnded) return;

  const marshmallow = Bodies.circle(x, y, 14, {
    density: 0.02,
    render: { fillStyle: "#ffffff" }
  });

  marshmallowPlaced = true;
  World.add(world, marshmallow);
}

// Interaction
canvas.addEventListener("mousedown", () => {
  if (gameEnded) return;

  const pos = mouse.position;
  const bodies = Composite.allBodies(world);
  const clicked = bodies.find(b => Bounds.contains(b.bounds, pos));

  if (!clicked && !marshmallowPlaced) {
    addSpaghetti(pos.x, pos.y);
    lastBody = null;
  } else if (!clicked && spaghettiCount >= MAX_SPAGHETTI) {
    placeMarshmallow(pos.x, pos.y);
  } else if (clicked) {
    if (lastBody && lastBody !== clicked) {
      addJoint(lastBody, clicked);
      lastBody = null;
    } else {
      lastBody = clicked;
    }
  }
});

// Timer
updateUI();
const timer = setInterval(() => {
  if (gameEnded) return;

  timeLeft--;
  updateUI();

  if (timeLeft <= 0) endGame();
}, 1000);

// End game & debrief
function endGame() {
  gameEnded = true;
  clearInterval(timer);

  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position:fixed; inset:0;
    background:rgba(0,0,0,0.85);
    color:white;
    display:flex;
    align-items:center;
    justify-content:center;
    text-align:center;
    padding:20px;
    z-index:99;
  `;

  overlay.innerHTML = `
    <div style="max-width:640px">
      <h1>🏆 Time’s up!</h1>
      <p>The structure must stand on its own with the marshmallow on top.</p>

      <h3>Debrief — Team Roles</h3>
      <ul style="text-align:left">
        <li>Who naturally took on leadership or coordination roles?</li>
        <li>Who focused on experimentation versus planning?</li>
        <li>What assumptions did the team make early on?</li>
        <li>What would you do differently with more time?</li>
        <li>How does this reflect how your team works day‑to‑day?</li>
      </ul>

      <p><em>Inspired by the Marshmallow Challenge (Tom Wujec)</em></p>
      <button onclick="location.reload()">Run again</button>
    </div>
  `;

  document.body.appendChild(overlay);
}
