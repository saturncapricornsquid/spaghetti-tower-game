/* global document, window, Matter *//* global DOM
var modeEl = document.getElementById("mode");
var rotationEl = document.getElementById("rotation");
var scoreEl = document.getElementById("score");
var timerEl = document.getElementById("timer");
var canvas = document.getElementById("game");

// Matter
var Engine = Matter.Engine;
var Render = Matter.Render;
var Runner = Matter.Runner;
var World = Matter.World;
var Bodies = Matter.Bodies;
var Body = Matter.Body;
var Constraint = Matter.Constraint;
var Mouse = Matter.Mouse;
var MouseConstraint = Matter.MouseConstraint;
var Events = Matter.Events;

// State
var mode = "spaghetti";
var rotation = 0;
var spaghetti = [];
var glue = [];
var constraints = [];

var engine, render, runner;

var GRID = 20;
var SNAP_DISTANCE = 25;
var bestScore = 0;

// Preview
var preview = null;

// Snap to grid
function snap(v) {
  return Math.round(v / GRID) * GRID;
}

// Init
function initGame() {
  spaghetti = [];
  glue = [];
  constraints = [];

  engine = Engine.create();
  engine.world.gravity.y = 0;

  render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
      width: window.innerWidth,
      height: window.innerHeight,
      wireframes: false,
      background: "#f4f4f4"
    }
  });

  runner = Runner.create();

  var ground = Bodies.rectangle(
    window.innerWidth / 2,
    window.innerHeight - 40,
    window.innerWidth,
    80,
    { isStatic: true }
  );

  World.add(engine.world, [ground]);

  // ✅ Dragging enabled
  var mouse = Mouse.create(canvas);
  var mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: { stiffness: 0.2 }
  });

  World.add(engine.world, mouseConstraint);
  render.mouse = mouse;

  Render.run(render);
  Runner.run(runner, engine);

  Events.on(engine, "afterUpdate", updateScore);
}

// Distance
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Glue snapping
function glueStick(stick) {
  glue.forEach(function(g) {
    if (dist(g.position, stick.position) < SNAP_DISTANCE) {
      var c = Constraint.create({
        bodyA: g,
        bodyB: stick,
        stiffness: 0.9
      });
      constraints.push(c);
      World.add(engine.world, c);
    }
  });
}

// Create spaghetti
function createSpaghetti(x, y) {
  var s = Bodies.rectangle(x, y, 140, 6, {
    isStatic: true,
    render: { fillStyle: "#f4d03f" }
  });

  Body.setAngle(s, rotation * Math.PI / 180);

  World.add(engine.world, s);
  spaghetti.push(s);
  glueStick(s);
}

// Create glue
function createGlue(x, y) {
  var g = Bodies.circle(x, y, 12, {
    isStatic: true,
    render: { fillStyle: "#3498db" }
  });

  World.add(engine.world, g);
  glue.push(g);

  spaghetti.forEach(glueStick);
}

// ✅ Ghost preview
document.addEventListener("mousemove", function(e) {
  var x = snap(e.clientX);
  var y = snap(e.clientY);

  if (preview) World.remove(engine.world, preview);

  if (mode === "spaghetti") {
    preview = Bodies.rectangle(x, y, 140, 6, {
      isStatic: true,
      render: { fillStyle: "rgba(244,208,63,0.4)" }
    });
  } else {
    preview = Bodies.circle(x, y, 12, {
      isStatic: true,
      render: { fillStyle: "rgba(52,152,219,0.4)" }
    });
  }

  World.add(engine.world, preview);
});

// Click placement
document.addEventListener("click", function(e) {
  if (e.target.closest("#hud")) return;

  var x = snap(e.clientX);
  var y = snap(e.clientY);

  if (mode === "spaghetti") {
    createSpaghetti(x, y);
  } else {
    createGlue(x, y);
  }
});

// Buttons
document.getElementById("toggle").onclick = function() {
  mode = mode === "spaghetti" ? "glue" : "spaghetti";
  modeEl.textContent = mode;
};

document.getElementById("rotate").onclick = function() {
  rotation += 15;
  rotationEl.textContent = rotation;
};

document.getElementById("reset").onclick = function() {
  initGame();
};

// Score + leaderboard
function updateScore() {
  var highest = window.innerHeight;

  spaghetti.concat(glue).forEach(function(b) {
    if (b.position.y < highest) highest = b.position.y;
  });

  var score = Math.round(window.innerHeight - highest);

  if (score > bestScore) bestScore = score;

  scoreEl.textContent = "Score: " + score + " | Best: " + bestScore;
}

// Start
initGame();

