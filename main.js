const { Engine, Render, Runner, World, Bodies, Events, Body } = Matter;

/* =========================
   DOM references
========================= */
const canvas = document.getElementById("game");
const timeEl = document.getElementById("time");
const countEl = document.getElementById("count");
const scoreEl = document.getElementById("score");
const rotationEl = document.getElementById("rotation");
const statusEl = document.getElementById("status");
const addBtn = document.getElementById("add");
const resetBtn = document.getElementById("reset");

/* Optional rotate buttons */
const rotateLeftBtn = document.getElementById("rotateLeft");
const rotateRightBtn = document.getElementById("rotateRight");

/* Optional final panel (safe if not present) */
const finalPanel = document.getElementById("finalPanel");
const finalTitle = document.getElementById("finalTitle");
const finalMessage = document.getElementById("finalMessage");
const finalScore = document.getElementById("finalScore");
const finalHeight = document.getElementById("finalHeight");
const finalUsed = document.getElementById("finalUsed");
const finalMarshmallow = document.getElementById("finalMarshmallow");
const playAgainBtn = document.getElementById("playAgain");
const closePanelBtn = document.getElementById("closePanel");

/* =========================
   Constants
========================= */
const GROUND_HEIGHT = 80;
const HUD_SAFE_WIDTH = 380;
const HUD_SAFE_HEIGHT = 280;
const SPAGHETTI_LENGTH = 140;
const SPAGHETTI_THICKNESS = 6;
const ROTATION_STEP = Math.PI / 12; // 15 degrees

/* =========================
   Game state
========================= */
let engine;
let render;
let runner;
let ground;
let leftWall;
let rightWall;

let spaghettiBodies = [];
let marshmallowBody = null;

let spaghettiLeft = 20;
let marshmallowPlaced = false;
let gameEnded = false;
let timeLeft = 30; // change to 18 * 60 later if you want
let countdownInterval = null;
let stabilityInterval = null;
let score = 0;

/* Preview / placement */
let previewX = window.innerWidth / 2;
let previewY = window.innerHeight / 2;
let nextRotation = 0;

/* Listener guards */
let staticListenersAttached = false;
let keyboardListenerAttached = false;

/* =========================
   Initialisation
========================= */
function initGame() {
  clearTimers();

  spaghettiBodies = [];
  marshmallowBody = null;
  spaghettiLeft = 20;
  marshmallowPlaced = false;
  gameEnded = false;
  timeLeft = 30; // test value; switch to 18 * 60 later
