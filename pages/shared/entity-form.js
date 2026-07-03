import { Repository } from '../../services/repository.js';

function parseFieldValue(field, formData) {
  if (field.type === 'checkbox') {
    return formData.get(field.key) === 'on';
  }
  if (field.type === 'number') {
    const raw = formData.get(field.key);
    const num = Number(raw);
    if (Number.isNaN(num)) return 0;
    return field.numberType === 'int' ? Math.trunc(num) : num;
  }
  return String(formData.get(field.key) ?? '').trim();
}

function fieldMarkup(field, value) {
  const id = `field-${field.key}`;
  if (field.type === 'textarea') {
    return `
      <div class="form-group">
        <label for="${id}">${field.label}</label>
        <textarea id="${id}" name="${field.key}">${value ?? ''}</textarea>
      </div>
    `;
  }
  if (field.type === 'checkbox') {
    return `
      <div class="form-group checkbox-row">
        <input type="checkbox" id="${id}" name="${field.key}" ${value ? 'checked' : ''} />
        <label for="${id}">${field.label}</label>
      </div>
    `;
  }
  if (field.type === 'number') {
    const step = field.numberType === 'int' ? '1' : 'any';
    return `
      <div class="form-group">
        <label for="${id}">${field.label}</label>
        <input type="number" step="${step}" id="${id}" name="${field.key}" value="${value ?? 0}" />
      </div>
    `;
  }
  return `
    <div class="form-group">
      <label for="${id}">${field.label}</label>
      <input type="text" id="${id}" name="${field.key}" value="${value ?? ''}" ${field.required ? 'required' : ''} />
    </div>
  `;
}

/**
 * Renders an add/edit form for a simple, flat entity (no relations).
 * @param {Object} config entity config from entityConfigs.js
 * @param {string} formElementId id of the <form> element
 */
export function initEntityFormPage(config, formElementId = 'entity-form') {
  const repo = new Repository(config.collection);
  const form = document.getElementById(formElementId);
  const errorEl = document.getElementById('form-error');
  const heading = document.getElementById('form-heading');

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const isEdit = Boolean(id);

  async function init() {
    let existing = {};
    if (isEdit) {
      existing = (await repo.getById(id)) ?? {};
      heading.textContent = `Edit ${config.singular}`;
    } else {
      heading.textContent = `New ${config.singular}`;
    }

    form.innerHTML = config.fields.map((field) => fieldMarkup(field, existing[field.key])).join('') + `
      <div class="form-actions">
        <a class="btn btn-ghost" href="${config.listPage}">Cancel</a>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    `;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.textContent = '';

    const formData = new FormData(form);
    const requiredMissing = config.fields.find(
      (field) => field.required && !String(formData.get(field.key) ?? '').trim()
    );
    if (requiredMissing) {
      errorEl.textContent = `${requiredMissing.label} is required.`;
      return;
    }

    const data = {};
    for (const field of config.fields) {
      data[field.key] = parseFieldValue(field, formData);
    }

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      if (isEdit) {
        await repo.update(id, data);
      } else {
        await repo.add(data);
      }
      window.location.href = config.listPage;
    } catch (err) {
      errorEl.textContent = 'Failed to save. Please try again.';
      submitButton.disabled = false;
    }
  });

  init();
}
