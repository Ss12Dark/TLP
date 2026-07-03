function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

export function showConfirmDialog(message, { confirmLabel = 'Delete' } = {}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';
    backdrop.innerHTML = `
      <div class="dialog-box">
        <p>${escapeHtml(message)}</p>
        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" data-action="cancel">Cancel</button>
          <button type="button" class="btn btn-danger" data-action="confirm">${escapeHtml(confirmLabel)}</button>
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
