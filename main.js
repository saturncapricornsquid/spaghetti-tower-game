const {
  Engine,, Composite,  Engine, Render, Runner, World, Bodies,
  Events, Body, Vector, Query
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

let timeLeft = GAME_DURATION;
let running = false;
let paused = true;
let gameEnded = false;

let teams = [];               // [{ name, heightCm, result }]
let currentHeightCm = 0;

let ground;
let spaghetti = [];
let joints = [];
let topPiece = null;
let selectedBody = null;

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

const runner = Runner.create();
Runner.run(runner, engine);

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

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;"
  }[m]));
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
    teamsTableBody.innerHTML = `<tr><td colspan="4" class="muted">No teams added yet.</td></tr>`;
    return;
  }

  teamsTableBody.innerHTML = teams.map((t, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${escapeHtml(t.name)}</td>
      <td>${t.heightCm != null ? `${t.heightCm} cm` : "—"}</td>
      <td>${t.result ? escapeHtml(t.result) : "—"}</td>
    </tr>
  `).join("");
}

function ensureTeamExists(name) {
  const exists = teams.some(t => t.name.toLowerCase() === name.toLowerCase());
  if (!exists && name && name.toLowerCase() !== "unnamed team/person") {
    teams.push({ name, heightCm: null, result: "" });
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

function resetPhysicsWorld() {
  Composite.clear(world, false);
  spaghetti = [];
  joints = [];
  topPiece = null;
  selectedBody = null;
  glueFirst = null;

  createGround();
  createTopPiece();

  updateMaterials();
  if (heightEl) heightEl.textContent = "0 cm";
}

function resetGame() {
  resetPhysicsWorld();

  glueMode = false;
  glueBtn.classList.remove("active");
  glueBtn.textContent = "Glue (tape/string)";

  timeLeft = GAME_DURATION;
  running = false;
  paused = true;
  gameEnded = false;

  engine.timing.timeScale = 0;
  stopBtn.textContent = "Stop";

  updateTimerUI();
  setToast("Press <strong>Start</strong> to begin. Click a stick to select it, then rotate with mouse wheel or Q/E.");
}

createGround();
createTopPiece();
renderTeamsTable();
resetGame();

/* ---------- Mouse + selection ---------- */

const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
  mouse,
  constraint: { stiffness: 0.2, render: { visible: false } }
});
World.add(world, mouseConstraint);
render.mouse = mouse;

// Selecting on drag still works
Events.on(mouseConstraint, "startdrag", e => {
  selectedBody = e.body;
});

// ✅ click-to-select (even if you don't drag)
function selectBodyAtMouse() {
  const bodies = Composite.allBodies(world).filter(b => b !== ground);
  const hits = Query.point(bodies, mouse.position);
  selectedBody = hits.length ? hits[0] : null;
  return selectedBody;
}

/* ---------- Rotation (wheel + Q/E) ---------- */

// Wheel rotation (non-passive so it works reliably)
window.addEventListener("wheel", (e) => {
  if (!selectedBody || paused || gameEnded) return;
  e.preventDefault();
  Body.rotate(selectedBody, e.deltaY * 0.002);
}, { passive: false });

window.addEventListener("keydown", (e) => {
  if (!selectedBody || paused || gameEnded) return;
  if (e.key === "q" || e.key === "Q") Body.rotate(selectedBody, -0.05);
  if (e.key === "e" || e.key === "E") Body.rotate(selectedBody, 0.05);
});

/* ---------- Spaghetti creation ---------- */

function addSpaghettiAt(x, y) {
  const stick = Bodies.rectangle(x, y, 90, 7, {
    friction: 0.8,
    restitution: 0.02,
    frictionAir: 0.03,
    // darker spaghetti
    render: { fillStyle: "#7a3f00", strokeStyle: "#4b2600", lineWidth: 1 }
  });
  spaghetti.push(stick);
  World.add(world, stick);
  updateMaterials();
  selectedBody = stick;
  return stick;
}

addSpaghettiBtn.onclick = () => {
  if (!running || paused || gameEnded) return;
  addSpaghettiAt(window.innerWidth / 2, window.innerHeight / 2);
  setToast(`Spaghetti added. Using <strong>${spaghetti.length}</strong>.`);
};

/* ---------- Glue helpers (endpoint snap + constraints) ---------- */

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

  const leftLocal = { x: minX, y: leftVs.length ? (leftVs[0].y + (leftVs[1]?.y ?? leftVs[0].y))/2 : 0 };
  const rightLocal = { x: maxX, y: rightVs.length ? (rightVs[0].y + (rightVs[1]?.y ?? rightVs[0].y))/2 : 0 };

  return [rotateLocalToWorld(leftLocal, body), rotateLocalToWorld(rightLocal, body)];
}

function nearestEndpoint(body, clickPos) {
  const endpoints = getStickEndpoints(body);
  let best = endpoints[0], bestD = Infinity;
  for (const p of endpoints) {
    const d = Vector.magnitude(Vector.sub(p, clickPos));
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

// Snap endpoints so it "sticks straight away"
function snapEndpoints(bodyA, bodyB, clickPos) {
  const aWorld = nearestEndpoint(bodyA, clickPos);
  const bWorld = nearestEndpoint(bodyB, clickPos);
  const delta = Vector.sub(aWorld, bWorld);

  Body.setPosition(bodyB, Vector.add(bodyB.position, delta));
  Body.setVelocity(bodyA, { x:0, y:0 });
  Body.setVelocity(bodyB, { x:0, y:0 });
  Body.setAngularVelocity(bodyA, 0);
  Body.setAngularVelocity(bodyB, 0);
}

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

// Optional stabiliser for less wobble
function createStabiliserConstraint(bodyA, bodyB) {
  return Constraint.create({
    bodyA, bodyB,
    pointA: { x:0, y:0 },
    pointB: { x:0, y:0 },
    stiffness: 0.22,
    damping: 0.28,
    length: 0,
    render: { strokeStyle: "rgba(143,43,209,0.35)", lineWidth: 2 }
  });
}

/* ---------- Glue toggle ---------- */

glueBtn.onclick = () => {
  glueMode = !glueMode;
  glueFirst = null;
  glueBtn.classList.toggle("active", glueMode);
  glueBtn.textContent = glueMode ? "Glue ON (pick 2 sticks)" : "Glue (tape/string)";
  setToast(glueMode
    ? "Glue ON: click stick A, then stick B to glue their <strong>ends</strong>."
    : "Glue OFF: click a stick to select it and rotate with mouse wheel or Q/E."
  );
};

/* ---------- Canvas click behaviour ---------- */

canvas.addEventListener("mousedown", () => {
  if (!running || paused || gameEnded) return;

  const hit = selectBodyAtMouse();

  // If glue is OFF: click empty space adds spaghetti
  if (!glueMode && !hit) {
    addSpaghettiAt(mouse.position.x, mouse.position.y);
    setToast(`Spaghetti added. Using <strong>${spaghetti.length}</strong>.`);
    return;
  }

  // If glue is ON: 2-click flow (first click selects stick A only)
  if (glueMode && hit) {
    if (!glueFirst) {
      glueFirst = hit;
      setToast("Glue: stick A selected. Now click stick B to glue.");
      return;
    }
    if (hit === glueFirst) {
      setToast("Glue: stick A re-selected. Click a different stick for B.");
      return;
    }

    snapEndpoints(glueFirst, hit, mouse.position);

    const weld = createEndpointConstraint(glueFirst, hit, mouse.position);
    const stabiliser = createStabiliserConstraint(glueFirst, hit);
    joints.push(weld, stabiliser);
    World.add(world, weld);
    World.add(world, stabiliser);

    setToast("Glue applied at ends (snaps immediately). Click a stick to select and rotate it.");
    glueFirst = null;
  }
});

/* ---------- Height calculation (live) ---------- */

Events.on(engine, "afterUpdate", () => {
  if (!heightEl || !ground) return;
  const bodies = Composite.allBodies(world).filter(b => b !== ground);
  if (!bodies.length) return;

  const highestY = Math.min(...bodies.map(b => b.bounds.min.y));
  const floorY = ground.bounds.min.y;
  const heightPx = Math.max(0, floorY - highestY);
  currentHeightCm = Math.round(heightPx / PX_PER_CM);
  heightEl.textContent = `${currentHeightCm} cm`;
});

/* ---------- Start/Stop/Reset ---------- */

startBtn.onclick = () => {
  const name = getTeamName();
  ensureTeamExists(name);
  syncTeamLabel();

  running = true;
  paused = false;
  engine.timing.timeScale = 1;
  setToast("Building started. Click a stick to select it; rotate with mouse wheel or Q/E.");
};

stopBtn.onclick = () => {
  if (!running || gameEnded) return;
  paused = !paused;
  engine.timing.timeScale = paused ? 0 : 1;
  stopBtn.textContent = paused ? "Resume" : "Stop";
  setToast(paused ? "Paused." : "Resumed.");
};

resetBtn.onclick = () => resetGame();

/* ---------- End-of-game result + table update ---------- */

function evaluateResult() {
  const name = getTeamName();
  ensureTeamExists(name);
  const team = teams.find(t => t.name.toLowerCase() === name.toLowerCase());

  const bodies = Composite.allBodies(world).filter(b => b !== ground);
  const highestY = Math.min(...bodies.map(b => b.bounds.min.y));
  const topY = topPiece ? topPiece.bounds.min.y : Infinity;

  const topIsHighest = topPiece && (topY <= highestY + TOP_TOLERANCE_PX);

  if (team) {
    team.heightCm = currentHeightCm;
    team.result = topIsHighest ? "Winner" : "No winner";
    renderTeamsTable();
  }

  if (topIsHighest) {
    setToast(`🏆 <strong>WINNING TEAM / PERSON IS:</strong> ${escapeHtml(name)} (Height: ${currentHeightCm} cm)`);
  } else {
    setToast(`<strong>NO WINNER</strong> — top spaghetti piece not highest (Height: ${currentHeightCm} cm)`);
  }
}

/* ---------- Timer ---------- */

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

/* ---------- Resize ---------- */

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
