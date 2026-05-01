console.log("✅ main.js loaded");

const {
  Engine, Render, Runner, World, Bodies,
  Mouse, MouseConstraint
} = Matter;

const canvas = document.getElementById("game");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const addBtn = document.getElementById("addSpaghettiBtn");
const toast = document.getElementById("toast");

console.log("✅ Buttons:", startBtn, resetBtn, addBtn);

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const engine = Engine.create();
engine.gravity.y = 1;
const world = engine.world;

const render = Render.create({
  canvas,
  engine,
  options: {
    width: canvas.width,
    height: canvas.height,
    wireframes: false,
    background: "#fafafa"
  }
});

Render.run(render);
Runner.run(Runner.create(), engine);

const ground = Bodies.rectangle(
  canvas.width / 2,
  canvas.height - 20,
  canvas.width,
  40,
  { isStatic: true }
);
World.add(world, ground);

const mouse = Mouse.create(canvas);
const mouseConstraint = MouseConstraint.create(engine, {
  mouse,
  constraint: { stiffness: 0.05 }
});
World.add(world, mouseConstraint);
render.mouse = mouse;

function addSpaghetti() {
  const stick = Bodies.rectangle(
    canvas.width / 2,
    canvas.height - 200,
    130,
    10,
    { friction: 0.9, density: 0.002 }
  );
  World.add(world, stick);
}

// ✅ ALL BUTTONS NOW WORK

startBtn.onclick = () => {
  console.log("▶ START clicked");
  toast.textContent = "Game started";
  addSpaghetti();
};

addBtn.onclick = () => {
  console.log("+ ADD clicked");
  addSpaghetti();
};

resetBtn.onclick = () => {
  console.log("↺ RESET clicked");
  World.clear(world, false);
  World.add(world, ground);
  World.add(world, mouseConstraint);
  toast.textContent = "Reset";
};
``
