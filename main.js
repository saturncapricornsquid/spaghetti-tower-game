const {
  Engine, Render, Runner, World, Bodies,
  Constraint, Mouse, MouseConstraint, Composite,
  Events, Bounds, Body
} = Matter;

const MAX_SPAGHETTI = 20;
const GAME_DURATION = 10 * 60; // 10 minutes
const LEADERBOARD_KEY = "vt_marshmallow_leaderboard";
const LAST_TEAM_KEY = "vt_marshmallow_last_team";
const MAX_LEADERBOARD_ENTRIES = 12;

const canvas = document.getElementById("game");
const statusEl = document.getElementById("status");
const timerEl = document.getElementById("timer");
const currentTeamSummaryEl = document.getElementById("currentTeamSummary");
const brandTeamLabelEl = document.getElementById("brandTeamLabel");

const setupModal = document.getElementById("setupModal");
const teamNameInput = document.getElementById("teamNameInput");
const teamSizeInput = document.getElementById("teamSizeInput");
const setupLeaderboardEl = document.getElementById("setupLeaderboard");
const setupLeaderboardEmptyEl = document.getElementById("setupLeaderboardEmpty");
const startTeamBtn = document.getElementById("startTeamBtn");
const clearLeaderboardBtn = document.getElementById("clearLeaderboardBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");

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

let ground = null;
let spaghetti = [];
let joints = [];
let marshmallow = null;
let lastBody = null;
let selectedBody = null;
let spaghettiCount = 0;
let timeLeft = GAME_DURATION;
let paused = false;
let gameEnded = false;
let timerHandle = null;
let warningFlags = { two: false, thirty: false };
let currentTeam = { name: "", size: 4, startedAt: null };

const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
  mouse,
  constraint: {
    stiffness: 0.2,
    render: { visible: false }
  }
});
World.add(world, mouseConstraint);
render.mouse = mouse;

Events.on(mouseConstraint, "startdrag", e => {
  selectedBody = e.body;
});
Events.on(mouseConstraint, "enddrag", () => {
  selectedBody = null;
});

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getLeaderboard() {
  try {
    return JSON.parse(localStorage.getItem(LEADERBOARD_KEY)) || [];
  } catch {
    return [];
  }
}

function saveLeaderboard(list) {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(list.slice(0, MAX_LEADERBOARD_ENTRIES)));
}

function addLeaderboardEntry(entry) {
  const list = getLeaderboard();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  saveLeaderboard(list);
}

function renderLeaderboard(targetEl, emptyEl) {
  const list = getLeaderboard();
  targetEl.innerHTML = "";

  if (!list.length) {
    emptyEl.style.display = "block";
    return;
  }

  emptyEl.style.display = "none";

  list.forEach((item, index) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${index + 1}. ${escapeHtml(item.team)}</strong> — ${item.score}px <span>(${item.valid ? "valid" : "invalid"})</span>`;
    targetEl.appendChild(li);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function updateTopLabels() {
  brandTeamLabelEl.textContent = `Team: ${currentTeam.name || "—"}`;
  currentTeamSummaryEl.innerHTML = currentTeam.name
    ? `<strong>${escapeHtml(currentTeam.name)}</strong><br>Participants: ${currentTeam.size}<br>Time left: ${formatTime(timeLeft)}`
    : "Not started yet.";
}

function updateUI() {
  const marshmallowState = marshmallow ? "placed ✅" : "not placed";
  statusEl.innerHTML =
    `<strong>${escapeHtml(currentTeam.name || "Team not set")}</strong><br>` +
    `Spaghetti used: ${spaghettiCount} / ${MAX_SPAGHETTI}<br>` +
    `Marshmallow: ${marshmallowState}<br>` +
    `Current height: ${calculateHeight()}px`;

  timerEl.innerHTML = `${paused ? "⏸" : "⏱"} ${formatTime(timeLeft)}`;
  timerEl.style.background = timeLeft <= 30 ? "#e60000" : "rgba(24,24,24,0.86)";
  updateTopLabels();
}

function announceWarning(message) {
  const banner = document.createElement("div");
  banner.textContent = message;
  banner.style.cssText = `
    position: fixed;
    top: 76px;
    left: 50%;
    transform: translateX(-50%);
    background: #e60000;
    color: white;
    padding: 10px 16px;
    border-radius: 999px;
    box-shadow: 0 8px 20px rgba(0,0,0,0.2);
    z-index: 40;
    font-weight: 700;
  `;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 2400);
}

function createGround() {
  if (ground) World.remove(world, ground);

  ground = Bodies.rectangle(
    window.innerWidth / 2,
    window.innerHeight - 20,
    window.innerWidth,
    40,
    {
      isStatic: true,
      render: { fillStyle: "#3b3b3b" }
    }
  );

  World.add(world, ground);
}

function clearGameObjects() {
  [...spaghetti, ...joints].forEach(item => World.remove(world, item));
  if (marshmallow) World.remove(world, marshmallow);

  spaghetti = [];
  joints = [];
  marshmallow = null;
  lastBody = null;
  selectedBody = null;
  spaghettiCount = 0;
}

function removeEndOverlay() {
  const existing = document.getElementById("endOverlay");
  if (existing) existing.remove();
}

function resetRunState() {
  clearGameObjects();
  timeLeft = GAME_DURATION;
  paused = false;
  gameEnded = false;
  warningFlags = { two: false, thirty: false };
  pauseBtn.textContent = "Pause";
  removeEndOverlay();
  updateUI();
}

function addSpaghetti(x, y) {
  if (spaghettiCount >= MAX_SPAGHETTI || gameEnded || paused) return;

  const stick = Bodies.rectangle(x, y, 78, 6, {
    friction: 0.65,
    restitution: 0.14,
    density: 0.0015,
    render: { fillStyle: "#c58a3d" }
  });

  Body.setAngle(stick, (Math.random() - 0.5) * 0.3);

