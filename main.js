(() => {
  const {
    Engine, Render,_X = 60;    Engine, Render, Runner, World, Bodies,
  const TICK_CM = 25;

  // ✅ Spaghetti size (BIGGER)
  const SPAGHETTI_LENGTH = 130; // was 90
  const SPAGHETTI_THICKNESS = 10; // was 7

  // Collision categories
  const CAT_DRAGGABLE = 0x0001;
  const CAT_WALLS = 0x0002;

  /* ================= DOM ================= */

  const canvas = document.getElementById("game");
  const toastEl = document.getElementById("toast");
  const timerEl = document.getElementById("timer");
  const materialsEl = document.getElementById("materials");
  const heightEl = document.getElementById("height");

  const teamNameInput = document.getElementById("teamName");
  const brandTeamLabel = document.getElementById("brandTeamLabel");
  const teamsTableBody = document.getElementById("teamsTableBody");

  const glueBtn = document.getElementById("glueBtn");
  const addSpaghettiBtn = document.getElementById("addSpaghettiBtn");
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const resetBtn = document.getElementById("resetBtn");

  /* ================= STATE ================= */

  let running = false;
  let paused = true;
  let gameEnded = false;
  let timeLeft = GAME_DURATION;

  let glueMode = false;
  let glueFirst = null;

  let spaghetti = [];
  let joints = [];

  let selectedBody = null;
  let hoveredBody = null;
  let draggingBody = null;
  let currentHeightCm = 0;

  /* ================= ENGINE ================= */

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
      background: "#f9fafb"
    }
  });

  Render.run(render);
  Runner.run(Runner.create(), engine);

  /* ================= MOUSE ================= */

  const mouse = Mouse.create(render.canvas);

  const mouseConstraint = MouseConstraint.create(engine, {
    mouse,
    constraint: {
      stiffness: 0.06,
      damping: 0.25,
      angularStiffness: 0,
      render: { visible: false }
    },
    collisionFilter: { mask: CAT_DRAGGABLE }
  });

  render.mouse = mouse;

  /* ================= WORLD ================= */

  let ground, leftWall, rightWall, ceiling;

  function createGround() {
    ground = Bodies.rectangle(
      window.innerWidth / 2,
      window.innerHeight - 20,
      window.innerWidth,
      40,
      {
        isStatic: true,
        collisionFilter: { category: CAT_WALLS, mask: 0xFFFF },
        render: { fillStyle: "#cbd5e1" }
      }
    );
    World.add(world, ground);
  }

  function createWalls() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    leftWall = Bodies.rectangle(-WALL_THICKNESS / 2, h / 2, WALL_THICKNESS, h * 2, { isStatic: true });
    rightWall = Bodies.rectangle(w + WALL_THICKNESS / 2, h / 2, WALL_THICKNESS, h * 2, { isStatic: true });
    ceiling = Bodies.rectangle(w / 2, -WALL_THICKNESS / 2, w * 2, WALL_THICKNESS, { isStatic: true });

    World.add(world, [leftWall, rightWall, ceiling]);
  }

  function resetWorld() {
    Composite.clear(world, false);
    spaghetti = [];
    joints = [];
    selectedBody = hoveredBody = draggingBody = glueFirst = null;

    createGround();
    createWalls();
    World.add(world, mouseConstraint);

    materialsEl.textContent = "0";
    heightEl.textContent = "0 cm";
  }

  /* ================= SPAGHETTI ================= */

  function addSpaghettiAt(x, y) {
    const stick = Bodies.rectangle(
      x,
      y,
      SPAGHETTI_LENGTH,
      SPAGHETTI_THICKNESS,
      {
        friction: 0.9,
        frictionStatic: 1.0,
        restitution: 0.01,
        frictionAir: 0.06,
        density: 0.0018, // ✅ adjusted for bigger size
        collisionFilter: { category: CAT_DRAGGABLE, mask: 0xFFFF },
        render: {
          fillStyle: "#7a3f00",
          strokeStyle: "#4b2600",
          lineWidth: 1
        }
      }
    );

    spaghetti.push(stick);
    World.add(world, stick);
    selectedBody = stick;
    materialsEl.textContent = spaghetti.length;
  }

  /* ================= DRAG EVENTS ================= */

  Events.on(mouseConstraint, "startdrag", e => {
    draggingBody = e.body;
    selectedBody = e.body;
    if (e.body) Body.setAngularVelocity(e.body, 0);
  });

  Events.on(mouseConstraint, "enddrag", () => {
    draggingBody = null;
  });

  /* ================= ROTATION (FREE) ================= */

  window.addEventListener(
    "wheel",
    e => {
      if (!selectedBody || paused || gameEnded) return;
      if (glueMode && glueFirst) return; // only lock MID-glue
      e.preventDefault();
      Body.rotate(selectedBody, e.deltaY * 0.002);
    },
    { passive: false }
  );

  /* ================= HEIGHT ================= */

  Events.on(engine, "afterUpdate", () => {
    if (!ground) return;
    const bodies = Composite.allBodies(world).filter(b => !b.isStatic);
    if (!bodies.length) return;

    const highestY = Math.min(...bodies.map(b => b.bounds.min.y));
    const floorY = ground.bounds.min.y;

    currentHeightCm = Math.round((floorY - highestY) / PX_PER_CM);
    heightEl.textContent = `${Math.max(0, currentHeightCm)} cm`;
  });

  /* ================= UI ================= */

  startBtn.onclick = () => {
    running = true;
    paused = false;
    engine.timing.timeScale = 1;
    addSpaghettiAt(window.innerWidth / 2, window.innerHeight - 300);
    toastEl.innerHTML = "Build freely: any angle, any direction.";
  };

  stopBtn.onclick = () => {
    paused = !paused;
    engine.timing.timeScale = paused ? 0 : 1;
    stopBtn.textContent = paused ? "Resume" : "Stop";
  };

  resetBtn.onclick = () => {
    running = false;
    paused = true;
    engine.timing.timeScale = 0;
    resetWorld();
    timeLeft = GAME_DURATION;
    timerEl.textContent = "⏱ 10:00";
    toastEl.innerHTML = "Reset complete.";
  };

  addSpaghettiBtn.onclick = () => {
    if (!running || paused) return;
    addSpaghettiAt(window.innerWidth / 2, window.innerHeight - 300);
  };

  glueBtn.onclick = () => {
    glueMode = !glueMode;
    glueFirst = null;
    glueBtn.classList.toggle("active", glueMode);
    glueBtn.textContent = glueMode ? "Glue ON" : "Glue (tape/string)";
  };

  /* ================= INIT ================= */

  resetWorld();
})();
    Constraint, Mouse, MouseConstraint, Composite,
    Events, Body, Query
  } = Matter;

  /* ================= CONFIG ================= */

  const GAME_DURATION = 10 * 60;
  const PX_PER_CM = 4;

  const WALL_THICKNESS = 80;
