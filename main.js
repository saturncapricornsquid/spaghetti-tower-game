// ==============================
// MATTER ALIASES (MUST BE FIRST)
// ==============================
const {
  Engine,
  Render,
  Runner,
  World,
  Bodies,
  Body,
  Constraint,
  Mouse,
  MouseConstraint,
  Composite,
  Events,
  Bounds
} = Matter;

// ==============================
// CANVAS + ENGINE + RENDER (MUST BE BEFORE USING world/Bodies/etc.)
// ==============================
const canvas = document.getElementById("game");

const engine = Engine.create();
const world = engine.world;

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

const runner = Runner.create();
Runner.run(runner, engine);

// ==============================
// GAME STATE
// ==============================
let spaghetti = [];
let glue = [];

let selectedBody = null;
let lastBody = null;

let score = 0;
let maxHeight = 0;

let gameEnded = false;
let timerInterval = null;

// Timer (define BEFORE using timeLeft)
const GAME_DURATION = 10 * 60; // seconds
let timeLeft = GAME_DURATION;

// ==============================
// GROUND (now world/Bodies exist)
// ==============================
let ground = Bodies.rectangle(
  window.innerWidth / 2,
  window.innerHeight - 20,
  window.innerWidth,
  40,
  { isStatic: true, render: { fillStyle: "#222" } }
);
World.add(world, ground);

// ==============================
// MOUSE CONTROL (render/canvas exist now)
// ==============================
const mouse = Mouse.create(render.canvas);

const mouseConstraint = MouseConstraint.create(engine, {
  mouse,
  constraint: {
    stiffness: 0.2,
    render: { visible: false }
  }
});

World.add(world, mouseConstraint);
render.mouse = mouse; // keep mouse in sync with renderer (recommended)

