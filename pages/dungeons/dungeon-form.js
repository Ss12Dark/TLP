import { Repository } from '../../services/repository.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function renderCheckboxes(container, items, titleKey, name, selectedIds) {
  if (items.length === 0) {
    container.innerHTML = `<p class="empty-state">None created yet.</p>`;
    return;
  }
  container.innerHTML = items
    .map(
      (item) => `
        <label>
          <input type="checkbox" name="${name}" value="${item.id}" ${selectedIds.has(item.id) ? 'checked' : ''} />
          ${escapeHtml(item[titleKey])}
        </label>
      `
    )
    .join('');
}

const dungeonRepo = new Repository('dungeons');
const monsterRepo = new Repository('monsters');
const questRepo = new Repository('quests');

const form = document.getElementById('entity-form');
const nameInput = document.getElementById('field-name');
const monsterContainer = document.getElementById('monster-checkboxes');
const questContainer = document.getElementById('quest-checkboxes');
const errorEl = document.getElementById('form-error');
const heading = document.getElementById('form-heading');

const params = new URLSearchParams(window.location.search);
const id = params.get('id');
const isEdit = Boolean(id);

async function init() {
  heading.textContent = isEdit ? 'Edit Dungeon' : 'New Dungeon';

  const [monsters, quests, existing] = await Promise.all([
    monsterRepo.getAll(),
    questRepo.getAll(),
    isEdit ? dungeonRepo.getById(id) : Promise.resolve(null),
  ]);

  const selectedMonsterIds = new Set(existing?.monsterIds ?? []);
  const selectedQuestIds = new Set(existing?.questIds ?? []);

  nameInput.value = existing?.name ?? '';
  renderCheckboxes(monsterContainer, monsters, 'name', 'monsterIds', selectedMonsterIds);
  renderCheckboxes(questContainer, quests, 'title', 'questIds', selectedQuestIds);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.textContent = '';

  const name = nameInput.value.trim();
  if (!name) {
    errorEl.textContent = 'Name is required.';
    return;
  }

  const formData = new FormData(form);
  const data = {
    name,
    monsterIds: formData.getAll('monsterIds'),
    questIds: formData.getAll('questIds'),
  };

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    if (isEdit) {
      await dungeonRepo.update(id, data);
    } else {
      await dungeonRepo.add(data);
    }
    window.location.href = 'list.html';
  } catch (err) {
    errorEl.textContent = 'Failed to save. Please try again.';
    submitButton.disabled = false;
  }
});

init();
