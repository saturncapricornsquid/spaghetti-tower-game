// ==============================
// MATTER SETUP
// =============================Left = GAME_DURATION;// ==============================
let gameEnded = false;
let timerInterval = null;


// ==============================
// GROUND
// ==============================
const ground = Bodies.rectangle(
    window.innerWidth / 2,
    window.innerHeight - 20,
    window.innerWidth,
    40,
    { isStatic: true }
);
World.add(world, ground);


// ==============================
// MOUSE CONTROL
// ==============================
const mouse = Mouse.create(render.canvas);

const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
        stiffness: 0.2,
        render: { visible: false }
    }
});

World.add(world, mouseConstraint);

Matter.Events.on(mouseConstraint, "startdrag", e => selectedBody = e.body);
Matter.Events.on(mouseConstraint, "enddrag", () => selectedBody = null);


// ==============================
// ADD OBJECTS
// ==============================
function addSpaghetti(x, y) {
    const stick = Bodies.rectangle(x, y, 60, 5, {
        friction: 0.5,
        restitution: 0.2,
        render: { fillStyle: "#c68642" }
    });

    spaghetti.push(stick);
    World.add(world, stick);
}

function addGlue(bodyA, bodyB) {
    if (!bodyA || !bodyB || bodyA === bodyB) return;

    const joint = Constraint.create({
        bodyA,
        bodyB,
        stiffness: 0.9,
        length: 0,
        render: { strokeStyle: "yellow", lineWidth: 3 }
    });

    glue.push(joint);
    World.add(world, joint);
}


// ==============================
// INTERACTION
// ==============================
canvas.addEventListener("mousedown", () => {
    if (gameEnded) return;

    const mousePos = mouse.position;
    const bodies = Matter.Composite.allBodies(world);

    const clicked = bodies.find(b =>
        Matter.Bounds.contains(b.bounds, mousePos)
    );

    if (!clicked) {
        addSpaghetti(mousePos.x, mousePos.y);
        lastBody = null;
    } else {
        if (lastBody && lastBody !== clicked) {
            addGlue(lastBody, clicked);
            lastBody = null;
        } else {
            lastBody = clicked;
        }
    }
});


// ==============================
// DELETE
// ==============================
window.addEventListener("keydown", (e) => {
    if ((e.key === "Delete" || e.key === "Backspace") && selectedBody) {

        spaghetti = spaghetti.filter(s => {
            if (s === selectedBody) {
                World.remove(world, s);
                return false;
            }
            return true;
        });

        glue = glue.filter(g => {
            if (g.bodyA === selectedBody || g.bodyB === selectedBody) {
                World.remove(world, g);
                return false;
            }
            return true;
        });

        selectedBody = null;
    }
});


// ==============================
// DELETE GLUE (DOUBLE CLICK)
// ==============================
canvas.addEventListener("dblclick", () => {
    const mousePos = mouse.position;

    glue = glue.filter(g => {
        const midX = (g.bodyA.position.x + g.bodyB.position.x) / 2;
        const midY = (g.bodyA.position.y + g.bodyB.position.y) / 2;

        if (Math.hypot(midX - mousePos.x, midY - mousePos.y) < 20) {
            World.remove(world, g);
            return false;
        }
        return true;
    });
});


// ==============================
// SCORING
// ==============================
function calculateScore() {
    if (spaghetti.length === 0) return 0;

    let highestY = window.innerHeight;

    spaghetti.forEach(b => {
        if (b.position.y < highestY) highestY = b.position.y;
    });

    return Math.max(0, Math.round((window.innerHeight - 20) - highestY));
}

Matter.Events.on(engine, "afterUpdate", () => {
    if (gameEnded) return;

    score = calculateScore();
    if (score > maxHeight) maxHeight = score;

    updateScoreDisplay();
});


// ==============================
// UI (SCORE + TIMER)
// ==============================
function createUI(id, styles) {
    let el = document.getElementById(id);

    if (!el) {
        el = document.createElement("div");
        el.id = id;
        Object.assign(el.style, styles);
        document.body.appendChild(el);
    }

    return el;
}

function updateScoreDisplay() {
    const el = createUI("score", {
        position: "absolute",
        top: "10px",
        left: "10px",
        background: "rgba(0,0,0,0.7)",
        color: "white",
        padding: "10px",
        borderRadius: "8px"
    });

    el.innerHTML = `Height: ${score}px<br>Best: ${maxHeight}px`;
}

function updateTimerDisplay() {
    const el = createUI("timer", {
        position: "absolute",
        top: "10px",
        right: "10px",
        background: timeLeft < 60 ? "red" : "rgba(0,0,0,0.7)",
        color: "white",
        padding: "10px",
        borderRadius: "8px"
    });

    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;

    el.innerHTML = `Time: ${m}:${s.toString().padStart(2, "0")}`;
}


// ==============================
// TIMER
// ==============================
function startTimer() {
    timerInterval = setInterval(() => {
        if (gameEnded) return;

        timeLeft--;

        if (timeLeft <= 0) endGame();

        updateTimerDisplay();
    }, 1000);
}


// ==============================
// LEADERBOARD
// ==============================
const KEY = "spaghettiLeaderboard";

function getLeaderboard() {
    return JSON.parse(localStorage.getItem(KEY)) || [];
}

function saveScore(name, score) {
    const list = getLeaderboard();

    list.push({ name, score });
    list.sort((a, b) => b.score - a.score);

    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 5)));
}


// ==============================
// END GAME
// ==============================
function endGame() {
    gameEnded = true;
    clearInterval(timerInterval);

    const name = prompt("Enter your name:", "Player");
    if (name) saveScore(name, maxHeight);

    const scores = getLeaderboard();

    const overlay = document.createElement("div");

    Object.assign(overlay.style, {
        position: "absolute",
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        color: "white"
    });

    overlay.innerHTML = `
        <h1>🏆 Time's Up!</h1>
        <h2>Your Height: ${maxHeight}px</h2>
        <h3>Leaderboard</h3>
        <ol>
            ${scores.map(s => `<li>${s.name} - ${s.score}px</li>`).join("")}
        </ol>
        <button onclick="location.reload()">Play Again</button>
    `;

    document.body.appendChild(overlay);
}


// ==============================
// INIT
// ==============================
startTimer();
updateTimerDisplay();
const { Engine, Render, Runner, World, Bodies, Constraint, Mouse, MouseConstraint } = Matter;

const engine = Engine.create();
const world = engine.world;

const canvas = document.getElementById("game");

const render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
        width: window.innerWidth,
        height: window.innerHeight,
        wireframes: false,
        background: "#f5f5f5"
    }
});

Render.run(render);
Runner.run(Runner.create(), engine);


// ==============================
// GAME STATE
// ==============================
let spaghetti = [];
let glue = [];

let selectedBody = null;
let lastBody = null;

let score = 0;
let maxHeight = 0;

// Timer
const GAME_DURATION = 10 * 60;
