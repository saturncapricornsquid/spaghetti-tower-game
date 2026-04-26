const { Engine, World, Bodies, Render } = Matter;

/* Canvas setup */
const canvas = document.getElementById("game");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

/* Physics engine */
const engine = Engine.create();
engine.world.gravity.y = 1;

/* Renderer */
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

Engine.run(engine);
Render.run(render);

/* Ground */
const ground = Bodies.rectangle(
  canvas.width / 2,
  canvas.height - 40,
  canvas.width,
  80,
  { isStatic: true, render: { fillStyle: "#666" } }
);

World.add(engine.world, ground);

/* Game state */
let spaghettiLeft = 20;
document.getElementById("count").innerText = spaghettiLeft;

/* Spaghetti factory */
function createSpaghetti() {
  return Bodies.rectangle(
    canvas.width / 2,
    100,
    140,   // length
    6,     // thickness
    {
      density: 0.0004,
      friction: 0.4,
      restitution: 0.1,
      render: { fillStyle: "#f4d03f" }
    }
  );
}

/* Button action */
document.getElementById("add").onclick = () => {
  if (spaghettiLeft <= 0) return;

  const stick = createSpaghetti();
  World.add(engine.world, stick);

  spaghettiLeft--;
  document.getElementById("count").innerText = spaghettiLeft;
};
let timeLeft = 18 * 60;

setInterval(() => {
  if (timeLeft <= 0) return;

  timeLeft--;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = String(timeLeft % 60).padStart(2, "0");
  document.getElementById("time").innerText = `${minutes}:${seconds}`;

  if (timeLeft === 0) {
    document.getElementById("add").disabled = true;
  }
}, 1000);
