const ACTIVE_PLAYER_KEY = 'tlp.activePlayerId';

export function getActivePlayerId() {
  return localStorage.getItem(ACTIVE_PLAYER_KEY);
}

export function setActivePlayerId(playerId) {
  localStorage.setItem(ACTIVE_PLAYER_KEY, playerId);
}

export function clearActivePlayerId() {
  localStorage.removeItem(ACTIVE_PLAYER_KEY);
}

/**
 * Returns the active player id, or redirects to the login page and returns
 * null if none is set yet. Call this at the top of any page that needs a
 * player identity.
 * @param {string} loginPagePath relative path to pages/login/index.html from the calling page
 */
export function requireActivePlayerId(loginPagePath) {
  const id = getActivePlayerId();
  if (!id) {
    window.location.href = loginPagePath;
    return null;
  }
  return id;
}
