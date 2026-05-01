const {
  Engine, Render, Runner, World, Bodies,
  Constraint, Mouse, MouseConstraint, Composite,
  Events, Bounds, Body
} = Matter;

const MAX_SPAGHETTI = 20;
const GAME_DURATION = 10 * 60;

// How close (in pixels) the top piece must be to count as "highest"
const TOP_TOLERANCE_PX = 3;

const canvas = document.getElementById("game");
const statusEl = document.getElementById("status");
const timerEl = document.getElementById("timer");
const teamNameInput = document.getElementById("teamName");
const brandTeamLabel = document.getElementById("brandTeamLabel");

let glueMode = false;
let timeLeft = GAME_DURATION;
let paused = false;
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
Runner.run(Runner.create(), engine);

let ground;
let spaghetti = [];
let joints = [];
let topPiece = null;
let selectedBody = null;

/* ✅ Get team/person name safely */
function getTeamName() {
  if (teamNameInput && teamNameInput.value.trim() && teamNameInput.value.trim() !== "Team: —") {
    return teamNameInput.value.trim();
  }
  if (brandTeamLabel && brandTeamLabel.textContent) {
    return brandTeamLabel.textContent.replace("Team/Person:", "").trim() || "Unnamed team/person";
  }
  return "Unnamed team/person";
}

/* ✅ Keep top label synced with input */
function syncTeamLabel() {
  const name = getTeamName();
  if (brandTeamLabel) brandTeamLabel.textContent = `Team/Person: ${name}`;
}

if (teamNameInput) {
  // Initialise clean default and label sync
  if (teamNameInput.value === "Team: —") teamNameInput.value = "";
  teamNameInput.addEventListener("input", syncTeamLabel);
}
syncTeamLabel();

/* ✅ Ground */
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

/* ✅ Top spaghetti piece (pink circle) */
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

createGround();
createTopPiece();

/* ✅ Mouse */
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

/* ✅ Rotate spaghetti */
window.addEventListener("wheel", e => {
  if (!selectedBody || paused || gameEnded) return;
  Body.rotate(selectedBody, e.deltaY * 0.002);
});

window.addEventListener("keydown", e => {
  if (!selectedBody || paused || gameEnded) return;
  if (e.key === "q") Body.rotate(selectedBody, -0.05);
  if (e.key === "e") Body.rotate(selectedBody, 0.05);
});

/* ✅ Glue button */
document.getElementById("glueBtn").onclick = () => {
  glueMode = !glueMode;
  document.getElementById("glueBtn").textContent =
    glueMode ? "Glue ON" : "Glue (tape / string)";
};

/* ✅ Placement logic */
canvas.addEventListener("mousedown", () => {
  if (paused || gameEnded) return;

  const pos = mouse.position;
  const bodies = Composite.allBodies(world).filter(b => b !== ground);
  const hit = bodies.find(b => Bounds.contains(b.bounds, pos));

  // Add spaghetti stick on empty click (until limit)
  if (!hit && spaghetti.length < MAX_SPAGHETTI) {
    const stick = Bodies.rectangle(pos.x, pos.y, 80, 6, {
      friction: 0.7,
      restitution: 0.05,
      render: { fillStyle: "#f7c948", strokeStyle: "#d97706", lineWidth: 1 }
    });
    spaghetti.push(stick);
    World.add(world, stick);
    statusEl.innerHTML = "Spaghetti added. Keep building — the top spaghetti piece must be the highest at the end.";
    return;
  }

  // Glue mode: connect selected body to hit body
  if (glueMode && selectedBody && hit && hit !== selectedBody) {
    const joint = Constraint.create({
      bodyA: selectedBody,
      bodyB: hit,
      stiffness: 0.8,
      render: { strokeStyle: "#8f2bd1", lineWidth: 2 }
    });
    joints.push(joint);
    World.add(world, joint);
    statusEl.innerHTML = "Pieces glued together. Triangles usually improve stability.";
  }
});

/* ✅ Winner check (top piece must be highest) */
function evaluateResult() {
  const name = getTeamName();

  if (!topPiece) {
    statusEl.innerHTML = `<strong>NO WINNER</strong> — no top spaghetti piece was placed.`;
    return;
  }

  const bodies = Composite.allBodies(world).filter(b => b !== ground);

  // Highest point = smallest bounds.min.y
  const highestY = Math.min(...bodies.map(b => b.bounds.min.y));
  const topY = topPiece.bounds.min.y;

  const topIsHighest = topY <= highestY + TOP_TOLERANCE_PX;

  if (topIsHighest) {
    statusEl.innerHTML = `🏆 <strong>WINNING TEAM / PERSON IS:</strong> ${name}`;
  } else {
    statusEl.innerHTML = `<strong>NO WINNER</strong> — the top spaghetti piece was not the highest.`;
  }
}

/* ✅ Timer */
const timerHandle = setInterval(() => {
  if (paused || gameEnded) return;

  timeLeft--;
  timerEl.textContent = `⏱ ${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, "0")}`;

  if (timeLeft <= 0) {
    gameEnded = true;
    paused = true;
    evaluateResult();
    clearInterval(timerHandle);
  }
}, 1000);

/* ✅ Resize fix */
window.addEventListener("resize", () => {
  render.canvas.width = window.innerWidth;
  render.canvas.height = window.innerHeight;
  render.options.width = window.innerWidth;
  render.options.height = window.innerHeight;

  createGround();

  // Keep top piece after resize (optional reposition)
  if (topPiece) {
    Body.setPosition(topPiece, {
      x: window.innerWidth / 2,
      y: Math.min(topPiece.position.y, window.innerHeight - 200)
    });
  } else {
    createTopPiece();
  }
});
``
