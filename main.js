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

  spaghetti.push(stick);
  spaghettiCount += 1;
  World.add(world, stick);
  updateUI();
}

function addJoint(bodyA, bodyB) {
  if (!bodyA || !bodyB || bodyA === bodyB || gameEnded || paused) return;

  const joint = Constraint.create({
    bodyA,
    bodyB,
    length: 0,
    stiffness: 0.82,
    damping: 0.02,
    render: {
      strokeStyle: "#ffd400",
      lineWidth: 3
    }
  });

  joints.push(joint);
  World.add(world, joint);
  updateUI();
}

function placeMarshmallow(x, y) {
  if (marshmallow || spaghettiCount < MAX_SPAGHETTI || gameEnded || paused) return;

  marshmallow = Bodies.circle(x, y, 16, {
    density: 0.02,
    friction: 0.55,
    restitution: 0.08,
    render: {
      fillStyle: "#ffffff",
      strokeStyle: "#d9d9d9",
      lineWidth: 1
    }
  });

  World.add(world, marshmallow);
  updateUI();
}

function calculateHeight() {
  const bodies = [...spaghetti];
  if (marshmallow) bodies.push(marshmallow);
  if (!bodies.length) return 0;

  const highestPoint = Math.min(...bodies.map(b => b.bounds.min.y));
  const height = Math.round((window.innerHeight - 20) - highestPoint);
  return Math.max(0, height);
}

function structureIsStanding() {
  if (!marshmallow) return false;
  if (marshmallow.position.y > window.innerHeight - 55) return false;
  return !Composite.allBodies(world).some(body => body !== ground && body.speed > 35);
}

function marshmallowIsOnTop() {
  if (!marshmallow) return false;
  const highestOther = spaghetti.length ? Math.min(...spaghetti.map(b => b.bounds.min.y)) : Infinity;
  return marshmallow.bounds.min.y <= highestOther + 8;
}

function currentResult() {
  const score = calculateHeight();
  const standing = structureIsStanding();
  const onTop = marshmallowIsOnTop();
  const valid = Boolean(marshmallow && standing && onTop);
  return { score, standing, onTop, valid };
}

function startTimerLoop() {
  if (timerHandle) clearInterval(timerHandle);

  timerHandle = setInterval(() => {
    if (paused || gameEnded || !currentTeam.name) return;

    timeLeft -= 1;

    if (timeLeft === 120 && !warningFlags.two) {
      warningFlags.two = true;
      announceWarning("2 minutes remaining");
    }

    if (timeLeft === 30 && !warningFlags.thirty) {
      warningFlags.thirty = true;
      announceWarning("30 seconds remaining");
    }

    if (timeLeft <= 0) {
      timeLeft = 0;
      updateUI();
      endGame();
      return;
    }

    updateUI();
  }, 1000);
}

canvas.addEventListener("mousedown", () => {
  if (gameEnded || paused || !currentTeam.name) return;

  const pos = mouse.position;
  const bodies = Composite.allBodies(world).filter(b => b !== ground);
  const clicked = bodies.find(b => Bounds.contains(b.bounds, pos));

  if (!clicked) {
    if (spaghettiCount < MAX_SPAGHETTI) {
      addSpaghetti(pos.x, pos.y);
      lastBody = null;
    } else if (!marshmallow) {
      placeMarshmallow(pos.x, pos.y);
      lastBody = null;
    }
    return;
  }

  if (lastBody && lastBody !== clicked) {
    addJoint(lastBody, clicked);
    lastBody = null;
  } else {
    lastBody = clicked;
  }
});

window.addEventListener("keydown", (e) => {
  if (gameEnded || paused) return;

  if ((e.key === "Delete" || e.key === "Backspace") && selectedBody && spaghetti.includes(selectedBody)) {
    spaghetti = spaghetti.filter(s => s !== selectedBody);

    joints = joints.filter(j => {
      const linked = j.bodyA === selectedBody || j.bodyB === selectedBody;
      if (linked) World.remove(world, j);
      return !linked;
    });

    World.remove(world, selectedBody);
    spaghettiCount = spaghetti.length;
    selectedBody = null;
    updateUI();
  }
});

window.addEventListener("resize", () => {
  Render.setSize(render, window.innerWidth, window.innerHeight);
  createGround();
  updateUI();
});

pauseBtn.addEventListener("click", () => {
  if (gameEnded || !currentTeam.name) return;
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
  updateUI();
});

resetBtn.addEventListener("click", () => {
  resetRunState();
});

startTeamBtn.addEventListener("click", () => {
  const teamName = teamNameInput.value.trim() || "Unnamed team";
  const teamSize = clamp(Number(teamSizeInput.value) || 4, 1, 20);

  currentTeam = {
    name: teamName,
    size: teamSize,
    startedAt: new Date().toISOString()
  };

  localStorage.setItem(LAST_TEAM_KEY, JSON.stringify(currentTeam));
  setupModal.style.display = "none";
  resetRunState();
  updateUI();
});

clearLeaderboardBtn.addEventListener("click", () => {
  localStorage.removeItem(LEADERBOARD_KEY);
  renderLeaderboard(setupLeaderboardEl, setupLeaderboardEmptyEl);
});

function buildRetroText(entry, answers) {
  const lines = [
    "VodafoneThree Marshmallow Challenge retrospective",
    `Team: ${entry.team}`,
    `Participants: ${entry.teamSize}`,
    `Score (height): ${entry.score}px`,
    `Valid finish: ${entry.valid ? "Yes" : "No"}`,
    `Structure standing: ${entry.standing ? "Yes" : "No"}`,
    `Marshmallow on top: ${entry.onTop ? "Yes" : "No"}`,
    `Completed at: ${entry.completedAt}`,
    "",
    "Debrief notes:"
  ];

  answers.forEach((answer, index) => {
    lines.push(`${index + 1}. ${answer.prompt}`);
    lines.push(answer.response || "[No response captured]");
    lines.push("");
  });

  return lines.join("\n");
}

function buildCsv(entry, answers) {
  const rows = [[
    "team", "teamSize", "scorePx", "validFinish", "standing", "marshmallowOnTop", "completedAt", "question", "response"
  ]];

  answers.forEach(answer => {
    rows.push([
      entry.team,
      entry.teamSize,
      entry.score,
      entry.valid,
      entry.standing,
      entry.onTop,
      entry.completedAt,
      answer.prompt,
      (answer.response || "").replace(/\r?\n/g, " ")
    ]);
  });

  return rows
    .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function endGame() {
  gameEnded = true;
  paused = true;
  pauseBtn.textContent = "Resume";

  const result = currentResult();
  const completedAt = new Date().toLocaleString("en-GB");

  const entry = {
    team: currentTeam.name || "Unnamed team",
    teamSize: currentTeam.size,
    score: result.score,
    standing: result.standing,
    onTop: result.onTop,
    valid: result.valid,
    completedAt
  };

  addLeaderboardEntry(entry);

  removeEndOverlay();

  const overlay = document.createElement("div");
  overlay.id = "endOverlay";
  overlay.className = "modal";
  overlay.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>Round complete — ${escapeHtml(entry.team)}</h2>
      </div>
      <div class="card-body">
        <div class="two-col">
          <div>
            <p><strong>Score:</strong> ${entry.score}px</p>
            <p><strong>Structure standing:</strong> ${entry.standing ? "Yes" : "No"}</p>
            <p><strong>Marshmallow on top:</strong> ${entry.onTop ? "Yes" : "No"}</p>
            <p><strong>Valid finish:</strong> ${entry.valid ? "Yes ✅" : "No"}</p>
          </div>
          <div>
            <h3 style="margin:0 0 8px;">Multi-team leaderboard</h3>
            <ol id="overlayLeaderboard" class="leaderboard-list"></ol>
            <div id="overlayLeaderboardEmpty" class="muted">No saved scores yet.</div>
          </div>
        </div>

        <div>
          <h3 style="margin:0 0 8px;">Debrief prompts for retrospectives</h3>
          <p class="muted">Capture team-role notes and export them straight into your retrospective pack.</p>
        </div>

        <label>
          1. Who naturally stepped into leadership, coordination, or build roles?
          <textarea data-prompt="Who naturally stepped into leadership, coordination, or build roles?"></textarea>
        </label>

        <label>
          2. What assumptions did the team make early, and when were those assumptions tested?
          <textarea data-prompt="What assumptions did the team make early, and when were those assumptions tested?"></textarea>
        </label>

        <label>
          3. Did the team lean more towards planning or experimentation, and what effect did that have?
          <textarea data-prompt="Did the team lean more towards planning or experimentation, and what effect did that have?"></textarea>
        </label>

        <label>
          4. What lesson should this team carry into future remote projects or retrospectives?
          <textarea data-prompt="What lesson should this team carry into future remote projects or retrospectives?"></textarea>
        </label>

        <div class="btn-row">
          <button id="downloadCsvBtn" type="button">Download debrief CSV</button>
          <button id="copyRetroBtn" class="secondary" type="button">Copy retro summary</button>
          <button id="nextTeamBtn" class="ghost" type="button">Next team</button>
          <button id="playAgainBtn" class="ghost" type="button">Replay same team</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const overlayLeaderboard = overlay.querySelector("#overlayLeaderboard");
  const overlayLeaderboardEmpty = overlay.querySelector("#overlayLeaderboardEmpty");
  renderLeaderboard(overlayLeaderboard, overlayLeaderboardEmpty);
  renderLeaderboard(setupLeaderboardEl, setupLeaderboardEmptyEl);

  const getAnswers = () => Array.from(overlay.querySelectorAll("textarea")).map(area => ({
    prompt: area.dataset.prompt,
    response: area.value.trim()
  }));

  overlay.querySelector("#downloadCsvBtn").addEventListener("click", () => {
    const file = buildCsv(entry, getAnswers());
    const safeTeam = entry.team.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "team";
    downloadFile(`${safeTeam}-retrospective.csv`, file, "text/csv;charset=utf-8");
  });

  overlay.querySelector("#copyRetroBtn").addEventListener("click", async () => {
    const text = buildRetroText(entry, getAnswers());
    try {
      await navigator.clipboard.writeText(text);
      announceWarning("Retro summary copied to clipboard");
    } catch {
      downloadFile("retrospective.txt", text, "text/plain;charset=utf-8");
    }
  });

  overlay.querySelector("#nextTeamBtn").addEventListener("click", () => {
    setupModal.style.display = "flex";
    teamNameInput.value = "";
    teamSizeInput.value = "4";
    removeEndOverlay();
    currentTeam = { name: "", size: 4, startedAt: null };
    updateUI();
  });

  overlay.querySelector("#playAgainBtn").addEventListener("click", () => {
    removeEndOverlay();
    paused = false;
    resetRunState();
  });
}

function initialiseSetup() {
  const savedTeam = localStorage.getItem(LAST_TEAM_KEY);

  if (savedTeam) {
    try {
      const parsed = JSON.parse(savedTeam);
      if (parsed.name) teamNameInput.value = parsed.name;
      if (parsed.size) teamSizeInput.value = parsed.size;
    } catch {
      // ignore corrupt local storage
    }
  }

  renderLeaderboard(setupLeaderboardEl, setupLeaderboardEmptyEl);
  updateUI();
  startTimerLoop();
}

createGround();
resetRunState();
initialiseSetup();
