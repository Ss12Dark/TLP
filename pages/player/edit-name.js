import {
  getPlayer,
  savePlayerName,
  getIncludeSharedDungeons,
  setIncludeSharedDungeons,
} from '../../services/playerRepository.js';
import { getLevelingConfig, saveLevelingConfig } from '../../services/levelingConfig.js';
import { RANK_ORDER } from '../../classes/Rank.js';
import { requireActivePlayerId } from '../../services/playerSession.js';

const playerId = requireActivePlayerId('../login/index.html');

const form = document.getElementById('entity-form');
const nameInput = document.getElementById('field-name');
const includeSharedDungeonsInput = document.getElementById('field-include-shared-dungeons');
const errorEl = document.getElementById('form-error');
const xpList = document.getElementById('xp-thresholds');
const addXpButton = document.getElementById('add-xp-threshold');
const rankList = document.getElementById('rank-thresholds');
const addRankButton = document.getElementById('add-rank-threshold');

function renderXpRows(values) {
  xpList.innerHTML =
    values
      .map(
        (value, index) => `
          <div class="dynamic-row" data-index="${index}">
            <span class="dynamic-row-label">Lv ${index + 1} &rarr; ${index + 2}</span>
            <input type="number" min="0" step="any" class="xp-threshold-input" value="${value}" />
            <button type="button" class="btn btn-sm btn-danger" data-action="remove">&times;</button>
          </div>
        `
      )
      .join('') || '<p class="empty-state">No levels configured yet.</p>';
}

function renderRankRows(entries) {
  rankList.innerHTML =
    entries
      .map(
        (entry, index) => `
          <div class="dynamic-row" data-index="${index}">
            <input type="number" min="1" step="1" class="rank-level-input" value="${entry.level}" />
            <select class="rank-select">
              ${RANK_ORDER.map(
                (r) => `<option value="${r}" ${r === entry.rank ? 'selected' : ''}>${r}</option>`
              ).join('')}
            </select>
            <button type="button" class="btn btn-sm btn-danger" data-action="remove">&times;</button>
          </div>
        `
      )
      .join('') || '<p class="empty-state">No ranks configured yet.</p>';
}

function readXpRows() {
  return [...xpList.querySelectorAll('.xp-threshold-input')].map((input) => Number(input.value) || 0);
}

function readRankRows() {
  return [...rankList.querySelectorAll('.dynamic-row')].map((row) => ({
    level: Math.max(1, Math.trunc(Number(row.querySelector('.rank-level-input').value) || 1)),
    rank: row.querySelector('.rank-select').value,
  }));
}

async function init() {
  const [player, levelingConfig, includeSharedDungeons] = await Promise.all([
    getPlayer(playerId),
    getLevelingConfig(),
    getIncludeSharedDungeons(playerId),
  ]);
  nameInput.value = player.name;
  includeSharedDungeonsInput.checked = includeSharedDungeons;
  renderXpRows(levelingConfig.xpThresholds);
  renderRankRows(levelingConfig.rankThresholds);
}

addXpButton.addEventListener('click', () => {
  const values = readXpRows();
  const previous = values[values.length - 1] ?? 0;
  values.push(previous + 100);
  renderXpRows(values);
});

xpList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action="remove"]');
  if (!button) return;
  const values = readXpRows();
  const index = Number(button.closest('.dynamic-row').dataset.index);
  values.splice(index, 1);
  renderXpRows(values);
});

addRankButton.addEventListener('click', () => {
  const entries = readRankRows();
  const nextLevel = (entries[entries.length - 1]?.level ?? 0) + 1;
  entries.push({ level: nextLevel, rank: RANK_ORDER[0] });
  renderRankRows(entries);
});

rankList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action="remove"]');
  if (!button) return;
  const entries = readRankRows();
  const index = Number(button.closest('.dynamic-row').dataset.index);
  entries.splice(index, 1);
  renderRankRows(entries);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.textContent = '';

  const name = nameInput.value.trim();
  if (!name) {
    errorEl.textContent = 'Name is required.';
    return;
  }

  const xpThresholds = readXpRows();
  const rankThresholds = readRankRows().sort((a, b) => a.level - b.level);

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    await savePlayerName(playerId, name);
    await Promise.all([
      saveLevelingConfig({ xpThresholds, rankThresholds }),
      setIncludeSharedDungeons(playerId, includeSharedDungeonsInput.checked),
    ]);
    window.location.href = 'stats.html';
  } catch (err) {
    errorEl.textContent = err.message || 'Failed to save. Please try again.';
    submitButton.disabled = false;
  }
});

if (playerId) {
  init();
}
