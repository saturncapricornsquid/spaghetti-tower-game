const {
  Engine, Render, Runner, World, Bodies,
  Constraint, Mouse, MouseConstraint, Composite,
  Events, Bounds, Body, Vector
} = Matter;

const MAX_SPAGHETTI = 20;
const GAME_DURATION = 10 * 60;

// How close (in pixels) the top piece must be to count as "highest"
const TOP_TOLERANCE_PX = 3;

// Height conversion: px -> cm (tweak if you want)
const PX_PER_CM = 4;

const canvas = document.getElementById("game");
const statusWrapEl = document.getElementById("status");
const statusMsgEl = document.getElementById("statusMessage");
const timerEl = document.getElementById("timer");
const materialsEl = document.getElementById("materials");
const heightEl = document.getElementById("height");

const teamNameInput = document.getElementById("teamName");
const brandTeamLabel = document.getElementById("brandTeamLabel");

const glueBtn = document.getElementById("glueBtn");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const resetBtn = document.getElementById("resetBtn");

let glueMode = false;
let timeLeft = GAME_DURATION;
let running = false;
let paused = true;
let gameEnded = false;

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

function setStatus(html) {
  if (statusMsgEl) statusMsgEl.innerHTML = html;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
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

if (teamNameInput) {
  teamNameInput.addEventListener("input", syncTeamLabel);
}
syncTeamLabel();

function updateMaterials() {
  if (materialsEl) materialsEl.textContent = `${spaghetti.length}/${MAX_SPAGHETTI}`;
}

function updateTimerUI() {
  if (timerEl) timerEl.textContent = `⏱ ${formatTime(timeLeft)}`;
}

/* ---------- World setup ---------- */

function createGround() {
  if (ground) World.remove(world, ground);
  ground = Bodies.rectangle(
    window.innerWidth / 2,
    window.innerHeight - 20,
    window.innerWidth,
    40,
    {
      isStatic: true,
      render: { fillStyle: "#cbd5e1" }
    }
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
  // Remove all bodies & constraints except engine itself
  Composite.clear(world, false);
  spaghetti = [];
  joints = [];
  topPiece = null;
  selectedBody = null;
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

  setStatus("Press <strong>Start</strong> to begin. Click empty space to add spaghetti, drag to move, rotate with Q/E or mouse wheel.");
}

createGround();
createTopPiece();
resetGame(); // sets timescale=0 and UI

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

/* Rotate selected spaghetti (so it can stand upright / angled) */
window.addEventListener("wheel", e => {
  if (!selectedBody || paused || gameEnded) return;
  Body.rotate(selectedBody, e.deltaY * 0.002);
});

window.addEventListener("keydown", e => {
  if (!selectedBody || paused || gameEnded) return;
  if (e.key === "q" || e.key === "Q") Body.rotate(selectedBody, -0.05);
  if (e.key === "e" || e.key === "E") Body.rotate(selectedBody, 0.05);
});

/* ---------- Glue: endpoint-to-endpoint ---------- */

function rotateLocalToWorld(local, body) {
  const rotated = Vector.rotate(local, body.angle);
  return Vector.add(body.position, rotated);
}

function worldToLocal(worldPoint, body) {
  const delta = Vector.sub(worldPoint, body.position);
  return Vector.rotate(delta, -body.angle);
}

function getStickEndpoints(body) {
  // For circles (top piece), "endpoint" is just its centre
  if (body.circleRadius) {
    return [ { x: body.position.x, y: body.position.y } ];
  }

  // For rectangles: derive endpoints from vertices in local coords
  const locals = body.vertices.map(v => worldToLocal(v, body));
  const minX = Math.min(...locals.map(p => p.x));
  const maxX = Math.max(...locals.map(p => p.x));

  // Average the two vertices at each extreme to get a mid-point on that end
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

  const leftWorld = rotateLocalToWorld(leftLocal, body);
  const rightWorld = rotateLocalToWorld(rightLocal, body);

  return [ leftWorld, rightWorld ];
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

function createEndpointConstraint(bodyA, bodyB, clickPos) {
  const aWorld = nearestEndpoint(bodyA, clickPos);
  const bWorld = nearestEndpoint(bodyB, clickPos);

  const pointA = worldToLocal(aWorld, bodyA);
  const pointB = worldToLocal(bWorld, bodyB);

  return Constraint.create({
    bodyA, bodyB,
    pointA, pointB,
    stiffness: 0.9,
    damping: 0.05,
    render: { strokeStyle: "#8f2bd1", lineWidth: 3 }
  });
}

/* ---------- Buttons ---------- */

glueBtn.onclick = () => {
  glueMode = !glueMode;
  glueBtn.classList.toggle("active", glueMode);
  glueBtn.textContent = glueMode ? "Glue ON (click two stick ends)" : "Glue (tape / string)";
  setStatus(glueMode
    ? "Glue is <strong>ON</strong>: click one stick, then click another to glue at their <strong>ends</strong>."
    : "Glue is <strong>OFF</strong>: click empty space to add spaghetti. Drag to move. Rotate with Q/E or mouse wheel."
  );
};

startBtn.onclick = () => {
  if (gameEnded) return;
  running = true;
  paused = false;
  engine.timing.timeScale = 1;
  setStatus("Building started. Good luck!");
};

stopBtn.onclick = () => {
  if (!running || gameEnded) return;
  paused = !paused;
  engine.timing.timeScale = paused ? 0 : 1;
  stopBtn.textContent = paused ? "Resume" : "Stop";
  setStatus(paused ? "Paused." : "Resumed.");
};

resetBtn.onclick = () => {
  resetGame();
};

/* ---------- Placement & glue interaction ---------- */

canvas.addEventListener("mousedown", () => {
  if (!running || paused || gameEnded) return;

  const pos = mouse.position;
  const bodies = Composite.allBodies(world).filter(b => b !== ground);
  const hit = bodies.find(b => Bounds.contains(b.bounds, pos));

  // Add spaghetti stick on empty click (until limit)
  if (!hit && spaghetti.length < MAX_SPAGHETTI) {
    const stick = Bodies.rectangle(pos.x, pos.y, 90, 7, {
      friction: 0.75,
      restitution: 0.03,
      // ✅ darker spaghetti colour
      render: { fillStyle: "#8a4b00", strokeStyle: "#5a2f00", lineWidth: 1 }
    });

    spaghetti.push(stick);
    World.add(world, stick);
    updateMaterials();
    setStatus(`Spaghetti added. Using <strong>${spaghetti.length}/${MAX_SPAGHETTI}</strong>.`);
    return;
  }

  // Glue mode: click selected body then another body to glue
  if (glueMode && selectedBody && hit && hit !== selectedBody) {
    const joint = createEndpointConstraint(selectedBody, hit, pos);
    joints.push(joint);
    World.add(world, joint);
    setStatus("Glue added to <strong>stick ends</strong> for better stability.");
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

Events.on(engine, "afterUpdate", () => {
  updateHeight();
});

/* ---------- End-of-game winner logic ---------- */

function evaluateResult() {
  const name = getTeamName();

  if (!topPiece) {
    setStatus("<strong>NO WINNER</strong> — no top spaghetti piece found.");
    return;
  }

  const bodies = Composite.allBodies(world).filter(b => b !== ground);
  const highestY = Math.min(...bodies.map(b => b.bounds.min.y));
  const topY = topPiece.bounds.min.y;

  const topIsHighest = topY <= highestY + TOP_TOLERANCE_PX;

  if (topIsHighest) {
    setStatus(`🏆 <strong>WINNING TEAM / PERSON IS:</strong> ${name}`);
  } else {
    setStatus("<strong>NO WINNER</strong> — the top spaghetti piece was not the highest.");
  }
}

/* ---------- Timer loop (Start-controlled) ---------- */

updateTimerUI();
updateMaterials();

const timerHandle = setInterval(() => {
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

/* ---------- Resize fix ---------- */

window.addEventListener("resize", () => {
  render.canvas.width = window.innerWidth;
  render.canvas.height = window.innerHeight;
  render.options.width = window.innerWidth;
  render.options.height = window.innerHeight;

  // Rebuild ground to match new width
  createGround();

  // Keep top piece reasonably placed
  if (topPiece) {
    Body.setPosition(topPiece, {
      x: window.innerWidth / 2,
      y: Math.min(topPiece.position.y, window.innerHeight - 220)
    });
  } else {
    createTopPiece();
  }
});
