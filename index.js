import { getActivePlayerId, clearActivePlayerId } from './services/playerSession.js';
import { getPlayer } from './services/playerRepository.js';

const playerId = getActivePlayerId();

if (!playerId) {
  window.location.href = 'pages/login/index.html';
} else {
  const player = await getPlayer(playerId);

  const label = document.getElementById('active-player-label');
  if (label) {
    label.textContent = `Playing as ${player.name}`;
  }

  const switchButton = document.getElementById('switch-player-btn');
  if (switchButton) {
    switchButton.addEventListener('click', () => {
      clearActivePlayerId();
      window.location.href = 'pages/login/index.html';
    });
  }
}
