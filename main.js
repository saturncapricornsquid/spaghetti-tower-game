const {
  Engine, Render, Runner, World, Bodies,
  Constraint, Mouse, MouseConstraint, Composite,
  Events, Bounds, Body, Vector
} = Matter;

const GAME_DURATION = 10 * 60;
const TOP_TOLERANCE_PX = 3;
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

// State
let glueMode = false;
let glueFirst = null;
let hoveredBody = null;

let timeLeft = GAME_DURATION;
let running = false;
let paused = true;
let gameEnded = false;

let teams = []; // ✅ list of team/person names

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
const runner = Runner.create();
Runner.run(runner, engine);

let ground;
let spaghetti = [];
let joints = [];
let topPiece = null;
let selectedBody = null;

/* ---------- UI helpers ---------- */

function setToast(html) {
  if (toastEl) toastEl.innerHTML = html;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function updateTimerUI() {
  if (timerEl) timerEl.textContent = `⏱ ${formatTime(timeLeft)}`;
}

function updateMaterials() {
  if (materialsEl) materialsEl.textContent = `${spaghetti.length}`;
}

function getTeamName() {
  const v = (teamNameInput?.value || "").trim();
  if (v) return v;
  const label = (brandTeamLabel?.textContent || "").replace("Team/Person:", "").trim();
  return label || "Unnamed team/person";
}

function syncTeamLabel() {
  const name = getTeamName();
  if (brandTeamLabel) brandTeamLabel.textContent = `Team/Person: ${name}`;
}
if (teamNameInput) teamNameInput.addEventListener("input", syncTeamLabel);
syncTeamLabel();

/* ---------- Teams table ---------- */

function renderTeamsTable() {
  if (!teamsTableBody) return;

  if (teams.length === 0) {
    teamsTableBody.innerHTML = `<tr><td colspan="2" class="muted">No names added yet.</td></tr>`;
    return;
  }

  teamsTableBody.innerHTML = teams
    .map((name, idx) => `<tr><td>${idx + 1}</td><td>${escapeHtml(name)}</td></tr>`)
    .join("");
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;"
  }[m]));
}

function addTeamIfNeeded() {
  const name = getTeamName();
  if (!name || name.toLowerCase() === "unnamed team/person") return;

  const exists = teams.some(t => t.toLowerCase() === name.toLowerCase());
  if (!exists) {
    teams.push(name);
    renderTeamsTable();
  }
}

/* ---------- World setup ---------- */

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

function createTopPiece() {
  if (topPiece) World.remove(world, topPiece);

  topPiece = Bodies.circle(
    window.innerWidth / 2,
    window.innerHeight / 2 - 120,
    18,
    {
      restitution: 0.1,
      friction: 0.8,
      label: "topSpaghettiPiece",
      render: { fillStyle: "#ffd6e7", strokeStyle: "#fb7185", lineWidth: 2 }
    }
  );

  World.add(world, topPiece);
}

function clearWorld() {
  Composite.clear(world, false);
  spaghetti = [];
  joints = [];
  topPiece = null;
  selectedBody = null;
  glueFirst = null;
  hoveredBody = null;
}

function resetGame() {
  clearWorld();
  createGround();
  createTopPiece();

  glueMode = false;
  glueBtn.classList.remove("active");
  glueBtn.textContent = "Glue (tape / string)";

  timeLeft = GAME_DURATION;
  running = false;
  paused = true;
  gameEnded = false;

  engine.timing.timeScale = 0;
  stopBtn.textContent = "Stop";

  updateTimerUI();
  updateMaterials();
  if (heightEl) heightEl.textContent = "0 cm";

  setToast("Press <strong>Start</strong> to begin. Add spaghetti, drag to move, rotate with <strong>Q/E</strong> or mouse wheel. Use <strong>Glue ON</strong> to glue stick ends.");
}

createGround();
createTopPiece();
renderTeamsTable();
resetGame();

/* ---------- Mouse / dragging ---------- */

const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
  mouse,
  constraint: { stiffness: 0.2, render: { visible: false } }
});
World.add(world, mouseConstraint);
render.mouse = mouse;

Events.on(mouseConstraint, "startdrag", e => {
  selectedBody = e.body;
});

Events.on(mouseConstraint, "enddrag", () => {
  selectedBody = null;
});

Events.on(engine, "afterUpdate", () => {
  const pos = mouse.position;
  const bodies = Composite.allBodies(world).filter(b => b !== ground);
  hoveredBody = bodies.find(b => Bounds.contains(b.bounds, pos)) || null;
});

/* Rotation shortcuts:
   Q = anti-clockwise, E = clockwise */
window.addEventListener("wheel", e => {
  if (!selectedBody || paused || gameEnded) return;
  Body.rotate(selectedBody, e.deltaY * 0.002);
});

window.addEventListener("keydown", e => {
  if (!selectedBody || paused || gameEnded) return;
  if (e.key === "q" || e.key === "Q") Body.rotate(selectedBody, -0.05);
  if (e.key === "e" || e.key === "E") Body.rotate(selectedBody, 0.05);
});

/* ---------- Spaghetti creation ---------- */

function addSpaghettiAt(x, y) {
  const stick = Bodies.rectangle(x, y, 90, 7, {
    friction: 0.8,
    restitution: 0.02,
    frictionAir: 0.02,
    // darker spaghetti colour
    render: { fillStyle: "#7a3f00", strokeStyle: "#4b2600", lineWidth: 1 }
  });

  spaghetti.push(stick);
  World.add(world, stick);
  updateMaterials();
  return stick;
}

addSpaghettiBtn.onclick = () => {
  if (!running || paused || gameEnded) return;
  const stick = addSpaghettiAt(window.innerWidth / 2, window.innerHeight / 2);
  setToast(`Spaghetti added. Using <strong>${spaghetti.length}</strong>. Drag it into place.`);
  selectedBody = stick;
};

/* ---------- Glue: endpoint snap + stabilised weld ---------- */

function rotateLocalToWorld(local, body) {
  const rotated = Vector.rotate(local, body.angle);
  return Vector.add(body.position, rotated);
}

function worldToLocal(worldPoint, body) {
  const delta = Vector.sub(worldPoint, body.position);
  return Vector.rotate(delta, -body.angle);
}

function getStickEndpoints(body) {
  if (body.circleRadius) return [{ x: body.position.x, y: body.position.y }];

  const locals = body.vertices.map(v => worldToLocal(v, body));
  const minX = Math.min(...locals.map(p => p.x));
  const maxX = Math.max(...locals.map(p => p.x));

  const leftVs  = locals.filter(p => Math.abs(p.x - minX) < 0.01);
  const rightVs = locals.filter(p => Math.abs(p.x - maxX) < 0.01);

  const leftLocal = {
    x: minX,
    y: leftVs.length ? (leftVs[0].y + (leftVs[1]?.y ?? leftVs[0].y)) / 2 : 0
  };
  const rightLocal = {
    x: maxX,
    y: rightVs.length ? (rightVs[0].y + (rightVs[1]?.y ?? rightVs[0].y)) / 2 : 0
  };

  return [rotateLocalToWorld(leftLocal, body), rotateLocalToWorld(rightLocal, body)];
}

function nearestEndpoint(body, clickPos) {
  const endpoints = getStickEndpoints(body);
  let best = endpoints[0];
  let bestD = Infinity;
  for (const p of endpoints) {
    const d = Vector.magnitude(Vector.sub(p, clickPos));
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

// Snap endpoints together immediately
function snapEndpoints(bodyA, bodyB, clickPos) {
  const aWorld = nearestEndpoint(bodyA, clickPos);
  const bWorld = nearestEndpoint(bodyB, clickPos);
  const delta = Vector.sub(aWorld, bWorld);

  Body.setPosition(bodyB, Vector.add(bodyB.position, delta));
  Body.setVelocity(bodyB, { x: 0, y: 0 });
  Body.setVelocity(bodyA, { x: 0, y: 0 });
  Body.setAngularVelocity(bodyB, 0);
  Body.setAngularVelocity(bodyA, 0);
}

// Create an endpoint-to-endpoint constraint (main weld)
function createEndpointConstraint(bodyA, bodyB, clickPos) {
  const aWorld = nearestEndpoint(bodyA, clickPos);
  const bWorld = nearestEndpoint(bodyB, clickPos);
  const pointA = worldToLocal(aWorld, bodyA);
  const pointB = worldToLocal(bWorld, bodyB);

  return Constraint.create({
    bodyA, bodyB,
    pointA, pointB,
    stiffness: 0.995,
    damping: 0.22,
    length: 0,
    render: { strokeStyle: "#8f2bd1", lineWidth: 3 }
  });
}

// Secondary stabiliser constraint to reduce wobble (helps it “stand”)
function createStabiliserConstraint(bodyA, bodyB) {
  return Constraint.create({
    bodyA, bodyB,
    pointA: { x: 0, y: 0 },
    pointB: { x: 0, y: 0 },
    stiffness: 0.22,
    damping: 0.28,
    length: 0,
    render: { strokeStyle: "rgba(143,43,209,0.35)", lineWidth: 2 }
  });
}

// Apply extra damping after glue so it settles quickly
function stabiliseBodies(bodyA, bodyB) {
  bodyA.frictionAir = Math.max(bodyA.frictionAir || 0, 0.06);
  bodyB.frictionAir = Math.max(bodyB.frictionAir || 0, 0.06);

  Body.setVelocity(bodyA, { x: 0, y: 0 });
  Body.setVelocity(bodyB, { x: 0, y: 0 });
  Body.setAngularVelocity(bodyA, 0);
  Body.setAngularVelocity(bodyB, 0);
}

/* ---------- Glue button ---------- */

glueBtn.onclick = () => {
  glueMode = !glueMode;
  glueFirst = null;

  glueBtn.classList.toggle("active", glueMode);
  glueBtn.textContent = glueMode ? "Glue ON (pick 2 sticks)" : "Glue (tape / string)";

  setToast(glueMode
    ? "Glue is <strong>ON</strong>: click a first stick, then click a second stick to glue at their <strong>ends</strong>."
    : "Glue is <strong>OFF</strong>: add spaghetti, drag to move, rotate with <strong>Q/E</strong> or mouse wheel."
  );
};

/* ---------- Start/Stop/Reset ---------- */

startBtn.onclick = () => {
  if (gameEnded) return;

  // ✅ add name into left table when Start is pressed
  addTeamIfNeeded();

  running = true;
  paused = false;
  engine.timing.timeScale = 1;
  setToast("Building started. Add spaghetti, drag to move, rotate with <strong>Q/E</strong> or mouse wheel.");
};

stopBtn.onclick = () => {
  if (!running || gameEnded) return;
  paused = !paused;
  engine.timing.timeScale = paused ? 0 : 1;
  stopBtn.textContent = paused ? "Resume" : "Stop";
  setToast(paused ? "Paused." : "Resumed.");
};

resetBtn.onclick = () => resetGame();

/* ---------- Canvas interaction: add or glue ---------- */

canvas.addEventListener("mousedown", () => {
  if (!running || paused || gameEnded) return;

  const pos = mouse.position;
  const bodies = Composite.allBodies(world).filter(b => b !== ground);
  const hit = bodies.find(b => Bounds.contains(b.bounds, pos));

  // Click empty space => add spaghetti
  if (!hit) {
    const stick = addSpaghettiAt(pos.x, pos.y);
    setToast(`Spaghetti added. Using <strong>${spaghetti.length}</strong>. Drag it into place.`);
    selectedBody = stick;
    return;
  }

  // Glue flow: click first body then second body
  if (glueMode) {
    if (!glueFirst) {
      glueFirst = hit;
      setToast("Glue: first stick selected. Now click the second stick to glue their <strong>ends</strong>.");
      return;
    }

    if (hit === glueFirst) {
      setToast("Glue: first stick re-selected. Click a different second stick to glue.");
      return;
    }

    // ✅ Snap, glue, stabilise (so it stands)
    snapEndpoints(glueFirst, hit, pos);

    const weld = createEndpointConstraint(glueFirst, hit, pos);
    const stabiliser = createStabiliserConstraint(glueFirst, hit);
    joints.push(weld, stabiliser);

    World.add(world, weld);
    World.add(world, stabiliser);

    stabiliseBodies(glueFirst, hit);

    setToast("Glue added at stick <strong>ends</strong> and stabilised so it holds firm.");
    glueFirst = null;
  }
});

/* ---------- Height calculation (live) ---------- */

function updateHeight() {
  if (!heightEl || !ground) return;

  const bodies = Composite.allBodies(world).filter(b => b !== ground);
  if (!bodies.length) {
    heightEl.textContent = "0 cm";
    return;
  }

  const highestY = Math.min(...bodies.map(b => b.bounds.min.y));
  const floorY = ground.bounds.min.y;
  const heightPx = Math.max(0, floorY - highestY);
  const heightCm = Math.round(heightPx / PX_PER_CM);

  heightEl.textContent = `${heightCm} cm`;
}
Events.on(engine, "afterUpdate", () => updateHeight());

/* ---------- End-of-game winner logic ---------- */

function evaluateResult() {
  const name = getTeamName();

  if (!topPiece) {
    setToast("<strong>NO WINNER</strong> — no top spaghetti piece found.");
    return;
  }

  const bodies = Composite.allBodies(world).filter(b => b !== ground);
  const highestY = Math.min(...bodies.map(b => b.bounds.min.y));
  const topY = topPiece.bounds.min.y;

  const topIsHighest = topY <= highestY + TOP_TOLERANCE_PX;

  if (topIsHighest) {
    setToast(`🏆 <strong>WINNING TEAM / PERSON IS:</strong> ${escapeHtml(name)}`);
  } else {
    setToast("<strong>NO WINNER</strong> — the top spaghetti piece was not the highest.");
  }
}

/* ---------- Timer loop ---------- */

updateTimerUI();
updateMaterials();

setInterval(() => {
  if (!running || paused || gameEnded) return;

  timeLeft--;
  updateTimerUI();

  if (timeLeft <= 0) {
    gameEnded = true;
    paused = true;
    engine.timing.timeScale = 0;
    stopBtn.textContent = "Stop";
    evaluateResult();
  }
}, 1000);

/* ---------- Endpoint hint dots (visual glue feedback) ---------- */

Events.on(render, "afterRender", () => {
  if (!glueMode) return;

  const ctx = render.context;

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
});

/* ---------- Resize fix ---------- */

window.addEventListener("resize", () => {
  render.canvas.width = window.innerWidth;
  render.canvas.height = window.innerHeight;
  render.options.width = window.innerWidth;
  render.options.height = window.innerHeight;

  createGround();

  if (topPiece) {
    Body.setPosition(topPiece, {
      x: window.innerWidth / 2,
      y: Math.min(topPiece.position.y, window.innerHeight - 220)
    });
  } else {
    createTopPiece();
  }
});
