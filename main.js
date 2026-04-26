// DOM
var modeEl = document.getElementById("mode");
var rotationEl = document.getElementById("rotation");
var canvas = document.getElementById("game");

// Score display
var scoreEl = document.createElement("div");
scoreEl.textContent = "Score: 0";
document.getElementById("hud").appendChild(scoreEl);

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
var marshmallows = [];

var engine, render, runner;

var SNAP_DISTANCE = 25;

// Init
function initGame() {
  if (runner) Runner.stop(runner);
  if (render) Render.stop(render);

  spaghetti = [];
  marshmallows = [];
  mode = "spaghetti";
  rotation = 0;

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
}

// HUD
function updateHUD() {
  modeEl.textContent = mode;
  rotationEl.textContent = rotation;
}

// Distance helper
function distance(a, b) {
  return Math.sqrt(
    (a.x - b.x) * (a.x - b.x) +
    (a.y - b.y) * (a.y - b.y)
  );
}

// Endpoints
function getEndpoints(body) {
  var angle = body.angle;
  var half = 70;

  var cos = Math.cos(angle);
  var sin = Math.sin(angle);

  return [
    {
      x: body.position.x - half * cos,
      y: body.position.y - half * sin
    },
    {
      x: body.position.x + half * cos,
      y: body.position.y + half * sin
    }
  ];
}

// Glue
function glueStick(stick) {
  var endpoints = getEndpoints(stick);

  for (var i = 0; i < endpoints.length; i++) {
    var point = endpoints[i];

    for (var j = 0; j < marshmallows.length; j++) {
      var m = marshmallows[j];

      if (distance(point, m.position) < SNAP_DISTANCE) {
        var c = Constraint.create({
          bodyA: m,
          bodyB: stick,
          pointB: {
            x: point.x - stick.position.x,
            y: point.y - stick.position.y
          },
          stiffness: 0.95,
          damping: 0.2,
          length: 0
        });

        World.add(engine.world, c);
      }
    }
  }
}

// Create spaghetti
function createSpaghetti(x, y) {
  var stick = Bodies.rectangle(x, y, 140, 6, {
    isStatic: true,
    render: { fillStyle: "#f4d03f" }
  });

  Body.setAngle(stick, (rotation * Math.PI) / 180);

  World.add(engine.world, stick);
  spaghetti.push(stick);

  glueStick(stick);
}

// Create marshmallow
function createMarshmallow(x, y) {
  var m = Bodies.circle(x, y, 12, {
    isStatic: true,
    render: { fillStyle: "#fffaf5" }
  });

  World.add(engine.world, m);
  marshmallows.push(m);

  for (var i = 0; i < spaghetti.length; i++) {
    glueStick(spaghetti[i]);
  }
}

// Click placement
document.addEventListener("click", function (event) {
  if (event.target.closest("#hud")) return;

  var x = event.clientX;
  var y = event.clientY;

  if (mode === "spaghetti") {
    createSpaghetti(x, y);
  } else {
    createMarshmallow(x, y);
  }
});

// Buttons
document.getElementById("toggle").onclick = function () {
  mode = mode === "spaghetti" ? "marshmallow" : "spaghetti";
  updateHUD();
};

document.getElementById("rotate").onclick = function () {
  rotation += 15;
  updateHUD();
};

document.getElementById("reset").onclick = function () {
  initGame();
};

// Score
function updateScore() {
  var highest = canvas.height;
  var allBodies = spaghetti.concat(marshmallows);

  for (var i = 0; i < allBodies.length; i++) {
    if (allBodies[i].position.y < highest) {
      highest = allBodies[i].position.y;
    }
  }

  var score = Math.max(0, Math.round(canvas.height - highest));
  scoreEl.textContent = "Score: " + score;
}

// Start
initGame();

console.log("✅ Compatible version running");
