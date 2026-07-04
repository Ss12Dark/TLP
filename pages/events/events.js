import {
  getEventsConfig,
  saveDayBonuses,
  setDoubleEarningsActive,
  getFastFightConfig,
  saveFastFightConfig,
} from '../../services/eventsConfig.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const main = document.getElementById('events-main');

let dayBonuses = [];
let doubleEarningsActive = false;

function renderDayBonusRows() {
  const container = document.getElementById('day-bonus-rows');
  container.innerHTML =
    dayBonuses
      .map(
        (entry, index) => `
          <div class="dynamic-row" data-index="${index}">
            <select class="day-select">
              ${DAY_NAMES.map(
                (name, i) => `<option value="${i}" ${i === entry.day ? 'selected' : ''}>${name}</option>`
              ).join('')}
            </select>
            <input type="number" class="day-xp-input" step="any" placeholder="XP %" value="${entry.xpPercent ?? 0}" />
            <input type="number" class="day-gold-input" step="any" placeholder="Gold %" value="${entry.goldPercent ?? 0}" />
            <input type="number" class="day-energy-input" step="any" placeholder="Energy %" value="${entry.energyPercent ?? 0}" />
            <button type="button" class="btn btn-sm btn-danger" data-action="remove">&times;</button>
          </div>
        `
      )
      .join('') || '<p class="empty-state">No day bonuses configured yet.</p>';
}

function readDayBonusRows() {
  return [...document.querySelectorAll('#day-bonus-rows .dynamic-row')].map((row) => ({
    day: Number(row.querySelector('.day-select').value),
    xpPercent: Number(row.querySelector('.day-xp-input').value) || 0,
    goldPercent: Number(row.querySelector('.day-gold-input').value) || 0,
    energyPercent: Number(row.querySelector('.day-energy-input').value) || 0,
  }));
}

function renderDoubleEarningsButton() {
  const button = document.getElementById('double-earnings-toggle');
  button.textContent = doubleEarningsActive ? '✔ Active — Turn Off' : 'Turn On';
  button.classList.toggle('btn-primary', doubleEarningsActive);
}

async function render() {
  const [eventsConfig, fastFightConfig] = await Promise.all([getEventsConfig(), getFastFightConfig()]);
  dayBonuses = eventsConfig.dayBonuses;
  doubleEarningsActive = eventsConfig.doubleEarningsActive;

  main.innerHTML = `
    <section class="entity-card">
      <h3>🔥 Double Earnings</h3>
      <p class="card-desc">While active, all XP and Gold earned is doubled. Energy is unaffected. Stays on until you turn it off.</p>
      <button type="button" id="double-earnings-toggle" class="btn btn-block"></button>
    </section>

    <section class="entity-card">
      <h3>📅 Day Bonuses</h3>
      <p class="card-desc">Give specific days of the week a % boost to XP, Gold, and/or Energy earned.</p>
      <form id="day-bonus-form" class="entity-form">
        <div id="day-bonus-rows" class="dynamic-list"></div>
        <button type="button" id="add-day-bonus" class="btn btn-ghost btn-sm">+ Add day</button>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Save Day Bonuses</button>
        </div>
      </form>
    </section>

    <section class="entity-card">
      <h3>⚡ Fast Fight Reward</h3>
      <p class="card-desc">Configure the reward granted by the "Fast Fight" button on the Play page.</p>
      <form id="fast-fight-form" class="entity-form">
        <div class="form-group">
          <label for="ff-xp">XP</label>
          <input type="number" id="ff-xp" step="any" value="${fastFightConfig.xp}" />
        </div>
        <div class="form-group">
          <label for="ff-gold">Gold</label>
          <input type="number" id="ff-gold" step="1" value="${fastFightConfig.gold}" />
        </div>
        <div class="form-group">
          <label for="ff-energy">Energy</label>
          <input type="number" id="ff-energy" step="1" value="${fastFightConfig.energy}" />
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Save Fast Fight</button>
        </div>
      </form>
    </section>
  `;

  renderDayBonusRows();
  renderDoubleEarningsButton();

  document.getElementById('double-earnings-toggle').addEventListener('click', onToggleDoubleEarnings);
  document.getElementById('add-day-bonus').addEventListener('click', onAddDayBonus);
  document.getElementById('day-bonus-rows').addEventListener('click', onRemoveDayBonus);
  document.getElementById('day-bonus-form').addEventListener('submit', onSaveDayBonuses);
  document.getElementById('fast-fight-form').addEventListener('submit', onSaveFastFight);
}

async function onToggleDoubleEarnings() {
  doubleEarningsActive = !doubleEarningsActive;
  await setDoubleEarningsActive(doubleEarningsActive);
  renderDoubleEarningsButton();
}

function onAddDayBonus() {
  dayBonuses = readDayBonusRows();
  dayBonuses.push({ day: 0, xpPercent: 0, goldPercent: 0, energyPercent: 0 });
  renderDayBonusRows();
}

function onRemoveDayBonus(event) {
  const button = event.target.closest('button[data-action="remove"]');
  if (!button) return;
  dayBonuses = readDayBonusRows();
  const index = Number(button.closest('.dynamic-row').dataset.index);
  dayBonuses.splice(index, 1);
  renderDayBonusRows();
}

async function onSaveDayBonuses(event) {
  event.preventDefault();
  dayBonuses = readDayBonusRows();
  await saveDayBonuses(dayBonuses);
}

async function onSaveFastFight(event) {
  event.preventDefault();
  const xp = Number(document.getElementById('ff-xp').value) || 0;
  const gold = Math.trunc(Number(document.getElementById('ff-gold').value)) || 0;
  const energy = Math.trunc(Number(document.getElementById('ff-energy').value)) || 0;
  await saveFastFightConfig({ xp, gold, energy });
}

render();
