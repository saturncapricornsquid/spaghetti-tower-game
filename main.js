document.addEventListener("DOMContentLoaded", () => {

  const {
    Engine, Render, Runner, World, Bodies,
    Constraint, Mouse, MouseConstraint, Composite,
    Events, Body, Query
  } = Matter;

  /* ========== CONFIG ========== */

  const GAME_DURATION = 10 * 60;
  const PX_PER_CM = 4;

  /* ========== DOM ========== */

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

  /* ========== STATE ========== */

  let running = false;
  let paused = true;
  let gameEnded = false;
  let timeLeft = GAME_DURATION;

  let spaghetti = [];
  let teams = [];

  /* ========== ENGINE ========== */

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

  /* ========== HELPERS ========== */

  function setToast(html) {
    toastEl.innerHTML = html;
  }

  function syncTeamLabel() {
    brandTeamLabel.textContent =
      `Team/Person: ${teamNameInput.value || "—"}`;
  }

  function renderTeamsTable() {
    if (teams.length === 0) {
      teamsTableBody.innerHTML =
        `<tr><td colspan="4" class="muted">No teams added yet.</td></tr>`;
      return;
    }

    teamsTableBody.innerHTML = teams.map((t, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${t.name}</td>
        <td>${t.height ?? "—"}</td>
        <td>${t.result ?? "—"}</td>
      </tr>
    `).join("");
  }

  function ensureTeamExists(name) {
    if (!teams.some(t => t.name === name)) {
      teams.push({ name });
      renderTeamsTable();
    }
  }

  /* ========== BUTTONS ========== */

  startBtn.onclick = () => {
    const name = teamNameInput.value.trim() || "Unnamed team/person";

    ensureTeamExists(name);
    syncTeamLabel();

    running = true;
    paused = false;
    engine.timing.timeScale = 1;

    setToast(
      `<strong>Building started</strong> for ${name}. Add spaghetti to begin.`
    );
  };

  stopBtn.onclick = () => {
    paused = !paused;
    engine.timing.timeScale = paused ? 0 : 1;
    stopBtn.textContent = paused ? "Resume" : "Stop";
  };

  resetBtn.onclick = () => {
    location.reload();
  };

});
