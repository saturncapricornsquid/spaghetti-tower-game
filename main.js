// DOM");
const rotationEl = document.getElementById("rotation");
const toggleBtn = document.getElementById("toggle");
const rotateBtn = document.getElementById("rotate");
const resetBtn = document.getElementById("reset");
const statusEl = document.getElementById("status");
const canvas = document.getElementById("game");

// Matter.js
const { Engine, Render, Runner, World, Bodies } = Matter;

// State
let mode = "spaghetti";
let rotation = 0;

// Engine
const engine = Engine.create();
engine.world.gravity.y = 0;

const render = Render.create({
  canvas,
  engine,
  options: {
    width: window.innerWidth,
    height: window.innerHeight,
    wireframes: false,
    background: "#f4f4f4"
  }
});

const runner = Runner.create();

// Ground
const ground = Bodies.rectangle(
  window.innerWidth / 2,
  window.innerHeight - 40,
  window.innerWidth,
  80,
  { isStatic: true }
);

World.add(engine.world, ground);

Render.run(render);
Runner.run(runner, engine);

// Buttons
toggleBtn.addEventListener("click", () => {
  mode = mode === "spaghetti" ? "marshmallow" : "spaghetti";
  modeEl.textContent = mode;
  statusEl.textContent = `Mode switched to ${mode}`;
  console.log("Mode:", mode);
});

rotateBtn.addEventListener("click", () => {
  rotation += 15;
  rotationEl.textContent = rotation;
  statusEl.textContent = `Rotation is now ${rotation}°`;
  console.log("Rotation:", rotation);
});

resetBtn.addEventListener("click", () => {
  mode = "spaghetti";
  rotation = 0;
  modeEl.textContent = mode;
  rotationEl.textContent = rotation;
  statusEl.textContent = "Reset complete";
  console.log("Reset");
});

console.log("✅ main.js loaded successfully");
