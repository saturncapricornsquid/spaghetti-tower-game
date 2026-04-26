/* global document, window, Matter */

// DOM
var modeEl = document.getElementById("mode");
var rotationEl = document.getElementById("rotation");
var scoreEl = document.getElementById("score");
var timerEl = document.getElementById("timer");
var canvas = document.getElementById("game");

// Matter.js
var Engine = Matter.Engine;
var Render = Matter.Render;
var Runner = Matter.Runner;
var World = Matter.World;
var Bodies = Matter.Bodies;
var Body = Matter.Body;
var Constraint = Matter.Constraint;
var Events = Matter.Events;

// State
var mode = "spaghetti";
var rotation = 0;
var spaghetti = [];
var glue = [];            // ✅ renamed from marshmallow
var constraints = [];

var engine, render, runner;

var SNAP_DISTANCE = 25;

// Challenge state
var challengeMode = false;
var finalPlaced = false;
var timer = 5;

// Init
function initGame() {
  if (runner) Runner.stop(runner);
  if (render) Render.stop(render);

  spaghetti = [];
  glue = [];
  constraints = [];

  mode = "spaghetti";
  rotation = 0;
  challengeMode = false;
  finalPlaced = false;
  timerEl.textContent = "Timer: --";

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  engine = Engine.create();
  engine.world.gravity.y = 0;

  render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
      width: canvas.width,
      height: canvas.height,
      wireframes: false,
      background: "#f4f4f4"
    }
  });

  runner = Runner.create();

  var ground = Bodies.rectangle(
    canvas.width / 2,
    canvas.height - 40,
    canvas.width,
    80,
    { isStatic: true }
  );

  World.add(engine.world, [ground]);

  Render.run(render);
  Runner.run(runner, engine);

  updateHUD();

  Events.on(engine, "afterUpdate", updateScore);
  Events.on(engine, "afterUpdate", checkBreakage);
}

// HUD ✅ (fixes mode text)
function updateHUD() {
  var text = mode;
  if (challengeMode) text += " (FINAL)";
  modeEl.textContent = text;
  rotationEl.textContent = rotation;
}

// Distance helper
function distance(a, b) {
  return Math.sqrt(
    (a.x - b.x) * (a.x - b.x) +
    (a.y - b.y) * (a.y - b.y)
  );
}

// Glue snapping
function glueStick(stick) {
  for (var i = 0; i < glue.length; i++) {
    var g = glue[i];

    if (distance(g.position, stick.position) < SNAP_DISTANCE) {
      var c = Constraint.create({
        bodyA: g,
        bodyB: stick,
        stiffness: 0.9,
        length: 0
      });

      constraints.push(c);
      World.add(engine.world, c);
    }
  }
}

// Create spaghetti
function createSpaghetti(x, y) {
  var stick = Bodies.rectangle(x, y, 140, 6, {
    isStatic: !challengeMode,
    render: { fillStyle: "#f4d03f" }
  });

  Body.setAngle(stick, rotation * Math.PI / 180);

  World.add(engine.world, stick);
  spaghetti.push(stick);

  glueStick(stick);
}

// Create glue ✅ (blue + renamed)
function createGlue(x, y, isFinal) {
  var g = Bodies.circle(x, y, isFinal ? 18 : 12, {
    isStatic: !challengeMode,
    render: { fillStyle: "#3498db" }
  });

  World.add(engine.world, g);
  glue.push(g);

  for (var i = 0; i < spaghetti.length; i++) {
    glueStick(spaghetti[i]);
  }

  if (isFinal) startTest();
}

// Click placement
document.addEventListener("click", function (event) {
  if (event.target.closest("#hud")) return;

  var x = event.clientX;
  var y = event.clientY;

  if (challengeMode && !finalPlaced) {
    finalPlaced = true;
    createGlue(x, y, true);
    return;
  }

  if (mode === "spaghetti") {
    createSpaghetti(x, y);
  } else {
    createGlue(x, y, false);
  }
});

// Buttons ✅ (fixes mode toggle text)
document.getElementById("toggle").onclick = function () {
  mode = mode === "spaghetti" ? "glue" : "spaghetti";
  updateHUD();
};

document.getElementById("rotate").onclick = function () {
  rotation += 15;
  updateHUD();
};

document.getElementById("reset").onclick = function () {
  initGame();
};

// Challenge trigger
document.addEventListener("keydown", function (e) {
  if (e.key.toLowerCase() === "t") {
    challengeMode = true;
    updateHUD();
    timer = 5;
    timerEl.textContent = "Timer: 5";
  }
});

// Start test
function startTest() {
  engine.world.gravity.y = 1;

  var allBodies = spaghetti.concat(glue);
  for (var i = 0; i < allBodies.length; i++) {
    Body.setStatic(allBodies[i], false);
  }

  var interval = setInterval(function () {
    timer--;
    timerEl.textContent = "Timer: " + timer;

    if (timer <= 0) {
      clearInterval(interval);
      showResult(true);
    }
  }, 1000);

  Events.on(engine, "afterUpdate", function () {
    for (var i = 0; i < glue.length; i++) {
      if (glue[i].position.y > canvas.height - 50) {
        showResult(false);
      }
    }
  });
}

// Break under stress
function checkBreakage() {
  for (var i = constraints.length - 1; i >= 0; i--) {
    var c = constraints[i];

    var dx = c.bodyA.position.x - c.bodyB.position.x;
    var dy = c.bodyA.position.y - c.bodyB.position.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 80) {
      World.remove(engine.world, c);
      constraints.splice(i, 1);
    }
  }
}

// ✅ Score (single clean version — no duplicates)
function updateScore() {
  var highest = canvas.height;
  var allBodies = spaghetti.concat(glue);

  for (var i = 0; i < allBodies.length; i++) {
    if (allBodies[i].position.y < highest) {
      highest = allBodies[i].position.y;
    }
  }

  var score = Math.max(0, Math.round(canvas.height - highest));
  scoreEl.textContent = "Score: " + score;
}

// UI result (no alerts)
function showResult(success) {
  var overlay = document.getElementById("overlay");
  var text = document.getElementById("resultText");

  overlay.style.display = "flex";
  text.textContent = success ? "✅ SUCCESS!" : "❌ COLLAPSE!";
}

// Start
initGame();
``
