// ==============================
// MATTER SETUP
, ground);// ==============================


// ==============================
// MOUSE CONTROL (DRAG)
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

// Track selected object
Matter.Events.on(mouseConstraint, "startdrag", (event) => {
    selectedBody = event.body;
});

Matter.Events.on(mouseConstraint, "enddrag", () => {
    selectedBody = null;
});


// ==============================
// ADD SPAGHETTI
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


// ==============================
// ADD GLUE (CONSTRAINT)
// ==============================
function addGlue(bodyA, bodyB) {
    if (!bodyA || !bodyB || bodyA === bodyB) return;

    const joint = Constraint.create({
        bodyA,
        bodyB,
        stiffness: 0.9,
        length: 0,
        render: {
            strokeStyle: "yellow",
            lineWidth: 3
        }
    });

    glue.push(joint);
    World.add(world, joint);
}


// ==============================
// CLICK INTERACTION
// ==============================
canvas.addEventListener("mousedown", () => {
    if (gameEnded) return;

    const mousePos = mouse.position;

    const bodies = Matter.Composite.allBodies(world);

    const clicked = bodies.find(body =>
        Matter.Bounds.contains(body.bounds, mousePos)
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
// DELETE (SPAGHETTI + GLUE)
// ==============================
window.addEventListener("keydown", (e) => {
    if (e.key === "Delete" || e.key === "Backspace") {
        if (!selectedBody) return;

        // Remove spaghetti
        spaghetti = spaghetti.filter(s => {
            if (s === selectedBody) {
                World.remove(world, s);
                return false;
            }
            return true;
        });

        // Remove glue attached
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
// DELETE GLUE DIRECTLY (DOUBLE CLICK)
// ==============================
canvas.addEventListener("dblclick", () => {
    const mousePos = mouse.position;

    glue = glue.filter(g => {
        const midX = (g.bodyA.position.x + g.bodyB.position.x) / 2;
        const midY = (g.bodyA.position.y + g.bodyB.position.y) / 2;

        const dist = Math.hypot(midX - mousePos.x, midY - mousePos.y);

        if (dist < 20) {
            World.remove(world, g);
            return false;
        }
        return true;
    });
});


// ==============================
// SCORING (HEIGHT)
// ==============================
function calculateScore() {
    if (spaghetti.length === 0) return 0;

    let highestY = window.innerHeight;

    spaghetti.forEach(body => {
        if (body.position.y < highestY) {
            highestY = body.position.y;
        }
    });

    const groundY = window.innerHeight - 20;
    return Math.max(0, Math.round(groundY - highestY));
}

Matter.Events.on(engine, "afterUpdate", () => {
    if (gameEnded) return;

    score = calculateScore();

    if (score > maxHeight) {
        maxHeight = score;
    }

    updateScoreDisplay();
});


// ==============================
// SCORE UI
// ==============================
function updateScoreDisplay() {
    let el = document.getElementById("score");

    if (!el) {
        el = document.createElement("div");
        el.id = "score";

        Object.assign(el.style, {
            position: "absolute",
            top: "10px",
            left: "10px",
            background: "rgba(0,0,0,0.7)",
            color: "white",
            padding: "10px",
            borderRadius: "8px"
        });

        document.body.appendChild(el);
    }

    el.innerHTML = `Height: ${score}px<br>Best: ${maxHeight}px`;
}


// ==============================
// TIMER
// ==============================
function startTimer() {
    timerInterval = setInterval(() => {
        if (gameEnded) return;

        timeLeft--;

        if (timeLeft <= 0) {
            endGame();
        }

        updateTimerDisplay();
    }, 1000);
}

function updateTimerDisplay() {
    let el = document.getElementById("timer");

    if (!el) {
        el = document.createElement("div");
        el.id = "timer";

        Object.assign(el.style, {
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "rgba(0,0,0,0.7)",
            color: "white",
            padding: "10px",
            borderRadius: "8px"
        });

        document.body.appendChild(el);
    }

    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;

    el.innerHTML = `Time: ${m}:${s.toString().padStart(2, "0")}`;

    if (timeLeft < 60) {
        el.style.background = "red";
    }
}


// ==============================
// END GAME
// ==============================
function endGame() {
    gameEnded = true;
    clearInterval(timerInterval);

    showFinalScore();
}

function showFinalScore() {
    const overlay = document.createElement("div");

    Object.assign(overlay.style, {
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.8)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        color: "white"
    });

    overlay.innerHTML = `
        <h1>Time's Up!</h1>
        <h2>Final Height: ${maxHeight}px</h2>
        <button id="restartBtn">Restart</button>
    `;

    document.body.appendChild(overlay);

    document.getElementById("restartBtn").onclick = () => location.reload();
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

// Renderer
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

// Scoring
let score = 0;
let maxHeight = 0;

// Timer
const GAME_DURATION = 10 * 60;
let timeLeft = GAME_DURATION;
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
