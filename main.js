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
  {
    isStatic: true,
    render: { fillStyle: "#666" }
  }
);

