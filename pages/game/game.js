import { arrayUnion } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { Repository } from '../../services/repository.js';
import {
  getPlayer,
  getCurrentDungeonId,
  setCurrentDungeonId,
  recordMonsterSlain,
  recordQuestCompleted,
  recordFastFight,
  spendGold,
  spendEnergy,
} from '../../services/playerRepository.js';
import { getEventsConfig, getFastFightConfig } from '../../services/eventsConfig.js';
import { requireActivePlayerId } from '../../services/playerSession.js';
import {
  getDungeonProgress,
  getAllDungeonProgress,
  updateDungeonProgress,
  resetDungeonProgress,
} from '../../services/dungeonProgress.js';

const dungeonRepo = new Repository('dungeons');
const monsterRepo = new Repository('monsters');
const questRepo = new Repository('quests');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ICONS = {
  xp: '<img src="../../imgs/exp.png" class="stat-icon" alt="XP" />',
  gold: '<img src="../../imgs/gold.png" class="stat-icon" alt="Gold" />',
  energy: '<img src="../../imgs/energy.png" class="stat-icon" alt="Energy" />',
};

const root = document.getElementById('game-root');

const state = {
  playerId: null,
  player: null,
  dungeon: null,
  monsters: [],
  quests: [],
  slainMonsterIds: new Set(),
  completedQuestIds: new Set(),
  eventsConfig: { dayBonuses: [], doubleEarningsActive: false },
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function isDungeonCleared(dungeon, progress) {
  const monsterIds = dungeon.monsterIds ?? [];
  if (monsterIds.length === 0) return false;
  const slain = new Set(progress?.slainMonsterIds ?? []);
  return monsterIds.every((id) => slain.has(id));
}

function pickRandomDungeon(dungeons, progressMap, excludeId) {
  const available = dungeons.filter((d) => d.id !== excludeId);
  const fresh = available.filter((d) => !isDungeonCleared(d, progressMap[d.id]));
  const pool = fresh.length > 0 ? fresh : available.length > 0 ? available : dungeons;
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function loadDungeonView(dungeon) {
  if (!dungeon) return { monsters: [], quests: [] };
  const [allMonsters, allQuests] = await Promise.all([monsterRepo.getAll(), questRepo.getAll()]);
  const monsterIds = new Set(dungeon.monsterIds ?? []);
  const questIds = new Set(dungeon.questIds ?? []);
  return {
    monsters: allMonsters.filter((m) => monsterIds.has(m.id)),
    quests: allQuests.filter((q) => questIds.has(q.id)),
  };
}

async function enterDungeon(dungeon, progress) {
  state.dungeon = dungeon;
  state.slainMonsterIds = new Set(progress?.slainMonsterIds ?? []);
  state.completedQuestIds = new Set(progress?.completedQuestIds ?? []);
  const view = await loadDungeonView(dungeon);
  state.monsters = view.monsters;
  state.quests = view.quests;
}

async function startNewDungeon(excludeId = null) {
  const dungeons = await dungeonRepo.getAll();
  const progressMap = await getAllDungeonProgress(state.playerId);
  const dungeon = pickRandomDungeon(dungeons, progressMap, excludeId);
  let progress = dungeon ? progressMap[dungeon.id] : null;

  if (dungeon && isDungeonCleared(dungeon, progress)) {
    // No fresh dungeon exists to switch to (e.g. only one dungeon is set up) —
    // respawn this one's monsters/quests for this player instead of leaving it stuck cleared.
    await resetDungeonProgress(state.playerId, dungeon.id);
    progress = { slainMonsterIds: [], completedQuestIds: [] };
  }

  await enterDungeon(dungeon, progress);
  await setCurrentDungeonId(state.playerId, dungeon?.id ?? null);
}

function renderPlayer(player) {
  return `
    <section class="player-banner">
      <span class="player-avatar">🛡️</span>
      <div class="player-info">
        <h2>${escapeHtml(player.name)}</h2>
        <div class="badge-row">
          <span class="badge badge-rank">${escapeHtml(player.rank)}</span>
          <span class="badge badge-level">Lv ${player.level}</span>
        </div>
      </div>
      <div class="badge-row player-stats">
        <span class="badge">${ICONS.xp} ${player.xp}</span>
        <button type="button" class="badge badge-button" data-field="gold">${ICONS.gold} ${player.gold}</button>
        <button type="button" class="badge badge-button" data-field="energy">${ICONS.energy} ${player.energy}</button>
      </div>
    </section>
  `;
}

function renderDayBanner(eventsConfig) {
  const todayIndex = new Date().getDay();
  const day = DAY_NAMES[todayIndex];
  const bonus = (eventsConfig.dayBonuses ?? []).find((b) => b.day === todayIndex);

  const badges = [];
  if (eventsConfig.doubleEarningsActive) {
    badges.push('<span class="badge badge-event">🔥 2x XP &amp; Gold</span>');
  }
  if (bonus?.xpPercent) badges.push(`<span class="badge badge-event">${ICONS.xp} +${bonus.xpPercent}%</span>`);
  if (bonus?.goldPercent) badges.push(`<span class="badge badge-event">${ICONS.gold} +${bonus.goldPercent}%</span>`);
  if (bonus?.energyPercent) badges.push(`<span class="badge badge-event">${ICONS.energy} +${bonus.energyPercent}%</span>`);

  return `
    <div class="day-banner">
      <p>📅 Today is <strong>${day}</strong></p>
      ${badges.length ? `<div class="badge-row day-banner-badges">${badges.join('')}</div>` : ''}
    </div>
  `;
}

function renderMonsterCard(monster, isSlain) {
  const iconSrc = monster.is_elite ? '../../imgs/m2.png' : '../../imgs/m1.png';
  return `
    <button
      type="button"
      class="monster-card${isSlain ? ' is-slain' : ''}"
      data-id="${monster.id}"
      ${isSlain ? 'disabled' : ''}
    >
      <img class="monster-icon" src="${iconSrc}" alt="${monster.is_elite ? 'Elite monster' : 'Monster'}" />
      <span class="monster-name">${escapeHtml(monster.name)}</span>
      ${monster.is_elite ? '<span class="badge badge-elite">Elite</span>' : ''}
      <div class="badge-row">
        <span class="badge">${ICONS.xp} ${monster.xp_to_give_when_defeated ?? 0}</span>
        <span class="badge">${ICONS.gold} ${monster.gold_to_give_when_defeated ?? 0}</span>
        <span class="badge">${ICONS.energy} ${monster.energy_to_give_when_defeated ?? 0}</span>
      </div>
      ${isSlain ? '<span class="done-mark">✔ Slain</span>' : ''}
    </button>
  `;
}

function renderQuestRow(quest, isComplete) {
  return `
    <li>
      <button
        type="button"
        class="quest-row${isComplete ? ' is-complete' : ''}"
        data-id="${quest.id}"
        ${isComplete ? 'disabled' : ''}
      >
        <span class="quest-icon">📜</span>
        <div class="quest-info">
          <strong>${escapeHtml(quest.title)}</strong>
          <div class="badge-row">
            <span class="badge">${ICONS.xp} ${quest.xp_to_give_when_defeated ?? 0}</span>
            <span class="badge">${ICONS.gold} ${quest.gold_to_give_when_defeated ?? 0}</span>
            <span class="badge">${ICONS.energy} ${quest.energy_to_give_when_defeated ?? 0}</span>
          </div>
        </div>
        ${isComplete ? '<span class="done-mark">✔ Done</span>' : ''}
      </button>
    </li>
  `;
}

function render() {
  const { player, dungeon, monsters, quests, slainMonsterIds, completedQuestIds } = state;

  root.innerHTML = `
    <h1 class="game-headline">⚔ Conquer Life ⚔</h1>
    ${renderPlayer(player)}
    ${renderDayBanner(state.eventsConfig)}
    <button type="button" id="fast-fight-btn" class="btn btn-primary btn-block fast-fight-btn">⚡ Fast Fight</button>
    ${
      dungeon
        ? `
      <section class="entity-card dungeon-card">
        <div class="card-title">
          <h3>🏰 ${escapeHtml(dungeon.name)}</h3>
          <button type="button" id="spontaneous-monster-btn" class="btn btn-sm">🎲 Spontaneous Monster</button>
        </div>
        <div id="monster-grid" class="card-grid">
          ${
            monsters.length
              ? monsters.map((m) => renderMonsterCard(m, slainMonsterIds.has(m.id))).join('')
              : '<p class="empty-state">No monsters in this dungeon.</p>'
          }
        </div>
      </section>

      <section class="entity-card">
        <h3>📜 Quests</h3>
        <ul id="quest-list" class="quest-list">
          ${
            quests.length
              ? quests.map((q) => renderQuestRow(q, completedQuestIds.has(q.id))).join('')
              : '<li class="empty-state">No quests in this dungeon.</li>'
          }
        </ul>
      </section>
    `
        : '<p class="empty-state">No dungeons available yet. Create one to begin your conquest.</p>'
    }
  `;

  const grid = document.getElementById('monster-grid');
  if (grid) {
    grid.addEventListener('click', onMonsterClick);
  }

  const questList = document.getElementById('quest-list');
  if (questList) {
    questList.addEventListener('click', onQuestClick);
  }

  const spontaneousButton = document.getElementById('spontaneous-monster-btn');
  if (spontaneousButton) {
    spontaneousButton.addEventListener('click', onSpontaneousMonsterClick);
  }

  const playerStats = root.querySelector('.player-stats');
  if (playerStats) {
    playerStats.addEventListener('click', onStatClick);
  }

  const fastFightButton = document.getElementById('fast-fight-btn');
  if (fastFightButton) {
    fastFightButton.addEventListener('click', onFastFightClick);
  }
}

function formatAmount(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function showEarnedPopup(applied) {
  if (!applied) return;
  const parts = [];
  if (applied.xp) parts.push(`${ICONS.xp} +${formatAmount(applied.xp)}`);
  if (applied.gold) parts.push(`${ICONS.gold} +${formatAmount(applied.gold)}`);
  if (applied.energy) parts.push(`${ICONS.energy} +${formatAmount(applied.energy)}`);
  if (parts.length === 0) return;

  const popup = document.createElement('div');
  popup.className = 'earn-popup';
  popup.innerHTML = `<span class="earn-popup-shine"></span><span class="earn-popup-text">${parts.join(' &nbsp; ')}</span>`;
  document.body.appendChild(popup);

  setTimeout(() => popup.remove(), 2000);
}

let achievementPopupCount = 0;

function showAchievementPopup({ icon, title, subtitle, variant }) {
  const stackIndex = achievementPopupCount++;
  const popup = document.createElement('div');
  popup.className = `achievement-popup achievement-popup--${variant}`;
  popup.style.setProperty('--stack-index', stackIndex);
  popup.innerHTML = `
    <span class="achievement-popup-shine"></span>
    <span class="achievement-popup-icon">${icon}</span>
    <span class="achievement-popup-text">
      <strong>${escapeHtml(title)}</strong>
      ${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ''}
    </span>
  `;
  document.body.appendChild(popup);

  setTimeout(() => {
    popup.remove();
    achievementPopupCount = Math.max(0, achievementPopupCount - 1);
  }, 2000);
}

function showLevelAndRankPopups(applied) {
  if (!applied) return;
  if (applied.leveledUpTo) {
    showAchievementPopup({
      icon: '⬆️',
      title: 'Level Up!',
      subtitle: `Level ${applied.leveledUpTo}`,
      variant: 'level',
    });
  }
  if (applied.rankedUpTo) {
    showAchievementPopup({
      icon: '🎖️',
      title: 'Rank Up!',
      subtitle: applied.rankedUpTo,
      variant: 'rank',
    });
  }
}

async function onFastFightClick() {
  const button = document.getElementById('fast-fight-btn');
  button.disabled = true;

  const fastFightConfig = await getFastFightConfig();
  const applied = await recordFastFight(state.playerId, fastFightConfig);
  state.player = await getPlayer(state.playerId);

  showEarnedPopup(applied);
  showLevelAndRankPopups(applied);
  render();
}

function showAmountModal(title) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';
    backdrop.innerHTML = `
      <div class="dialog-box">
        <h3>${escapeHtml(title)}</h3>
        <form id="amount-form" class="entity-form">
          <div class="form-group">
            <label for="amount-input">Amount to subtract</label>
            <input type="number" id="amount-input" min="1" step="1" required />
          </div>
          <p class="form-error" id="amount-error"></p>
          <div class="dialog-actions">
            <button type="button" class="btn btn-ghost" data-action="cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Subtract</button>
          </div>
        </form>
      </div>
    `;

    const form = backdrop.querySelector('#amount-form');

    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop || event.target.dataset.action === 'cancel') {
        backdrop.remove();
        resolve(null);
      }
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const amount = Number(backdrop.querySelector('#amount-input').value);
      if (!Number.isFinite(amount) || amount <= 0) {
        backdrop.querySelector('#amount-error').textContent = 'Enter a positive number.';
        return;
      }
      backdrop.remove();
      resolve(amount);
    });

    document.body.appendChild(backdrop);
    backdrop.querySelector('#amount-input').focus();
  });
}

async function onStatClick(event) {
  const button = event.target.closest('.badge-button');
  if (!button) return;

  const field = button.dataset.field;
  const amount = await showAmountModal(field === 'gold' ? '🪙 Spend Gold' : '⚡ Spend Energy');
  if (amount === null) return;

  if (field === 'gold') {
    await spendGold(state.playerId, amount);
  } else {
    await spendEnergy(state.playerId, amount);
  }

  state.player = await getPlayer(state.playerId);
  render();
}

function showSpontaneousMonsterModal() {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';
    backdrop.innerHTML = `
      <div class="dialog-box dialog-box-wide">
        <h3>🎲 Spontaneous Monster</h3>
        <form id="spontaneous-monster-form" class="entity-form">
          <div class="form-group">
            <label for="sm-name">Name</label>
            <input type="text" id="sm-name" required />
          </div>
          <div class="form-group">
            <label for="sm-description">Description</label>
            <textarea id="sm-description"></textarea>
          </div>
          <div class="form-group checkbox-row">
            <input type="checkbox" id="sm-elite" />
            <label for="sm-elite">Elite</label>
          </div>
          <div class="form-group">
            <label for="sm-xp">XP reward</label>
            <input type="number" id="sm-xp" step="any" value="0" />
          </div>
          <div class="form-group">
            <label for="sm-gold">Gold reward</label>
            <input type="number" id="sm-gold" step="1" value="0" />
          </div>
          <div class="form-group">
            <label for="sm-energy">Energy reward</label>
            <input type="number" id="sm-energy" step="1" value="0" />
          </div>
          <p class="form-error" id="sm-error"></p>
          <div class="dialog-actions">
            <button type="button" class="btn btn-ghost" data-action="cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Slay!</button>
          </div>
        </form>
      </div>
    `;

    const form = backdrop.querySelector('#spontaneous-monster-form');

    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop || event.target.dataset.action === 'cancel') {
        backdrop.remove();
        resolve(null);
      }
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = backdrop.querySelector('#sm-name').value.trim();
      if (!name) {
        backdrop.querySelector('#sm-error').textContent = 'Name is required.';
        return;
      }
      backdrop.remove();
      resolve({
        name,
        description: backdrop.querySelector('#sm-description').value.trim(),
        is_elite: backdrop.querySelector('#sm-elite').checked,
        xp_to_give_when_defeated: Number(backdrop.querySelector('#sm-xp').value) || 0,
        gold_to_give_when_defeated: Math.trunc(Number(backdrop.querySelector('#sm-gold').value)) || 0,
        energy_to_give_when_defeated: Math.trunc(Number(backdrop.querySelector('#sm-energy').value)) || 0,
      });
    });

    document.body.appendChild(backdrop);
    backdrop.querySelector('#sm-name').focus();
  });
}

async function onSpontaneousMonsterClick() {
  if (!state.dungeon) return;

  const data = await showSpontaneousMonsterModal();
  if (!data) return;

  const monsterId = await monsterRepo.add(data);
  const monster = { id: monsterId, ...data };

  const [, , applied] = await Promise.all([
    dungeonRepo.update(state.dungeon.id, { monsterIds: arrayUnion(monsterId) }),
    updateDungeonProgress(state.playerId, state.dungeon.id, { slainMonsterIds: arrayUnion(monsterId) }),
    recordMonsterSlain(state.playerId, monster),
  ]);

  state.monsters.push(monster);
  state.slainMonsterIds.add(monsterId);
  state.dungeon.monsterIds = [...(state.dungeon.monsterIds ?? []), monsterId];
  state.player = await getPlayer(state.playerId);

  showEarnedPopup(applied);
  showLevelAndRankPopups(applied);

  const allSlain = state.monsters.every((m) => state.slainMonsterIds.has(m.id));
  if (allSlain) {
    showAchievementPopup({ icon: '🏆', title: 'Dungeon Cleared!', subtitle: state.dungeon.name, variant: 'dungeon' });
    await startNewDungeon(state.dungeon.id);
  }

  render();
}

async function onMonsterClick(event) {
  const button = event.target.closest('.monster-card');
  if (!button || button.disabled) return;

  const monsterId = button.dataset.id;
  const monster = state.monsters.find((m) => m.id === monsterId);
  if (!monster || state.slainMonsterIds.has(monsterId)) return;

  button.disabled = true;

  const [applied] = await Promise.all([
    recordMonsterSlain(state.playerId, monster),
    updateDungeonProgress(state.playerId, state.dungeon.id, { slainMonsterIds: arrayUnion(monsterId) }),
  ]);
  state.slainMonsterIds.add(monsterId);
  state.player = await getPlayer(state.playerId);

  showEarnedPopup(applied);
  showLevelAndRankPopups(applied);

  const allSlain = state.monsters.every((m) => state.slainMonsterIds.has(m.id));
  if (allSlain) {
    showAchievementPopup({ icon: '🏆', title: 'Dungeon Cleared!', subtitle: state.dungeon.name, variant: 'dungeon' });
    await startNewDungeon(state.dungeon.id);
  }

  render();
}

async function onQuestClick(event) {
  const button = event.target.closest('.quest-row');
  if (!button || button.disabled) return;

  const questId = button.dataset.id;
  const quest = state.quests.find((q) => q.id === questId);
  if (!quest || state.completedQuestIds.has(questId)) return;

  button.disabled = true;

  const [applied] = await Promise.all([
    recordQuestCompleted(state.playerId, quest),
    updateDungeonProgress(state.playerId, state.dungeon.id, { completedQuestIds: arrayUnion(questId) }),
  ]);
  state.completedQuestIds.add(questId);
  state.player = await getPlayer(state.playerId);

  showEarnedPopup(applied);
  showLevelAndRankPopups(applied);
  render();
}

async function init() {
  state.playerId = requireActivePlayerId('../login/index.html');
  if (!state.playerId) return;

  state.player = await getPlayer(state.playerId);
  state.eventsConfig = await getEventsConfig();

  const dungeonId = await getCurrentDungeonId(state.playerId);
  const dungeon = dungeonId ? await dungeonRepo.getById(dungeonId) : null;
  const progress = dungeon ? await getDungeonProgress(state.playerId, dungeon.id) : null;

  if (dungeon && !isDungeonCleared(dungeon, progress)) {
    await enterDungeon(dungeon, progress);
  } else {
    await startNewDungeon(dungeon?.id ?? null);
  }

  render();
}

init();
