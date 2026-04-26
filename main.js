// DOM
 modeEl = document.getElementById("mode");const canvas = document.getElementById("game");
const toggleBtn = document.getElementById("toggle");
const rotateBtn = document.getElementById("rotate");
const resetBtn = document.getElementById("reset");

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
  console.log("Mode:", mode);
});

rotateBtn.addEventListener("click", () => {
  rotation += 15;
  console.log("Rotation:", rotation);
  alert("Rotate clicked");
});

resetBtn.addEventListener("click", () => {
  mode = "spaghetti";
  rotation = 0;
  modeEl.textContent = mode;
  alert("Reset clicked");
});

console.log("✅ main.js loaded and running");
