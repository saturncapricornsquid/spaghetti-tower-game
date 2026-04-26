const { Engine, World, Bodies, Render, Events } = Matter;

/* =========================
   Canvas and physics setup
========================= */
const canvas = document.getElementById("game");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const engine = Engine.create();
engine.world.gravity.y = 1;

const render = Render.create({
  canvas: canvas,
  engine: engine,
  options: {
    width: canvas.width,
    height: canvas.height,
    wireframes: false,
    background: "#f4f4f4"
  }
});

Render.run(render);

/* Manual engine runner */
function runEngine() {
  Engine.update(engine, 1000 / 60);
  requestAnimationFrame(runEngine);
}
runEngine();

/* =========================
   Ground
========================= */
const groundHeight = 80;
const groundY = canvas.height - groundHeight / 2;

const ground = Bodies.rectangle(
  canvas.width / 2,
  groundY,
  canvas.width,
  groundHeight,
  {
    isStatic: true,
    label: "ground",
