import { arrayUnion } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { Repository } from '../../services/repository.js';
import {
  getPlayer,
  getCurrentDungeonId,
  setCurrentDungeonId,
  recordMonsterSlain,
  recordQuestCompleted,
} from '../../services/playerRepository.js';

const dungeonRepo = new Repository('dungeons');
const monsterRepo = new Repository('monsters');
const questRepo = new Repository('quests');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const root = document.getElementById('game-root');

const state = {
  player: null,
  dungeon: null,
  monsters: [],
  quests: [],
  slainMonsterIds: new Set(),
  completedQuestIds: new Set(),
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

function isDungeonCleared(dungeon) {
  const monsterIds = dungeon.monsterIds ?? [];
  if (monsterIds.length === 0) return false;
  const slain = new Set(dungeon.slainMonsterIds ?? []);
  return monsterIds.every((id) => slain.has(id));
}

function pickRandomDungeon(dungeons, excludeId) {
  const available = dungeons.filter((d) => d.id !== excludeId);
  const fresh = available.filter((d) => !isDungeonCleared(d));
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

async function enterDungeon(dungeon) {
  state.dungeon = dungeon;
  state.slainMonsterIds = new Set(dungeon?.slainMonsterIds ?? []);
  state.completedQuestIds = new Set(dungeon?.completedQuestIds ?? []);
  const view = await loadDungeonView(dungeon);
  state.monsters = view.monsters;
  state.quests = view.quests;
}

async function startNewDungeon(excludeId = null) {
  const dungeons = await dungeonRepo.getAll();
  let dungeon = pickRandomDungeon(dungeons, excludeId);

  if (dungeon && isDungeonCleared(dungeon)) {
    // No fresh dungeon exists to switch to (e.g. only one dungeon is set up) —
    // respawn this one's monsters/quests instead of leaving it stuck cleared.
    await dungeonRepo.update(dungeon.id, { slainMonsterIds: [], completedQuestIds: [] });
    dungeon = { ...dungeon, slainMonsterIds: [], completedQuestIds: [] };
  }

  await enterDungeon(dungeon);
  await setCurrentDungeonId(dungeon?.id ?? null);
}

function renderPlayer(player) {
  return `
    <section class="player-banner">
      <span class="player-avatar">🛡️</span>
      <div class="player-info">
        <h2>${escapeHtml(player.name)}</h2>
        <div class="badge-row">
          <span class="badge">${escapeHtml(player.rank)}</span>
          <span class="badge">Lv ${player.level}</span>
        </div>
      </div>
      <div class="badge-row player-stats">
        <span class="badge">⭐ ${player.xp}</span>
        <span class="badge">🪙 ${player.gold}</span>
        <span class="badge">⚡ ${player.energy}</span>
      </div>
    </section>
  `;
}

function renderDayBanner() {
  const day = DAY_NAMES[new Date().getDay()];
  return `<p class="day-banner">📅 Today is <strong>${day}</strong></p>`;
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
        <span class="badge">⭐ ${monster.xp_to_give_when_defeated ?? 0}</span>
        <span class="badge">🪙 ${monster.gold_to_give_when_defeated ?? 0}</span>
        <span class="badge">⚡ ${monster.energy_to_give_when_defeated ?? 0}</span>
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
            <span class="badge">⭐ ${quest.xp_to_give_when_defeated ?? 0}</span>
            <span class="badge">🪙 ${quest.gold_to_give_when_defeated ?? 0}</span>
            <span class="badge">⚡ ${quest.energy_to_give_when_defeated ?? 0}</span>
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
    ${renderDayBanner()}
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

  await Promise.all([
    dungeonRepo.update(state.dungeon.id, {
      monsterIds: arrayUnion(monsterId),
      slainMonsterIds: arrayUnion(monsterId),
    }),
    recordMonsterSlain(monster),
  ]);

  state.monsters.push(monster);
  state.slainMonsterIds.add(monsterId);
  state.dungeon.monsterIds = [...(state.dungeon.monsterIds ?? []), monsterId];
  state.player = await getPlayer();

  const allSlain = state.monsters.every((m) => state.slainMonsterIds.has(m.id));
  if (allSlain) {
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

  await Promise.all([
    recordMonsterSlain(monster),
    dungeonRepo.update(state.dungeon.id, { slainMonsterIds: arrayUnion(monsterId) }),
  ]);
  state.slainMonsterIds.add(monsterId);
  state.player = await getPlayer();

  const allSlain = state.monsters.every((m) => state.slainMonsterIds.has(m.id));
  if (allSlain) {
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

  await Promise.all([
    recordQuestCompleted(quest),
    dungeonRepo.update(state.dungeon.id, { completedQuestIds: arrayUnion(questId) }),
  ]);
  state.completedQuestIds.add(questId);
  state.player = await getPlayer();

  render();
}

async function init() {
  state.player = await getPlayer();

  const dungeonId = await getCurrentDungeonId();
  const dungeon = dungeonId ? await dungeonRepo.getById(dungeonId) : null;

  if (dungeon && !isDungeonCleared(dungeon)) {
    await enterDungeon(dungeon);
  } else {
    await startNewDungeon(dungeon?.id ?? null);
  }

  render();
}

init();
