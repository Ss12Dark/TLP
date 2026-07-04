import { findPlayerByName, createPlayer } from '../../services/playerRepository.js';
import { setActivePlayerId } from '../../services/playerSession.js';

const form = document.getElementById('login-form');
const nameInput = document.getElementById('player-name');
const errorEl = document.getElementById('login-error');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.textContent = '';

  const name = nameInput.value.trim();
  if (!name) {
    errorEl.textContent = 'Enter a name to continue.';
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const existing = await findPlayerByName(name);
    const playerId = existing ? existing.id : await createPlayer(name);
    setActivePlayerId(playerId);
    window.location.href = '../../index.html';
  } catch (err) {
    errorEl.textContent = 'Something went wrong. Please try again.';
    submitButton.disabled = false;
  }
});
