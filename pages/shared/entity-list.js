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

function showConfirmDialog(message) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';
    backdrop.innerHTML = `
      <div class="dialog-box">
        <p>${escapeHtml(message)}</p>
        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" data-action="cancel">Cancel</button>
          <button type="button" class="btn btn-danger" data-action="confirm">Delete</button>
        </div>
      </div>
    `;
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop || event.target.dataset.action === 'cancel') {
        backdrop.remove();
        resolve(false);
      } else if (event.target.dataset.action === 'confirm') {
        backdrop.remove();
        resolve(true);
      }
    });
    document.body.appendChild(backdrop);
  });
}

/**
 * Renders a grid/list page with add / edit / delete / clone support.
 * @param {Object} config entity config from entityConfigs.js
 * @param {string} gridElementId id of the container element for the card grid
 */
export function initEntityListPage(config, gridElementId = 'card-grid') {
  const repo = new Repository(config.collection);
  const grid = document.getElementById(gridElementId);

  async function render() {
    grid.innerHTML = '<p class="loading-state">Loading…</p>';
    const items = await repo.getAll();

    if (items.length === 0) {
      grid.innerHTML = `<p class="empty-state">No ${config.plural.toLowerCase()} yet. Tap "New" to add one.</p>`;
      return;
    }

    grid.innerHTML = items
      .map((item) => {
        const title = escapeHtml(item[config.titleKey] ?? config.singular);
        const desc = item.description ? escapeHtml(item.description) : '';
        return `
          <article class="entity-card" data-id="${item.id}">
            <div class="card-title">
              <h3>${title}</h3>
            </div>
            ${desc ? `<p class="card-desc">${desc}</p>` : ''}
            ${config.renderCardMeta ? config.renderCardMeta(item) : ''}
            <div class="card-actions">
              <button type="button" class="btn btn-sm" data-action="edit">Edit</button>
              <button type="button" class="btn btn-sm" data-action="clone">Clone</button>
              <button type="button" class="btn btn-sm btn-danger" data-action="delete">Delete</button>
            </div>
          </article>
        `;
      })
      .join('');
  }

  grid.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const card = button.closest('.entity-card');
    const id = card.dataset.id;

    if (button.dataset.action === 'edit') {
      window.location.href = `${config.formPage}?id=${encodeURIComponent(id)}`;
    } else if (button.dataset.action === 'clone') {
      button.disabled = true;
      await repo.clone(id);
      await render();
    } else if (button.dataset.action === 'delete') {
      const confirmed = await showConfirmDialog(`Delete this ${config.singular.toLowerCase()}? This cannot be undone.`);
      if (confirmed) {
        await repo.remove(id);
        await render();
      }
    }
  });

  render();
}
