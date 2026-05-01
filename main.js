(() => {
  const {
    Engine, Render, Runner, World, Bodies,
    Constraint, Mouse, MouseConstraint, Composite,
    Events, Body, Vector, Query
  } = Matter;

  /* ================= CONFIG ================= */
  const GAME_DURATION = 10 * 60; // seconds
  const TOP_TOLERANCE_PX = 3;
  const PX_PER_CM = 4;

  const WALL_THICKNESS = 80;
  const RULER_X = 60;
  const TICK_CM = 25;

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

  let teams = []; // { name, heightCm, result }
  let spaghetti = [];
  let joints = [];

  let selectedBody = null;
  let hoveredBody = null;

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
      background: "#f9fafb" // visible canvas background
    }
  });

  Render.run(render);
  Runner.run(Runner.create(), engine);

  /* ================= WORLD BOUNDS (camera lock) ================= */
  let ground, leftWall, rightWall, ceiling, topPiece;

  function createGround() {
    if (ground) World.remove(world, ground);
    ground = Bodies.rectangle(
      window.innerWidth / 2,
      window.innerHeight - 20,
      window.innerWidth,
      40,
      { isStatic: true, render: { fillStyle: "#cbd5e1" } }
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
      isStatic: true,
      render: { fillStyle: "#cbd5e1" }
    });

    rightWall = Bodies.rectangle(w + WALL_THICKNESS / 2, h / 2, WALL_THICKNESS, h * 2, {
      isStatic: true,
      render: { fillStyle: "#cbd5e1" }
    });

    ceiling = Bodies.rectangle(w / 2, -WALL_THICKNESS / 2, w * 2, WALL_THICKNESS, {
      isStatic: true,
      render: { fillStyle: "#cbd5e1" }
    });

    World.add(world, [leftWall, rightWall, ceiling]);
  }

  function createTopPiece() {
    if (topPiece) World.remove(world, topPiece);

    // strong visible top piece
    topPiece = Bodies.circle(
      window.innerWidth / 2,
      180,
      18,
      {
        label: "topSpaghettiPiece",
        restitution: 0.1,
        friction: 0.8,
        render: {
          fillStyle: "#e11d48",
          strokeStyle: "#881337",
          lineWidth: 3
        }
      }
    );
    World.add(world, topPiece);
  }

  function getSpaghettiSpawnY() {
    // safe zone above ground / below UI
    return window.innerHeight - 320;
  }

  function resetWorldOnly() {
    // Keep teams list, reset physics objects
    Composite.clear(world, false);
    spaghetti = [];
    joints = [];
    selectedBody = null;
    hoveredBody = null;
    glueFirst = null;

    ground = leftWall = rightWall = ceiling = topPiece = null;

    createGround();
    createWorldBounds();
    createTopPiece();

    materialsEl.textContent = "0";
    heightEl.textContent = "0 cm";
    currentHeightCm = 0;
  }

  /* ================= UI HELPERS ================= */
  function setToast(html) {
    toastEl.innerHTML = html;
  }

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

  function getTeamName() {
    return (teamNameInput.value || "").trim() || "Unnamed team/person";
  }

  function syncTeamLabel() {
    brandTeamLabel.textContent = `Team/Person: ${getTeamName()}`;
  }

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

  /* ================= SNAP-TO-END GLUE HELPERS ================= */

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
    let best = ends[0];
    let bestD = Infinity;
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

    // pin joint: length 0 + high stiffness is standard practice [1](https://vodafone.sharepoint.com/sites/C3-B2B-c2b2bvodafonedesignstandardssolutions/_layouts/15/Doc.aspx?sourcedoc=%7B64093031-3915-4A0A-A3C0-7D06F1A73D91%7D&file=VF3-ND1048%20London%20%26%20Unwind%20(SRAN)_Ericsson%20V1.pptx&action=edit&mobileredirect=true&DefaultItemOpen=1)
    return Constraint.create({
      bodyA, bodyB,
      pointA, pointB,
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

  /* ================= SPAGHETTI ================= */

  function addSpaghettiAt(x, y) {
    const stick = Bodies.rectangle(x, y, 90, 7, {
      friction: 0.8,
      restitution: 0.02,
      frictionAir: 0.03,
      render: { fillStyle: "#7a3f00", strokeStyle: "#4b2600", lineWidth: 1 }
    });

    spaghetti.push(stick);
    World.add(world, stick);
    selectedBody = stick;

    materialsEl.textContent = `${spaghetti.length}`;
    return stick;
  }

  /* ================= MOUSE + SELECTION ================= */

  const mouse = Mouse.create(render.canvas);
  const mouseConstraint = MouseConstraint.create(engine, {
    mouse,
    constraint: { stiffness: 0.2, render: { visible: false } }
  });
  World.add(world, mouseConstraint);
  render.mouse = mouse;

  Events.on(mouseConstraint, "startdrag", (e) => {
    selectedBody = e.body;
  });

  Events.on(engine, "afterUpdate", () => {
    // hover detection for nicer glue guidance
    const bodies = Composite.allBodies(world).filter(b => b !== ground && b !== leftWall && b !== rightWall && b !== ceiling);
    const hits = Query.point(bodies, mouse.position);
    hoveredBody = hits.length ? hits[0] : null;
  });

  function selectBodyAtMouse() {
    const bodies = Composite.allBodies(world).filter(b => b !== ground && b !== leftWall && b !== rightWall && b !== ceiling);
    const hits = Query.point(bodies, mouse.position);
    selectedBody = hits.length ? hits[0] : null;
    return selectedBody;
  }

  /* ================= ROTATION (LOCKED WHILE GLUING) ================= */

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

  /* ================= BUTTONS ================= */

  startBtn.onclick = () => {
    const name = getTeamName();
    ensureTeamExists(name);
    syncTeamLabel();

    running = true;
    paused = false;
    gameEnded = false;
    engine.timing.timeScale = 1;

    // instant visible feedback
    addSpaghettiAt(window.innerWidth / 2, getSpaghettiSpawnY());

    setToast(`Building started for <strong>${escapeHtml(name)}</strong>. First spaghetti added.`);
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
    setToast("Reset complete. Press Start to begin.");
    timerEl.textContent = `⏱ ${formatTime(timeLeft)}`;
  };

  addSpaghettiBtn.onclick = () => {
    if (!running || paused || gameEnded) {
      setToast("Press <strong>Start</strong> first.");
      return;
    }
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

  /* ================= CANVAS CLICK ================= */

  canvas.addEventListener("mousedown", () => {
    if (!running || paused || gameEnded) return;

    const hit = selectBodyAtMouse();

    // add on empty space if glue is off
    if (!glueMode && !hit) {
      addSpaghettiAt(mouse.position.x, mouse.position.y);
      setToast(`Spaghetti added. Total: <strong>${spaghetti.length}</strong>.`);
      return;
    }

    // glue flow with snap-to-end
    if (glueMode && hit) {
      if (!glueFirst) {
        glueFirst = hit;
        setToast("Glue: stick A selected. Now click stick B to snap-and-glue ends.");
        return;
      }
      if (hit === glueFirst) {
        setToast("Glue: stick A re-selected. Click a different stick for B.");
        return;
      }

      snapEndpoints(glueFirst, hit, mouse.position);

      const weld = createEndpointWeld(glueFirst, hit, mouse.position);
      const stabiliser = createStabiliser(glueFirst, hit);

      joints.push(weld, stabiliser);
      World.add(world, weld);
      World.add(world, stabiliser);

      setToast("Snap-to-end glue applied ✅ (ends snapped immediately).");
      glueFirst = null;
    }
  });

  /* ================= HEIGHT (live) ================= */

  Events.on(engine, "afterUpdate", () => {
    const bodies = Composite.allBodies(world).filter(b =>
      b !== ground && b !== leftWall && b !== rightWall && b !== ceiling
    );
    if (!bodies.length || !ground) return;

    const highestY = Math.min(...bodies.map(b => b.bounds.min.y));
    const floorY = ground.bounds.min.y;

    const heightPx = Math.max(0, floorY - highestY);
    currentHeightCm = Math.round(heightPx / PX_PER_CM);

    heightEl.textContent = `${currentHeightCm} cm`;

    // safety clamp: if anything escapes despite walls, pull it back in (rare but possible) [2](https://vodafone.sharepoint.com/sites/VDesign/SitePages/Components.aspx?web=1)
    const margin = 20;
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (const b of bodies) {
      if (b.isStatic) continue;
      let x = b.position.x;
      let y = b.position.y;
      let moved = false;

      if (x < margin) { x = margin; moved = true; }
      if (x > w - margin) { x = w - margin; moved = true; }
      if (y < margin) { y = margin; moved = true; }
      if (y > h - 120) { y = h - 120; moved = true; }

      if (moved) {
        Body.setPosition(b, { x, y });
        Body.setVelocity(b, { x: 0, y: 0 });
        Body.setAngularVelocity(b, 0);
      }
    }
  });

  /* ================= RESULT CHECK (top piece highest) ================= */

  function evaluateResult() {
    const name = getTeamName();
    ensureTeamExists(name);

    const team = teams.find(t => t.name.toLowerCase() === name.toLowerCase());
    const bodies = Composite.allBodies(world).filter(b =>
      b !== ground && b !== leftWall && b !== rightWall && b !== ceiling
    );

    const others = bodies.filter(b => b !== topPiece);
    const highestOtherY = others.length ? Math.min(...others.map(b => b.bounds.min.y)) : Infinity;
    const topY = topPiece ? topPiece.bounds.min.y : Infinity;

    const topIsHighest = topPiece && (topY <= highestOtherY + TOP_TOLERANCE_PX);

    if (team) {
      team.heightCm = currentHeightCm;
      team.result = topIsHighest ? "Winner" : "No winner";
      renderTeamsTable();
    }

    if (topIsHighest) {
      setToast(`🏆 <strong>WINNING TEAM / PERSON IS:</strong> ${escapeHtml(name)} (Height: ${currentHeightCm} cm)`);
    } else {
      setToast(`<strong>NO WINNER</strong> — top piece not highest (Height: ${currentHeightCm} cm)`);
    }
  }

  /* ================= OVERLAYS: selection + ruler + glue endpoints ================= */
  // Drawing overlays after Matter renders is the correct pattern 
  Events.on(render, "afterRender", () => {
    const ctx = render.context;
    if (!ctx || !ground) return;

    // selected body outline
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

    // dashed ruler: uses setLineDash 
    const bodies = Composite.allBodies(world).filter(b =>
      b !== ground && b !== leftWall && b !== rightWall && b !== ceiling
    );
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

    // glue endpoint dots (when glue on)
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
      if (hoveredBody && hoveredBody !== glueFirst) {
        drawDots(hoveredBody, "rgba(143,43,209,0.35)");
      }
    }
  });

  /* ================= TIMER ================= */

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
      evaluateResult();
    }
  }, 1000);

  /* ================= INIT + RESIZE ================= */

  setToast("Ready. Enter a name and press <strong>Start</strong>.");

  resetWorldOnly();
  renderTeamsTable();

  window.addEventListener("resize", () => {
    render.canvas.width = window.innerWidth;
    render.canvas.height = window.innerHeight;
    render.options.width = window.innerWidth;
    render.options.height = window.innerHeight;

    createGround();
    createWorldBounds();
  });
})();
