/* Turn-taking state */
let players = ["Player 1", "Player 2", "Player 3"];
let currentPlayerIndex = 0;
let lastBuilder = "Player 1";

/* DOM references */
const currentPlayerEl = document.getElementById("currentPlayer");
const finalBuilder = document.getElementById("finalBuilder");

function updateCurrentPlayer() {
  if (currentPlayerEl) {
    currentPlayerEl.innerText = players[currentPlayerIndex];
  }
}

function advanceTurn() {
  lastBuilder = players[currentPlayerIndex];
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  updateCurrentPlayer();
}
