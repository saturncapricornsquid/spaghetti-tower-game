const {
  Engine, Render, Runner, World, Bodies,
  Constraint, Mouse, MouseConstraint, Composite,
  Events, Bounds, Body
} = Matter;

const MAX_SPAGHETTI = 20;
const GAME_DURATION = 10 * 60;

const canvas = document.getElementById("game");
const statusEl = document.getElementById("status");
const timerEl = document.getElementById("timer");

let glueMode = false;
let timeLeft = GAME_DURATION;
let paused = false;
let gameEnded = false;

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

let ground;
let spaghetti = [];
let joints = [];
let topPiece= null;
let selectedBody = null;

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

createGround();

const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
  mouse,
  constraint: { stiffness: 0.2, render: { visible: false } }
});

World.add(world, mouseConstraint);
render.mouse = mouse;

Events.on(mouseConstraint, "startdrag", e => {
  selectedBody = e.body;
});

Events.on(mouseConstraint, "enddrag", () => {
  selectedBody = null;
});

/* ✅ Rotate spaghetti like in real life */
window.addEventListener("wheel", e => {
  if (!selectedBody || paused || gameEnded) return;
  Body.rotate(selectedBody, e.deltaY * 0.002);
});

window.addEventListener("keydown", e => {
  if (!selectedBody || paused || gameEnded) return;
  if (e.key === "q") Body.rotate(selectedBody, -0.05);
  if (e.key === "e") Body.rotate(selectedBody, 0.05);
});

/* ✅ Glue button */
document.getElementById("glueBtn").onclick = () => {
  glueMode = !glueMode;
  document.getElementById("glueBtn").textContent =
    glueMode ? "Glue ON" : "Glue (tape / string)";
};

/* ✅ Placement logic */
canvas.addEventListener("mousedown", () => {
  if (paused || gameEnded) return;
  const pos = mouse.position;
  const bodies = Composite.allBodies(world).filter(b => b !== ground);
  const hit = bodies.find(b => Bounds.contains(b.bounds, pos));

  if (!hit && spaghetti.length < MAX_SPAGHETTI) {
    const s = Bodies.rectangle(pos.x, pos.y, 80, 6);
    spaghetti.push(s);
    World.add(world, s);
    return;
  }

  if (glueMode && selectedBody && hit && hit !== selectedBody) {
    const joint = Constraint.create({
      bodyA: selectedBody,
      bodyB: hit,
      stiffness: 0.8
    });
    joints.push(joint);
    World.add(world, joint);
  }
});

/* ✅ Timer */
setInterval(() => {
  if (paused || gameEnded) return;
  timeLeft--;
  timerEl.textContent = `⏱ ${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, "0")}`;
  if (timeLeft <= 0) {
    gameEnded = true;
    paused = true;
  }
}, 1000);

/* ✅ Resize fix (Matter.js safe) */
window.addEventListener("resize", () => {
  render.canvas.width = window.innerWidth;
  render.canvas.height = window.innerHeight;
  render.options.width = window.innerWidth;
  render.options.height = window.innerHeight;
  createGround();
});
