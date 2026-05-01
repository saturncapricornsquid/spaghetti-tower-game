const {
  Engine, Render, Runner, World, Bodies,
  Constraint, Mouse, MouseConstraint, Composite,
  Events, Body, Vector, Query
} = Matter;

/* ================= CONFIG ================= */

const GAME_DURATION = 10 * 60; // seconds
const PX_PER_CM = 4;
const TOP_TOLERANCE_PX = 3;

/* ================= DOM ================= */

const canvas = document.getElementById("game");
const toastEl = document.getElementById("toast");
const timerEl = document.getElementById("timer");
const materialsEl = document.getElementById("materials");
const heightEl = document.getElementById("height");

const teamNameInput = document.getElementById("teamName");
const brandTeamLabel = document.getElementById("brandTeamLabel");
const teamsTableBody = document.getElementById("teamsTableBody");

const glueBtn = document.getElementById("glueBtn");
const addSpaghettiBtn = document.getElementById("addSpaghettiBtn");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const resetBtn = document.getElementById("resetBtn");

/* ================= STATE ================= */

let glueMode = false;
let glueFirst = null;

let running = false;
let paused = true;
let gameEnded = false;
let timeLeft = GAME_DURATION;

let spaghetti = [];
let joints = [];
let teams = [];

let selectedBody = null;
let ground, topPiece;
let currentHeightCm = 0;

/* ================= ENGINE ================= */

const engine = Engine.create();
engine.gravity.y = 1;
const world = engine.world;

const render = Render.create({
  canvas,
  engine,
  options: {
    width: window.innerWidth,
    height: window.innerHeight,
    wireframes: false,
    background: "transparent"
  }
});

Render.run(render);
Runner.run(Runner.create(), engine);

/* ================= HELPERS ================= */

function setToast(html) {
  if (toastEl) toastEl.innerHTML = html;
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, "0");
  return `${m}:${sec}`;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;"
  }[m]));
}

function updateUI() {
  timerEl.textContent = `⏱ ${formatTime(timeLeft)}`;
  materialsEl.textContent = spaghetti.length;
  heightEl.textContent = `${currentHeightCm} cm`;
}

function getTeamName() {
  const v = (teamNameInput?.value || "").trim();
  return v || "Unnamed team/person";
}

function syncTeamLabel() {
  brandTeamLabel.textContent = `Team/Person: ${getTeamName()}`;
}

if (teamNameInput) {
  teamNameInput.addEventListener("input", syncTeamLabel);
}
syncTeamLabel();

/* ================= WORLD SETUP ================= */

function createGround() {
  if (ground) World.remove(world, ground);
  ground = Bodies.rectangle(
    window.innerWidth / 2,
    window.innerHeight - 20,
    window.innerWidth,
    40,
    { isStatic: true }
  );
  World.add(world, ground);
}

function createTopPiece() {
  if (topPiece) World.remove(world, topPiece);
  topPiece = Bodies.circle(
    window.innerWidth / 2,
    window.innerHeight / 2 - 120,
    18,
    { label: "top", render: { fillStyle: "#ffd6e7" } }
  );
  World.add(world, topPiece);
}

function resetWorld() {
  Composite.clear(world);
  spaghetti = [];
  joints = [];
  selectedBody = null;
  glueFirst = null;

  createGround();
  createTopPiece();
  updateUI();
}

resetWorld();

/* ================= SPAGHETTI ================= */

function addSpaghetti(x, y) {
  const stick = Bodies.rectangle(x, y, 90, 7, {
    friction: 0.8,
    restitution: 0.02,
    frictionAir: 0.03,
    render: { fillStyle: "#7a3f00" }
  });
  spaghetti.push(stick);
  World.add(world, stick);
  selectedBody = stick;
  updateUI();
}

/* ================= MOUSE ================= */

const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
  mouse,
  constraint: { stiffness: 0.2, render: { visible: false } }
});
World.add(world, mouseConstraint);
render.mouse = mouse;

function selectBodyAtMouse() {
  const bodies = Composite.allBodies(world).filter(b => b !== ground);
  const hits = Query.point(bodies, mouse.position);
  selectedBody = hits.length ? hits[0] : null;
  return selectedBody;
}

canvas.addEventListener("mousedown", () => {
  if (!running || paused || gameEnded) return;

  const hit = selectBodyAtMouse();

  if (!glueMode && !hit) {
    addSpaghetti(mouse.position.x, mouse.position.y);
    setToast("Spaghetti added.");
    return;
  }

  if (glueMode && hit) {
    if (!glueFirst) {
      glueFirst = hit;
      setToast("Glue: stick A selected.");
      return;
    }
    if (hit !== glueFirst) {
      const weld = Constraint.create({
        bodyA: glueFirst,
        bodyB: hit,
        stiffness: 0.99,
        damping: 0.3
      });
      joints.push(weld);
      World.add(world, weld);
      glueFirst = null;
      setToast("Glue applied. Turn Glue OFF to rotate again.");
    }
  }
});

Events.on(mouseConstraint, "startdrag", e => {
  selectedBody = e.body;
});

/* ================= ROTATION ================= */

window.addEventListener("wheel", e => {
  if (!selectedBody || glueMode || paused || gameEnded) return;
  e.preventDefault();
  Body.rotate(selectedBody, e.deltaY * 0.002);
}, { passive: false });

window.addEventListener("keydown", e => {
  if (!selectedBody || glueMode || paused || gameEnded) return;
  if (e.key === "q" || e.key === "Q") Body.rotate(selectedBody, -0.05);
  if (e.key === "e" || e.key === "E") Body.rotate(selectedBody, 0.05);
});

/* ================= HIGHLIGHT ================= */

Events.on(render, "afterRender", () => {
  if (!selectedBody || selectedBody.circleRadius) return;
  const ctx = render.context;
  const v = selectedBody.vertices;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(v[0].x, v[0].y);
  for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
  ctx.closePath();
  ctx.strokeStyle = "rgba(230,0,0,0.9)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
});

/* ================= HEIGHT ================= */

Events.on(engine, "afterUpdate", () => {
  const bodies = Composite.allBodies(world).filter(b => b !== ground);
  if (!bodies.length) return;

  const highest = Math.min(...bodies.map(b => b.bounds.min.y));
  const floorY = ground.bounds.min.y;
