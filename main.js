(() => {
  const {
    Engine, Render, Runner, World, Bodies,
    Constraint, Mouse, MouseConstraint, Composite,
    Events, Body, Vector, Query
  } = Matter;

  const GAME_DURATION = 10 * 60;
  const PX_PER_CM = 4;

  // DOM
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

  // Immediate visible proof JS is running
  toastEl.innerHTML = "JS loaded ✅ — enter a name and press <strong>Start</strong>.";

  // State
  let running = false;
  let paused = true;
  let gameEnded = false;
  let timeLeft = GAME_DURATION;

  let glueMode = false;
  let glueFirst = null;

  let teams = []; // {name,heightCm,result}
  let spaghetti = [];
  let selectedBody = null;
  let currentHeightCm = 0;

  // Engine
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
      background: "transparent"
    }
  });
  Render.run(render);
  Runner.run(Runner.create(), engine);

  // Ground + top piece (pink circle)
  let ground = Bodies.rectangle(window.innerWidth / 2, window.innerHeight - 20, window.innerWidth, 40, {
    isStatic: true,
    render: { fillStyle: "#cbd5e1" }
  });
  World.add(world, ground);

  let topPiece = Bodies.circle(window.innerWidth / 2, window.innerHeight / 2 - 120, 18, {
    label: "top",
    render: { fillStyle: "#ffd6e7", strokeStyle: "#fb7185", lineWidth: 2 }
  });
  World.add(world, topPiece);

  // Helpers
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  function syncTeamLabel() {
    const name = (teamNameInput.value || "").trim() || "—";
    brandTeamLabel.textContent = `Team/Person: ${name}`;
  }
  teamNameInput.addEventListener("input", syncTeamLabel);
  syncTeamLabel();

  function renderTeams() {
    if (!teams.length) {
      teamsTableBody.innerHTML = `<tr><td colspan="4" class="muted">No teams added yet.</td></tr>`;
      return;
    }
    teamsTableBody.innerHTML = teams.map((t, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${t.name}</td>
        <td>${t.heightCm != null ? `${t.heightCm} cm` : "—"}</td>
        <td>${t.result || "—"}</td>
      </tr>
    `).join("");
  }

  function ensureTeam(name) {
    const lower = name.toLowerCase();
    if (!teams.some(t => t.name.toLowerCase() === lower)) {
      teams.push({ name, heightCm: null, result: "" });
      renderTeams();
    }
  }

  function addSpaghetti(x, y) {
    const stick = Bodies.rectangle(x, y, 90, 7, {
      friction: 0.8,
      restitution: 0.02,
      frictionAir: 0.03,
      render: { fillStyle: "#7a3f00", strokeStyle: "#4b2600", lineWidth: 1 }
    });
    spaghetti.push(stick);
    World.add(world, stick);
    materialsEl.textContent = `${spaghetti.length}`;
    selectedBody = stick;
  }

  // Mouse handling
  const mouse = Mouse.create(render.canvas);
  const mouseConstraint = MouseConstraint.create(engine, {
    mouse,
    constraint: { stiffness: 0.2, render: { visible: false } }
  });
  World.add(world, mouseConstraint);
  render.mouse = mouse;

  function selectBodyAtMouse() {
    const bodies = Composite.allBodies(world).filter(b => b !== ground);
    const hits = Query.point(bodies, mouse.position);
    selectedBody = hits.length ? hits[0] : null;
    return selectedBody;
  }

  // Rotation (locked while gluing)
  window.addEventListener("wheel", (e) => {
    if (glueMode || glueFirst) return;
    if (!selectedBody || paused || gameEnded) return;
    e.preventDefault();
    Body.rotate(selectedBody, e.deltaY * 0.002);
  }, { passive: false });

  window.addEventListener("keydown", (e) => {
    if (glueMode || glueFirst) return;
    if (!selectedBody || paused || gameEnded) return;
    if (e.key === "q" || e.key === "Q") Body.rotate(selectedBody, -0.05);
    if (e.key === "e" || e.key === "E") Body.rotate(selectedBody, 0.05);
  });

  // Highlight selected spaghetti
  Events.on(render, "afterRender", () => {
    if (!selectedBody || selectedBody.circleRadius) return;
    const ctx = render.context;
    const v = selectedBody.vertices;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(v[0].x, v[0].y);
    for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
    ctx.closePath();
    ctx.strokeStyle = "rgba(230,0,0,0.9)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  });

  // Live height
  Events.on(engine, "afterUpdate", () => {
    const bodies = Composite.allBodies(world).filter(b => b !== ground);
    if (!bodies.length) return;
    const highestY = Math.min(...bodies.map(b => b.bounds.min.y));
    const floorY = ground.bounds.min.y;
    currentHeightCm = Math.max(0, Math.round((floorY - highestY) / PX_PER_CM));
    heightEl.textContent = `${currentHeightCm} cm`;
  });

  // Buttons
  startBtn.onclick = () => {
    const name = (teamNameInput.value || "").trim() || "Unnamed team/person";
    ensureTeam(name);
    syncTeamLabel();
    running = true;
    paused = false;
    gameEnded = false;
    engine.timing.timeScale = 1;
    toastEl.innerHTML = `Building started for <strong>${name}</strong>. Click Add spaghetti or click empty space to place sticks.`;
  };

  stopBtn.onclick = () => {
    if (!running || gameEnded) return;
    paused = !paused;
    engine.timing.timeScale = paused ? 0 : 1;
    stopBtn.textContent = paused ? "Resume" : "Stop";
    toastEl.innerHTML = paused ? "Paused." : "Resumed.";
  };

  resetBtn.onclick = () => location.reload();

  addSpaghettiBtn.onclick = () => {
    if (!running || paused || gameEnded) {
      toastEl.innerHTML = "Press <strong>Start</strong> first.";
      return;
    }
    addSpaghetti(window.innerWidth / 2, window.innerHeight / 2);
    toastEl.innerHTML = `Spaghetti added. Total: <strong>${spaghetti.length}</strong>.`;
  };

  glueBtn.onclick = () => {
    glueMode = !glueMode;
    glueFirst = null;
    glueBtn.classList.toggle("active", glueMode);
    toastEl.innerHTML = glueMode ? "Glue ON (rotation locked)." : "Glue OFF.";
  };

  // Canvas click: select or add/glue
  canvas.addEventListener("mousedown", () => {
    if (!running || paused || gameEnded) return;

    const hit = selectBodyAtMouse();

    if (!glueMode && !hit) {
      addSpaghetti(mouse.position.x, mouse.position.y);
      toastEl.innerHTML = `Spaghetti added. Total: <strong>${spaghetti.length}</strong>.`;
      return;
    }

    if (glueMode && hit) {
      if (!glueFirst) {
        glueFirst = hit;
        toastEl.innerHTML = "Glue: stick A selected. Click stick B to glue.";
        return;
      }
      if (hit !== glueFirst) {
        const weld = Constraint.create({ bodyA: glueFirst, bodyB: hit, stiffness: 0.99, damping: 0.3 });
        joints.push(weld);
        World.add(world, weld);
        glueFirst = null;
        toastEl.innerHTML = "Glue applied. Turn Glue OFF to rotate.";
      }
    }
  });

  // Timer loop
  timerEl.textContent = `⏱ ${fmt(timeLeft)}`;
  materialsEl.textContent = "0";

  setInterval(() => {
    if (!running || paused || gameEnded) return;
    timeLeft--;
    timerEl.textContent = `⏱ ${fmt(timeLeft)}`;
    if (timeLeft <= 0) {
      gameEnded = true;
      paused = true;
      engine.timing.timeScale = 0;
      toastEl.innerHTML = "Time’s up. Hands off!";
    }
  }, 1000);

  // Resize
  window.addEventListener("resize", () => {
    render.canvas.width = window.innerWidth;
    render.canvas.height = window.innerHeight;
    render.options.width = window.innerWidth;
    render.options.height = window.innerHeight;

    Body.setPosition(ground, { x: window.innerWidth / 2, y: window.innerHeight - 20 });
  });
})();
