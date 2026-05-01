const {
  Engine, Render, Runner, World, Bodies,
  Constraint, Mouse, MouseConstraint, Composite,
  Events, Bounds, Body, Vector
} = Matter;

const GAME_DURATION = 10 * 60;
const PX_PER_CM = 4;
const TOP_TOLERANCE_PX = 3;

/* DOM */
const canvas = document.getElementById("game");
const toastEl = document.getElementById("toast");
const timerEl = document.getElementById("timer");
const materialsEl = document.getElementById("materials");
const heightEl = document.getElementById("height");
const teamNameInput = document.getElementById("teamName");
const teamsTableBody = document.getElementById("teamsTableBody");
const brandTeamLabel = document.getElementById("brandTeamLabel");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const resetBtn = document.getElementById("resetBtn");
const glueBtn = document.getElementById("glueBtn");
const addSpaghettiBtn = document.getElementById("addSpaghettiBtn");

/* STATE */
let timeLeft = GAME_DURATION;
let running = false;
let paused = true;
let gameEnded = false;
let currentHeightCm = 0;

let teams = []; // { name, heightCm, result }

let spaghetti = [];
let joints = [];
let topPiece = null;
let selectedBody = null;

let glueMode = false;
let glueFirst = null;

/* ENGINE */
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

/* HELPERS */
function setToast(html){ toastEl.innerHTML = html; }

function formatTime(s){
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
}

function getTeamName(){
  return teamNameInput.value.trim() || "Unnamed";
}

function updateTeamsTable(){
  if(!teams.length){
    teamsTableBody.innerHTML =
      `<tr><td colspan="4" class="muted">No teams added yet.</td></tr>`;
    return;
  }

  teamsTableBody.innerHTML = teams.map((t,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${t.name}</td>
      <td>${t.heightCm ?? "—"} cm</td>
      <td>${t.result ?? "—"}</td>
    </tr>
  `).join("");
}

function recordTeam(){
  const name = getTeamName();
  brandTeamLabel.textContent = `Team/Person: ${name}`;

  if(!teams.find(t=>t.name===name)){
    teams.push({ name, heightCm:null, result:null });
    updateTeamsTable();
  }
}

/* WORLD SETUP */
function createGround(){
  World.clear(world,false);
  const ground = Bodies.rectangle(
    window.innerWidth/2,
    window.innerHeight-20,
    window.innerWidth,
    40,
    { isStatic:true }
  );
  World.add(world,ground);
  return ground;
}

let ground = createGround();

function createTopPiece(){
  topPiece = Bodies.circle(
    window.innerWidth/2,
    window.innerHeight/2-120,
    18,
    { render:{ fillStyle:"#ffd6e7", strokeStyle:"#fb7185" } }
  );
  World.add(world,topPiece);
}

createTopPiece();

/* MOUSE */
const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine,{ mouse });
World.add(world,mouseConstraint);
render.mouse = mouse;

Events.on(mouseConstraint,"startdrag",e=>{
  selectedBody = e.body;
});

/* ROTATION */
window.addEventListener("keydown",e=>{
  if(!selectedBody || paused) return;
  if(e.key==="q") Body.rotate(selectedBody,-0.05);
  if(e.key==="e") Body.rotate(selectedBody,0.05);
});

/* ADD SPAGHETTI */
function addSpaghetti(x,y){
  const s = Bodies.rectangle(x,y,90,7,{
    friction:0.8,
    frictionAir:0.04,
    render:{ fillStyle:"#7a3f00" }
  });
  spaghetti.push(s);
  World.add(world,s);
  materialsEl.textContent = spaghetti.length;
  selectedBody = s;
}

addSpaghettiBtn.onclick = ()=>{
  if(!running||paused) return;
  addSpaghetti(window.innerWidth/2,window.innerHeight/2);
  setToast("Spaghetti added.");
};

/* GLUE */
glueBtn.onclick = ()=>{
  glueMode = !glueMode;
  glueFirst = null;
  glueBtn.classList.toggle("active",glueMode);
  setToast(glueMode ? "Glue ON: select two stick ends." : "Glue OFF.");
};

canvas.addEventListener("mousedown",()=>{
  if(!glueMode||paused) return;
  if(!selectedBody) return;

  if(!glueFirst){
    glueFirst = selectedBody;
    setToast("First stick selected — choose second.");
    return;
  }

  if(glueFirst!==selectedBody){
    const c = Constraint.create({
      bodyA: glueFirst,
      bodyB: selectedBody,
      stiffness: 0.98,
      damping:0.2
    });
    World.add(world,c);
    joints.push(c);

    glueFirst.frictionAir = selectedBody.frictionAir = 0.08;
    glueFirst = null;
    setToast("Glue applied.");
  }
});

/* START / STOP / RESET */
startBtn.onclick = ()=>{
  recordTeam();
  running = true;
  paused = false;
  engine.timing.timeScale = 1;
  setToast("Building started.");
};

stopBtn.onclick = ()=>{
  paused=!paused;
  engine.timing.timeScale = paused?0:1;
  stopBtn.textContent = paused?"Resume":"Stop";
};

resetBtn.onclick = ()=>{
  window.location.reload();
};

/* HEIGHT */
Events.on(engine,"afterUpdate",()=>{
  const bodies = Composite.allBodies(world);
  const ys = bodies.map(b=>b.bounds.min.y);
  const hPx = ground.bounds.min.y - Math.min(...ys);
  currentHeightCm = Math.max(0,Math.round(hPx/PX_PER_CM));
  heightEl.textContent = `${currentHeightCm} cm`;
});

/* TIMER */
setInterval(()=>{
  if(!running||paused||gameEnded) return;
  timeLeft--;
  timerEl.textContent = `⏱ ${formatTime(timeLeft)}`;

  if(timeLeft<=0){
    gameEnded=true;
    paused=true;
    engine.timing.timeScale=0;

    const team = teams.find(t=>t.name===getTeamName());
    const bodies = Composite.allBodies(world);
    const topY = topPiece.bounds.min.y;
    const highestY = Math.min(...bodies.map(b=>b.bounds.min.y));

    if(team){
      team.heightCm = currentHeightCm;
      team.result = topY<=highestY+TOP_TOLERANCE_PX ? "Winner" : "No winner";
      updateTeamsTable();
    }

    setToast(`Finished. ${team?.result ?? "No winner"}.`);
  }
},1000);
