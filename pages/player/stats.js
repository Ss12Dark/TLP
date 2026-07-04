import { getPlayer, getPlayerStatistics, resetPlayer } from '../../services/playerRepository.js';
import { showConfirmDialog } from '../shared/confirmDialog.js';
import { requireActivePlayerId } from '../../services/playerSession.js';

const playerId = requireActivePlayerId('../login/index.html');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

const ROOT_PREFIX = '../../';

function renderHistory(history) {
  if (!history || history.length === 0) {
    return '<p class="empty-state">No history yet.</p>';
  }
  const rows = [...history]
    .sort((a, b) => new Date(b.defeatedAt) - new Date(a.defeatedAt))
    .map(
      (entry) => `
        <li>
          <a href="${ROOT_PREFIX}${entry.link}">${escapeHtml(entry.name)}</a>
          <span class="badge">${escapeHtml(entry.type)}</span>
        </li>
      `
    )
    .join('');
  return `<ul class="history-list">${rows}</ul>`;
}

async function render() {
  const main = document.getElementById('player-main');
  const [player, statistics] = await Promise.all([getPlayer(playerId), getPlayerStatistics(playerId)]);

  main.innerHTML = `
    <section class="entity-card">
      <div class="card-title">
        <h3>${escapeHtml(player.name)}</h3>
        <span class="badge">${escapeHtml(player.rank)}</span>
      </div>
      <div class="badge-row">
        <span class="badge">Level ${player.level}</span>
        <span class="badge">XP ${player.xp}</span>
        <span class="badge">Gold ${player.gold}</span>
        <span class="badge">Energy ${player.energy}</span>
      </div>
    </section>

    <section class="entity-card">
      <h3>Statistics</h3>
      <div class="badge-row">
        <span class="badge">Monsters defeated ${statistics.monsterDefeated}</span>
        <span class="badge">Elites defeated ${statistics.eliteDefeated}</span>
        <span class="badge">Objectives claimed ${statistics.objectiveClaimed}</span>
        <span class="badge">Energy wasted ${statistics.energyWasted}</span>
        <span class="badge">Total XP gained ${statistics.totalXpGained}</span>
      </div>
    </section>

    <section class="entity-card">
      <h3>History</h3>
      ${renderHistory(statistics.history)}
    </section>

    <section class="entity-card">
      <button type="button" id="reset-player-btn" class="btn btn-danger btn-block">⚠ Reset Player Data</button>
    </section>
  `;

  document.getElementById('reset-player-btn').addEventListener('click', onResetClick);
}

async function onResetClick() {
  const confirmed = await showConfirmDialog(
    'Reset all player data and statistics? This cannot be undone. Monsters, quests, and dungeons will not be affected.',
    { confirmLabel: 'Reset' }
  );
  if (!confirmed) return;
  await resetPlayer(playerId);
  await render();
}

if (playerId) {
  render();
}
