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
  initFilterableSelects();
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
export function createSelect(items, selectedValue = '', placeholder = '— Seleccionar —', filterable = false) {
  let options = `<option value="">${placeholder}</option>`;
  items.forEach(item => {
    const value = item.id || item.value;
    const label = item.name || item.label || item.id || item.value;
    const selected = value === selectedValue ? 'selected' : '';
    options += `<option value="${value}" ${selected}>${label}</option>`;
  });
  const filterAttr = filterable ? ' data-filterable' : '';
  return `<select class="form-select"${filterAttr}>${options}</select>`;
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
// Filterable Selects — search/filter for large dropdowns
// ============================================

/** Find all selects with [data-filterable] and inject a search input above them */
function initFilterableSelects() {
  document.querySelectorAll('.form-select[data-filterable]').forEach(select => {
    // Don't re-initialize
    if (select.previousElementSibling?.classList?.contains('filter-select-input')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'filter-select-input form-input';
    input.placeholder = 'Buscar...';

    const wrap = select.closest('.quick-create-wrap');
    if (wrap) {
      wrap.insertBefore(input, wrap.firstChild);
    } else {
      const container = document.createElement('div');
      container.className = 'filter-select-wrap';
      select.parentNode.insertBefore(container, select);
      container.appendChild(input);
      container.appendChild(select);
    }

    input.addEventListener('input', () => {
      const filter = input.value.toLowerCase();
      Array.from(select.options).forEach(opt => {
        if (!opt.value) return; // keep placeholder always visible
        if (opt.selected) return; // keep selected option always visible
        opt.hidden = !opt.textContent.toLowerCase().includes(filter);
      });
    });
  });
}

// ============================================
// Quick Create — inline entity creation
// ============================================

/** Return HTML for a small "+" button that triggers a quick-create modal */
export function quickCreateBtn(entityType, title = '') {
  const labels = { flag: 'Flag', item: 'Item', dialogue: 'Diálogo', node: 'Nodo' };
  const t = title || labels[entityType] || entityType;
  return `<button type="button" class="btn-quick-create" onclick="event.stopPropagation(); window.quickCreateEntity('${entityType}', this)" title="Crear ${t} nuevo">+</button>`;
}

/**
 * Open a mini-modal to quickly create a flag, item, dialogue, or node.
 * On save: creates in Firestore, adds option to the parent <select>, auto-selects it,
 * and dispatches 'change' so dependent dropdowns (e.g. dialogue nodes) refresh.
 */
window.quickCreateEntity = async function(entityType, btn) {
  // Dynamic imports to avoid circular deps
  const { create, getAll, createNode } = await import('./db.js');

  // Find the sibling <select> element
  const wrap = btn.closest('.quick-create-wrap') || btn.parentElement;
  const select = wrap.querySelector('.form-select');
  if (!select) return;

  let fieldsHtml = '';
  let modalTitle = '';

  // Variables for node creation (shared between switch blocks)
  let _nodeDialogueId = null;
  let _nodeDialogueSlug = null;
  let _nodeActionCard = null;
  let _nodeIsItems = false;

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
    case 'node': {
      // Find parent action card and the dialogue select within it
      _nodeActionCard = btn.closest('.hs-action-card');
      if (!_nodeActionCard) return;

      _nodeIsItems = !!_nodeActionCard.querySelector('.item-action-target');
      const dlgSelect = _nodeActionCard.querySelector(_nodeIsItems ? '.item-action-target' : '.hs-action-target');
      _nodeDialogueSlug = dlgSelect?.value || '';

      if (!_nodeDialogueSlug) {
        showToast('Primero seleccioná un diálogo', 'info');
        return;
      }

      // Resolve dialogue data
      const data = _nodeIsItems ? (window._itemFormData || {}) : (window._roomFormData || {});
      const dlg = (data.dialogues || []).find(d => (d.slug || d.id) === _nodeDialogueSlug);
      if (!dlg) { showToast('Diálogo no encontrado en los datos del formulario', 'error'); return; }

      _nodeDialogueId = dlg.id;

      // Fetch characters for speaker dropdown
      const characters = await getAll('characters');
      const speakerOpts = [
        { id: '__player__', name: 'Jugador' },
        ...characters.map(c => ({ id: c.id, name: c.name }))
      ];

      modalTitle = 'Nuevo Nodo';
      fieldsHtml = `
        <div class="form-group">
          <label class="form-label">Diálogo</label>
          <input type="text" class="form-input" value="${escapeHtml(dlg.name)}" disabled>
          <div class="form-hint">Se creará un nodo dentro de este diálogo.</div>
        </div>
        <div class="form-group">
          <label class="form-label">Quién habla</label>
          ${createSelect(speakerOpts, '__player__', '— Seleccionar —')}
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Texto del Nodo</label>
          <textarea class="form-textarea" id="qc-text" rows="3" placeholder="Lo que se dice en este nodo..."></textarea>
        </div>`;
      break;
    }
    default:
      return;
  }

  showModal(modalTitle, fieldsHtml, `
    <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" id="qc-save">Crear</button>
  `);

  // Auto-focus the name input (or text input for nodes)
  const nameInput = document.getElementById('qc-name');
  if (nameInput) nameInput.focus();
  else document.getElementById('qc-text')?.focus();

  document.getElementById('qc-save').onclick = async () => {
    const saveBtn = document.getElementById('qc-save');

    // For nodes, text is the required field
    const isNode = entityType === 'node';
    const name = document.getElementById('qc-name')?.value.trim() || '';
    const text = document.getElementById('qc-text')?.value.trim() || '';

    if (isNode ? !text : !name) {
      (nameInput || document.getElementById('qc-text'))?.focus();
      return;
    }

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
        case 'node': {
          const speakerId = document.querySelector('#modal .form-select')?.value || '__player__';
          const prefix = 'node';
          const base = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
          const slug = `${prefix}_${base}`;

          newId = await createNode(_nodeDialogueId, { slug, speakerId, text, playerResponses: [] });
          optionValue = slug || newId;
          optionLabel = `${optionValue} — "${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"`;

          // Refresh the node dropdown and auto-select the new node
          const nodeSelect = _nodeActionCard.querySelector(_nodeIsItems ? '.item-action-node' : '.hs-action-node');
          if (nodeSelect) {
            const loadFn = _nodeIsItems ? window.loadItemDialogueNodes : window.loadHsDialogueNodes;
            await loadFn(_nodeActionCard, _nodeDialogueSlug, optionValue);
          }

          closeModal();
          showToast(`Nodo "${text.slice(0, 30)}" creado`, 'success');
          return; // Skip the normal select.append logic — loadFn handles it
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
