document.addEventListener("DOMContentLoaded", () => {

  const {
    Engine, Render, Runner, World, Bodies,
    Mouse, MouseConstraint, Composite, Body
  } = Matter;

  const canvas = document.getElementById("game");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const toast = document.getElementById("toast");

  const startBtn = document.getElementById("startBtn");
  const addBtn = document.getElementById("addSpaghettiBtn");

  let running = false;

  const engine = Engine.create();
  const world = engine.world;
  engine.gravity.y = 1;

  const render = Render.create({
    canvas,
    engine,
    options: {
      width: canvas.width,
      height: canvas.height,
      wireframes: false,
      background: "#f9fafb"
    }
  });

  Render.run(render);
  Runner.run(Runner.create(), engine);

  // Ground
  const ground = Bodies.rectangle(
    canvas.width / 2,
    canvas.height - 20,
    canvas.width,
    40,
    { isStatic: true, render: { fillStyle: "#cccccc" } }
  );
  World.add(world, ground);

  // Mouse
  const mouse = Mouse.create(canvas);
  const mouseConstraint = MouseConstraint.create(engine, {
    mouse,
    constraint: {
      stiffness: 0.05,
      damping: 0.2,
      render: { visible: false }
    }
  });
  World.add(world, mouseConstraint);
  render.mouse = mouse;

  function addSpaghetti(x, y) {
    const stick = Bodies.rectangle(
      x,
      y,
      130,
      10,
      {
        friction: 0.9,
        frictionStatic: 1,
        density: 0.002,
        render: { fillStyle: "#7a3f00" }
      }
    );
    World.add(world, stick);
  }

  // ✅ START BUTTON NOW WORKS
  startBtn.onclick = () => {
    if (running) return;
    running = true;
    toast.textContent = "Build freely — any angle.";
    addSpaghetti(canvas.width / 2, canvas.height - 200);
  };

  addBtn.onclick = () => {
    if (!running) return;
    addSpaghetti(canvas.width / 2, canvas.height - 200);
  };

});
