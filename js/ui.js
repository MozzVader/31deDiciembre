// ============================================
// UI Utilities
// ============================================

/**
 * Show a toast notification
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/**
 * Show modal
 */
export function showModal(title, bodyHtml, footerHtml = '') {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-footer').innerHTML = footerHtml;
  document.getElementById('modal-overlay').classList.add('visible');

  // Attach close handler to the × button (in case it was removed/re-added)
  const closeBtn = document.getElementById('modal-close');
  if (closeBtn) {
    closeBtn.onclick = closeModal;
  }
}

/**
 * Close modal
 */
export function closeModal() {
  document.getElementById('modal-overlay').classList.remove('visible');
}

// Expose on window for inline onclick handlers in HTML templates
window.closeModal = closeModal;

/**
 * Confirm dialog (modal-based)
 * Returns a Promise<boolean>
 */
export function confirm(message, title = 'Confirmar') {
  return new Promise((resolve) => {
    const footer = `
      <button class="btn btn-ghost" id="confirm-cancel">Cancelar</button>
      <button class="btn btn-danger" id="confirm-ok" style="background:var(--danger);color:white;border:none;">Eliminar</button>
    `;
    showModal(title, `<p style="color:var(--text-secondary);font-size:14px;">${message}</p>`, footer);

    document.getElementById('confirm-ok').onclick = () => {
      closeModal();
      resolve(true);
    };
    document.getElementById('confirm-cancel').onclick = () => {
      closeModal();
      resolve(false);
    };
  });
}

/**
 * Set breadcrumbs
 */
export function setBreadcrumbs(items) {
  const container = document.getElementById('breadcrumbs');
  container.innerHTML = items.map((item, i) => {
    const isActive = i === items.length - 1;
    const separator = i > 0 ? '<span class="breadcrumb-separator"><i class="fa-solid fa-chevron-right" style="font-size:10px;"></i></span>' : '';
    return `${separator}<span class="breadcrumb-item ${isActive ? 'active' : ''}" ${item.route ? `data-nav="${item.route}"` : ''}>${item.label}</span>`;
  }).join('');

  // Add click handlers for non-active items
  container.querySelectorAll('[data-nav]').forEach(el => {
    el.style.cursor = 'pointer';
    el.onclick = () => {
      window.location.hash = el.dataset.nav;
    };
  });
}

/**
 * Render the workspace content
 */
export function renderWorkspace(html) {
  const workspace = document.getElementById('workspace');
  workspace.innerHTML = html;
  workspace.scrollTop = 0;
}

/**
 * Update sidebar badge count
 */
export function updateBadge(module, count) {
  const badge = document.getElementById(`badge-${module}`);
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline' : 'none';
  }
}

/**
 * Set active nav item
 */
export function setActiveNav(route) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.route === route);
  });
}

/**
 * Create a dropdown <select> element
 */
export function createSelect(items, selectedValue = '', placeholder = '— Seleccionar —') {
  let options = `<option value="">${placeholder}</option>`;
  items.forEach(item => {
    const value = item.id || item.value;
    const label = item.name || item.label || item.id || item.value;
    const selected = value === selectedValue ? 'selected' : '';
    options += `<option value="${value}" ${selected}>${label}</option>`;
  });
  return `<select class="form-select">${options}</select>`;
}

/**
 * Escape HTML
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Syntax-highlight JSON for display
 */
export function highlightJson(json) {
  const str = typeof json === 'string' ? json : JSON.stringify(json, null, 2);
  return str.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      cls = /:$/.test(match) ? 'json-key' : 'json-string';
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return `<span class="${cls}">${match}</span>`;
  });
}

// ============================================
// Quick Create — inline entity creation
// ============================================

/** Return HTML for a small "+" button that triggers a quick-create modal */
export function quickCreateBtn(entityType, title = '') {
  const labels = { flag: 'Flag', item: 'Item', dialogue: 'Diálogo' };
  const t = title || labels[entityType] || entityType;
  return `<button type="button" class="btn-quick-create" onclick="event.stopPropagation(); window.quickCreateEntity('${entityType}', this)" title="Crear ${t} nuevo">+</button>`;
}

/**
 * Open a mini-modal to quickly create a flag, item, or dialogue.
 * On save: creates in Firestore, adds option to the parent <select>, auto-selects it,
 * and dispatches 'change' so dependent dropdowns (e.g. dialogue nodes) refresh.
 */
window.quickCreateEntity = async function(entityType, btn) {
  // Dynamic imports to avoid circular deps
  const { create, getAll } = await import('./db.js');

  // Find the sibling <select> element
  const wrap = btn.closest('.quick-create-wrap') || btn.parentElement;
  const select = wrap.querySelector('.form-select');
  if (!select) return;

  let fieldsHtml = '';
  let modalTitle = '';

  switch (entityType) {
    case 'flag':
      modalTitle = 'Nueva Flag';
      fieldsHtml = `
        <div class="form-group">
          <label class="form-label">Nombre</label>
          <input type="text" class="form-input" id="qc-name" placeholder="Ej: tiene_llave, barco_listo">
          <div class="form-hint">Usá snake_case. Será el slug y el identificador de la flag.</div>
        </div>`;
      break;
    case 'item':
      modalTitle = 'Nuevo Item';
      fieldsHtml = `
        <div class="form-group">
          <label class="form-label">Nombre</label>
          <input type="text" class="form-input" id="qc-name" placeholder="Ej: Llave dorada">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Descripción (breve)</label>
          <input type="text" class="form-input" id="qc-desc" placeholder="Ej: Una vieja llave oxidada">
        </div>`;
      break;
    case 'dialogue':
      modalTitle = 'Nuevo Diálogo';
      fieldsHtml = `
        <div class="form-group">
          <label class="form-label">Nombre</label>
          <input type="text" class="form-input" id="qc-name" placeholder="Ej: Diálogo con el bartender">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Descripción (opcional)</label>
          <input type="text" class="form-input" id="qc-desc" placeholder="Ej: Primer encuentro en el bar">
        </div>`;
      break;
    default:
      return;
  }

  showModal(modalTitle, fieldsHtml, `
    <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" id="qc-save">Crear</button>
  `);

  // Auto-focus the name input
  const nameInput = document.getElementById('qc-name');
  if (nameInput) nameInput.focus();

  document.getElementById('qc-save').onclick = async () => {
    const name = document.getElementById('qc-name').value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }

    const saveBtn = document.getElementById('qc-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    try {
      let newId, optionValue, optionLabel;

      switch (entityType) {
        case 'flag': {
          const flagName = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
          newId = await create('flags', { name: flagName, description: name });
          optionValue = flagName;
          optionLabel = flagName;
          break;
        }
        case 'item': {
          const desc = document.getElementById('qc-desc')?.value.trim() || '';
          const prefix = 'item';
          const base = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
          const slug = `${prefix}_${base}`;
          newId = await create('items', { slug, name, description: desc });
          optionValue = slug;
          optionLabel = name;
          break;
        }
        case 'dialogue': {
          const desc = document.getElementById('qc-desc')?.value.trim() || '';
          const prefix = 'dlg';
          const base = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
          const slug = `${prefix}_${base}`;
          newId = await create('dialogues', { slug, name, description: desc });
          optionValue = slug;
          optionLabel = name;
          break;
        }
      }

      // Add new option to the select and auto-select it
      const opt = document.createElement('option');
      opt.value = optionValue;
      opt.textContent = optionLabel;
      opt.selected = true;
      select.appendChild(opt);

      // Dispatch change so dependent dropdowns refresh (e.g. node loading for dialogue)
      select.dispatchEvent(new Event('change'));

      closeModal();
      showToast(`${modalTitle} "${name}" creada`, 'success');
    } catch (err) {
      console.error('Quick create error:', err);
      showToast('Error al crear. Verificá la consola.', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Crear';
    }
  };
};
