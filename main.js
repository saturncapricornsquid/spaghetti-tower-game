document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOM loaded");

  const {
    Engine, Render, Runner, World, Bodies,
    Mouse, MouseConstraint
  } = Matter;

  console.log("✅ Matter loaded");

  const canvas = document.getElementById("game");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const toast = document.getElementById("toast");
  const startBtn = document.getElementById("startBtn");
  const resetBtn = document.getElementById("resetBtn");
  const addBtn = document.getElementById("addSpaghettiBtn");

  console.log("✅ Buttons:", startBtn, resetBtn, addBtn);

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
      background: "#f9fafb"
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
      {
        friction: 0.9,
        density: 0.002
      }
    );
    World.add(world, stick);
  }

  // ✅ BUTTON ACTIONS

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
});
