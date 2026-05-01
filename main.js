(() => {
  const {
    Engine, Render, Runner, World, Bodies,
    Constraint, Mouse, MouseConstraint, Composite,
    Events, Body, Query
  } = Matter;

  const GAME_DURATION = 10 * 60;
  const TOP_TOLERANCE_PX = 3;
  const PX_PER_CM = 4;

  const WALL_THICKNESS = 80;
  const RULER_X = 60;
  const TICK_CM = 25;

  // Snap-to-angle settings
  const SNAP_DEGREES = 8; // snap when within 8 degrees of 0/90
  const SNAP_RAD = (SNAP_DEGREES * Math.PI) / 180;

  // Collision categories
  const CAT_DRAGGABLE = 0x0001; // spaghetti + top piece
  const CAT_WALLS     = 0x0002; // boundaries

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

  // State
  let running = false;
  let paused = true;
  let gameEnded = false;
  let timeLeft = GAME_DURATION;

  let glueMode = false;
  let glueFirst = null;

  let teams = [];
  let spaghetti = [];
  let joints = [];

  let selectedBody = null;
  let hoveredBody = null;
  let currentHeightCm = 0;

  // Track dragging (for snap-to-angle)
  let draggingBody = null;

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
      background: "#f9fafb"
    }
  });

  Render.run(render);
  Runner.run(Runner.create(), engine);

  // Mouse + MouseConstraint (created ONCE)
  const mouse = Mouse.create(render.canvas);

  const mouseConstraint = MouseConstraint.create(engine, {
    mouse,
    constraint: {
      stiffness: 0.06,         // softer = less jumping
      damping: 0.25,           // more damping = calmer
      angularStiffness: 0,
      render: { visible: false }
    },
    collisionFilter: {
      mask: CAT_DRAGGABLE      // only draggable objects can be grabbed [2](https://brm.io/matter-js/docs/classes/MouseConstraint.html)[3](https://stackoverflow.com/questions/64772783/how-can-i-change-the-collisionfilter-of-an-object-so-it-can-no-longer-interact-w)
    }
  });

  render.mouse = mouse;

  // World objects
  let ground, leftWall, rightWall, ceiling, topPiece;

  function setToast(html) { toastEl.innerHTML = html; }
  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = String(s % 60).padStart(2, "0");
    return `${m}:${sec}`;
  }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;"
    }[m]));
  }
  function getTeamName() { return (teamNameInput.value || "").trim() || "Unnamed team/person"; }
  function syncTeamLabel() { brandTeamLabel.textContent = `Team/Person: ${getTeamName()}`; }

  function renderTeamsTable() {
    if (!teams.length) {
      teamsTableBody.innerHTML = `<tr><td colspan="4" class="muted">No teams added yet.</td></tr>`;
      return;
    }
    teamsTableBody.innerHTML = teams.map((t, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(t.name)}</td>
        <td>${t.heightCm != null ? `${t.heightCm} cm` : "—"}</td>
        <td>${t.result ? escapeHtml(t.result) : "—"}</td>
      </tr>
    `).join("");
  }

  function ensureTeamExists(name) {
    const lower = name.toLowerCase();
    if (!teams.some(t => t.name.toLowerCase() === lower) && lower !== "unnamed team/person") {
      teams.push({ name, heightCm: null, result: "" });
      renderTeamsTable();
    }
  }

  teamNameInput.addEventListener("input", syncTeamLabel);
  syncTeamLabel();

  function getSpaghettiSpawnY() { return window.innerHeight - 320; }

  function createGround() {
    if (ground) World.remove(world, ground);
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

  function createWorldBounds() {
    if (leftWall) World.remove(world, leftWall);
    if (rightWall) World.remove(world, rightWall);
    if (ceiling) World.remove(world, ceiling);

    const w = window.innerWidth;
    const h = window.innerHeight;

    leftWall = Bodies.rectangle(-WALL_THICKNESS / 2, h / 2, WALL_THICKNESS, h * 2, {
      isStatic: true, collisionFilter: { category: CAT_WALLS, mask: 0xFFFF }, render: { fillStyle: "#cbd5e1" }
    });
    rightWall = Bodies.rectangle(w + WALL_THICKNESS / 2, h / 2, WALL_THICKNESS, h * 2, {
      isStatic: true, collisionFilter: { category: CAT_WALLS, mask: 0xFFFF }, render: { fillStyle: "#cbd5e1" }
    });
    ceiling = Bodies.rectangle(w / 2, -WALL_THICKNESS / 2, w * 2, WALL_THICKNESS, {
      isStatic: true, collisionFilter: { category: CAT_WALLS, mask: 0xFFFF }, render: { fillStyle: "#cbd5e1" }
    });

    World.add(world, [leftWall, rightWall, ceiling]);
  }

  function createTopPiece() {
    if (topPiece) World.remove(world, topPiece);
    topPiece = Bodies.circle(
      window.innerWidth / 2,
      180,
      18,
      {
        label: "topSpaghettiPiece",
        restitution: 0.1,
        friction: 0.8,
        collisionFilter: { category: CAT_DRAGGABLE, mask: 0xFFFF },
        render: { fillStyle: "#e11d48", strokeStyle: "#881337", lineWidth: 3 }
      }
    );
    World.add(world, topPiece);
  }

  function resetWorldOnly() {
    // Clears bodies and constraints (including mouseConstraint) → must re-add
    Composite.clear(world, false);

    spaghetti = [];
    joints = [];
    selectedBody = null;
    hoveredBody = null;
    glueFirst = null;
    draggingBody = null;

    ground = leftWall = rightWall = ceiling = topPiece = null;

    createGround();
    createWorldBounds();
    createTopPiece();

    World.add(world, mouseConstraint);

    materialsEl.textContent = "0";
    heightEl.textContent = "0 cm";
    currentHeightCm = 0;
  }

  // ===== Snap-to-end glue helpers =====
  function worldToLocal(worldPoint, body) {
    const dx = worldPoint.x - body.position.x;
    const dy = worldPoint.y - body.position.y;
    const cos = Math.cos(-body.angle);
    const sin = Math.sin(-body.angle);
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
  }
  function localToWorld(localPoint, body) {
    const cos = Math.cos(body.angle);
    const sin = Math.sin(body.angle);
    return {
      x: body.position.x + localPoint.x * cos - localPoint.y * sin,
      y: body.position.y + localPoint.x * sin + localPoint.y * cos
    };
  }
  function getStickEndpoints(body) {
    if (body.circleRadius) return [{ x: body.position.x, y: body.position.y }];
    const locals = body.vertices.map(v => worldToLocal(v, body));
    const minX = Math.min(...locals.map(p => p.x));
    const maxX = Math.max(...locals.map(p => p.x));
    const left = locals.filter(p => Math.abs(p.x - minX) < 0.01);
    const right = locals.filter(p => Math.abs(p.x - maxX) < 0.01);
    const leftLocal = { x: minX, y: left.length ? (left[0].y + (left[1]?.y ?? left[0].y)) / 2 : 0 };
    const rightLocal = { x: maxX, y: right.length ? (right[0].y + (right[1]?.y ?? right[0].y)) / 2 : 0 };
    return [localToWorld(leftLocal, body), localToWorld(rightLocal, body)];
  }
  function nearestEndpoint(body, clickPos) {
    const ends = getStickEndpoints(body);
    let best = ends[0], bestD = Infinity;
    for (const p of ends) {
      const dx = p.x - clickPos.x;
      const dy = p.y - clickPos.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }
  function snapEndpoints(bodyA, bodyB, clickPos) {
    const aEnd = nearestEndpoint(bodyA, clickPos);
    const bEnd = nearestEndpoint(bodyB, clickPos);
    const dx = aEnd.x - bEnd.x;
    const dy = aEnd.y - bEnd.y;
    Body.setPosition(bodyB, { x: bodyB.position.x + dx, y: bodyB.position.y + dy });
    Body.setVelocity(bodyA, { x: 0, y: 0 });
    Body.setVelocity(bodyB, { x: 0, y: 0 });
    Body.setAngularVelocity(bodyA, 0);
    Body.setAngularVelocity(bodyB, 0);
  }
  function createEndpointWeld(bodyA, bodyB, clickPos) {
    const aWorld = nearestEndpoint(bodyA, clickPos);
    const bWorld = nearestEndpoint(bodyB, clickPos);
    const pointA = worldToLocal(aWorld, bodyA);
    const pointB = worldToLocal(bWorld, bodyB);
    return Constraint.create({
      bodyA, bodyB, pointA, pointB,
      length: 0,
      stiffness: 0.95,
      damping: 0.15,
      render: { strokeStyle: "#8f2bd1", lineWidth: 3 }
    });
  }
  function createStabiliser(bodyA, bodyB) {
    return Constraint.create({
      bodyA, bodyB,
      pointA: { x: 0, y: 0 },
      pointB: { x: 0, y: 0 },
      length: 0,
      stiffness: 0.2,
      damping: 0.25,
      render: { strokeStyle: "rgba(143,43,209,0.35)", lineWidth: 2 }
    });
  }

  function addSpaghettiAt(x, y) {
    const stick = Bodies.rectangle(x, y, 90, 7, {
      friction: 0.9,
      frictionStatic: 1.0,
      restitution: 0.01,
      frictionAir: 0.06,
      density: 0.002,
      collisionFilter: { category: CAT_DRAGGABLE, mask: 0xFFFF },
      render: { fillStyle: "#7a3f00", strokeStyle: "#4b2600", lineWidth: 1 }
    });
    spaghetti.push(stick);
    World.add(world, stick);
    materialsEl.textContent = `${spaghetti.length}`;
    selectedBody = stick;
    return stick;
  }

  // Drag events: enable snap-to-angle while dragging
  Events.on(mouseConstraint, "startdrag", (e) => {
    draggingBody = e.body || null;
    selectedBody = draggingBody;

    if (!draggingBody) return;
    // calm down dragging
    Body.setAngularVelocity(draggingBody, 0);
  });

  Events.on(mouseConstraint, "enddrag", () => {
    draggingBody = null;
  });

  // Hover + height update
  Events.on(engine, "afterUpdate", () => {
    const bodies = Composite.allBodies(world).filter(b => b !== ground && b !== leftWall && b !== rightWall && b !== ceiling);
    const hits = Query.point(bodies, mouse.position);
    hoveredBody = hits.length ? hits[0] : null;

    if (!ground || !bodies.length) return;
    const highestY = Math.min(...bodies.map(b => b.bounds.min.y));
    const floorY = ground.bounds.min.y;
    currentHeightCm = Math.round(Math.max(0, (floorY - highestY) / PX_PER_CM));
    heightEl.textContent = `${currentHeightCm} cm`;

    // ✅ Snap-to-horizontal/vertical while dragging
    if (draggingBody && !glueMode) {
      const a = draggingBody.angle;

      // nearest targets: 0, PI/2, PI, 3PI/2
      const targets = [0, Math.PI/2, Math.PI, (3*Math.PI)/2];
      let best = targets[0];
      let bestDiff = Infinity;

      for (const t of targets) {
        // smallest angular difference
        let diff = Math.atan2(Math.sin(a - t), Math.cos(a - t));
        diff = Math.abs(diff);
        if (diff < bestDiff) { bestDiff = diff; best = t; }
      }

      if (bestDiff < SNAP_RAD) {
        Body.setAngle(draggingBody, best);
        Body.setAngularVelocity(draggingBody, 0);
      }
    }
  });

  function selectBodyAtMouse() {
    const bodies = Composite.allBodies(world).filter(b => b !== ground && b !== leftWall && b !== rightWall && b !== ceiling);
    const hits = Query.point(bodies, mouse.position);
    selectedBody = hits.length ? hits[0] : null;
    return selectedBody;
  }

  // Buttons
  startBtn.onclick = () => {
    const name = getTeamName();
    ensureTeamExists(name);
    syncTeamLabel();

    running = true;
    paused = false;
    gameEnded = false;
    engine.timing.timeScale = 1;

    addSpaghettiAt(window.innerWidth / 2, getSpaghettiSpawnY());
    setToast(`Building started for <strong>${escapeHtml(name)}</strong>. Drag sticks to stack (snaps near 0°/90°).`);
  };

  stopBtn.onclick = () => {
    if (!running || gameEnded) return;
    paused = !paused;
    engine.timing.timeScale = paused ? 0 : 1;
    stopBtn.textContent = paused ? "Resume" : "Stop";
    setToast(paused ? "Paused." : "Resumed.");
  };

  resetBtn.onclick = () => {
    stopBtn.textContent = "Stop";
    timeLeft = GAME_DURATION;
    running = false;
    paused = true;
    gameEnded = false;
    engine.timing.timeScale = 0;
    resetWorldOnly();
    timerEl.textContent = `⏱ ${formatTime(timeLeft)}`;
    setToast("Reset complete. Press Start to begin.");
  };

  addSpaghettiBtn.onclick = () => {
    if (!running || paused || gameEnded) { setToast("Press <strong>Start</strong> first."); return; }
    addSpaghettiAt(window.innerWidth / 2, getSpaghettiSpawnY());
    setToast(`Spaghetti added. Total: <strong>${spaghetti.length}</strong>.`);
  };

  glueBtn.onclick = () => {
    glueMode = !glueMode;
    glueFirst = null;
    glueBtn.classList.toggle("active", glueMode);
    glueBtn.textContent = glueMode ? "Glue ON" : "Glue (tape/string)";
    setToast(glueMode ? "Glue ON: click stick A then stick B (snap-to-end). Rotation locked." : "Glue OFF.");
  };

  // Canvas click for add/glue
  canvas.addEventListener("mousedown", () => {
    if (!running || paused || gameEnded) return;

    const hit = selectBodyAtMouse();

    if (!glueMode && !hit) {
      addSpaghettiAt(mouse.position.x, mouse.position.y);
      setToast(`Spaghetti added. Total: <strong>${spaghetti.length}</strong>.`);
      return;
    }

    if (glueMode && hit) {
      if (!glueFirst) { glueFirst = hit; setToast("Glue: stick A selected. Click stick B."); return; }
      if (hit === glueFirst) { setToast("Pick a different stick for B."); return; }

      snapEndpoints(glueFirst, hit, mouse.position);
      const weld = createEndpointWeld(glueFirst, hit, mouse.position);
      const stabiliser = createStabiliser(glueFirst, hit);

      joints.push(weld, stabiliser);
      World.add(world, weld);
      World.add(world, stabiliser);

      glueFirst = null;
      setToast("Snap-to-end glue applied ✅");
    }
  });

  // Ruler + endpoint dots + selection outline
  Events.on(render, "afterRender", () => {
    const ctx = render.context;
    if (!ctx || !ground) return;

    // selection outline
    if (selectedBody && !selectedBody.circleRadius) {
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
    }

    // dashed ruler (Canvas setLineDash) [4](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/setLineDash)
    const bodies = Composite.allBodies(world).filter(b => b !== ground && b !== leftWall && b !== rightWall && b !== ceiling);
    if (bodies.length) {
      const highestY = Math.min(...bodies.map(b => b.bounds.min.y));
      const floorY = ground.bounds.min.y;
      const topY = Math.max(10, highestY);
      const bottomY = floorY;

      ctx.save();
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(RULER_X, bottomY);
      ctx.lineTo(RULER_X, topY);
      ctx.stroke();
      ctx.setLineDash([]);

      const tickPx = TICK_CM * PX_PER_CM;
      const heightPx = Math.max(0, bottomY - topY);
      const maxTick = Math.floor(heightPx / tickPx);

      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.font = "12px Arial";

      for (let i = 0; i <= maxTick; i++) {
        const y = bottomY - i * tickPx;
        ctx.beginPath();
        ctx.moveTo(RULER_X - 10, y);
        ctx.lineTo(RULER_X + 10, y);
        ctx.stroke();
        ctx.fillText(`${i * TICK_CM}cm`, RULER_X + 14, y + 4);
      }

      ctx.fillStyle = "#111";
      ctx.fillText(`Height: ${currentHeightCm} cm`, RULER_X - 10, topY - 10);
      ctx.restore();
    }

    // glue endpoint dots
    if (glueMode) {
      const drawDots = (body, colour) => {
        if (!body) return;
        const pts = getStickEndpoints(body);
        ctx.save();
        ctx.fillStyle = colour;
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 2;
        pts.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
        ctx.restore();
      };

      drawDots(glueFirst, "rgba(143,43,209,0.85)");
      if (hoveredBody && hoveredBody !== glueFirst) drawDots(hoveredBody, "rgba(143,43,209,0.35)");
    }
  });

  // Timer
  timerEl.textContent = `⏱ ${formatTime(timeLeft)}`;
  materialsEl.textContent = "0";
  heightEl.textContent = "0 cm";

  setInterval(() => {
    if (!running || paused || gameEnded) return;

    timeLeft--;
    timerEl.textContent = `⏱ ${formatTime(timeLeft)}`;

    if (timeLeft <= 0) {
      gameEnded = true;
      paused = true;
      engine.timing.timeScale = 0;
      stopBtn.textContent = "Stop";
      setToast("Time’s up. Hands off!");
    }
  }, 1000);

  // Init
  setToast("Ready. Enter a name and press <strong>Start</strong>.");
  resetWorldOnly();
  renderTeamsTable();
  World.add(world, mouseConstraint);

  window.addEventListener("resize", () => {
    render.canvas.width = window.innerWidth;
    render.canvas.height = window.innerHeight;
    render.options.width = window.innerWidth;
    render.options.height = window.innerHeight;

    createGround();
    createWorldBounds();
  });
})();
``
