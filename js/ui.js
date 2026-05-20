// ============================================
// UI Utilities
// ============================================

import { getCount } from './db.js';

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
  observeComboboxes();
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
 * Refresh all sidebar badge counts from Firestore
 */
export async function refreshAllBadges() {
  const badgeModules = ['rooms', 'characters', 'items', 'puzzles', 'timeline', 'dialogues', 'gallery', 'audio'];
  const counts = await Promise.all(badgeModules.map(m => getCount(m)));
  counts.forEach((count, i) => updateBadge(badgeModules[i], count));
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
// Combobox — searchable dropdown replacement
// ============================================

/**
 * Custom combobox that replaces a <select data-filterable>.
 * The original select stays in the DOM (hidden) so all existing
 * value-reading code continues to work unchanged.
 */
class Combobox {
  constructor(select) {
    this.select = select;
    this.select.style.display = 'none';
    this.select.removeAttribute('data-filterable');
    this.isOpen = false;
    this.highlightedIndex = -1;

    this._build();
    this._bindEvents();
    this._syncDisplay();

    // Watch for external option changes (e.g. node loading, quick-create)
    this._optObserver = new MutationObserver(() => this._syncDisplay());
    this._optObserver.observe(this.select, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['selected']
    });
  }

  destroy() {
    this._optObserver.disconnect();
    this.wrapper.remove();
    this.select.style.display = '';
    this.select.setAttribute('data-filterable', '');
  }

  _build() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'combobox';

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'combobox-input';
    this.input.setAttribute('autocomplete', 'off');
    this.input.setAttribute('spellcheck', 'false');
    this.input.placeholder = this._getPlaceholder();

    this.arrow = document.createElement('span');
    this.arrow.className = 'combobox-arrow';
    this.arrow.innerHTML = '<i class="fa-solid fa-chevron-down" style="font-size:11px"></i>';

    this.listbox = document.createElement('ul');
    this.listbox.className = 'combobox-listbox';
    this.listbox.setAttribute('role', 'listbox');

    this.wrapper.appendChild(this.input);
    this.wrapper.appendChild(this.arrow);
    this.wrapper.appendChild(this.listbox);

    this.select.parentNode.insertBefore(this.wrapper, this.select);
  }

  _getPlaceholder() {
    const ph = this.select.querySelector('option[value=""]');
    return ph ? ph.textContent : 'Buscar...';
  }

  _syncDisplay() {
    const selected = this.select.querySelector('option:checked');
    this.input.value = (selected && selected.value) ? selected.textContent : '';
  }

  open() {
    this._renderOptions();
    this.listbox.classList.add('open');
    this.arrow.classList.add('open');
    this.isOpen = true;
    this.highlightedIndex = -1;
    // Highlight selected option if any
    const selOpt = this.listbox.querySelector('.combobox-option.selected');
    if (selOpt) {
      selOpt.classList.add('highlighted');
      this.highlightedIndex = Array.from(this.listbox.children).indexOf(selOpt);
    }
  }

  close() {
    this.listbox.classList.remove('open');
    this.arrow.classList.remove('open');
    this.isOpen = false;
    this.highlightedIndex = -1;
    this._syncDisplay();
  }

  _renderOptions() {
    const filter = this.input.value.toLowerCase();
    this.listbox.innerHTML = '';
    let count = 0;

    Array.from(this.select.options).forEach(opt => {
      const text = opt.textContent.toLowerCase();
      const matches = !filter || !opt.value || text.includes(filter) || opt.selected;
      if (!matches) return;

      const li = document.createElement('li');
      li.className = 'combobox-option'
        + (opt.selected ? ' selected' : '')
        + (!opt.value ? ' placeholder' : '');
      li.textContent = opt.textContent;
      li.dataset.value = opt.value;
      li.setAttribute('role', 'option');

      li.addEventListener('mousedown', (e) => {
        e.preventDefault(); // prevent input blur
        this._selectValue(opt.value);
      });

      this.listbox.appendChild(li);
      count++;
    });

    if (count === 0) {
      const li = document.createElement('li');
      li.className = 'combobox-empty';
      li.textContent = 'Sin resultados';
      this.listbox.appendChild(li);
    }
  }

  _highlight(el) {
    this.listbox.querySelectorAll('.combobox-option').forEach(o => o.classList.remove('highlighted'));
    if (el) {
      el.classList.add('highlighted');
      this.highlightedIndex = Array.from(this.listbox.children).indexOf(el);
      el.scrollIntoView({ block: 'nearest' });
    }
  }

  _selectValue(value) {
    this.select.value = value;
    this.select.dispatchEvent(new Event('change', { bubbles: true }));
    this._syncDisplay();
    this.close();
  }

  _bindEvents() {
    this.input.addEventListener('focus', () => {
      if (!this.isOpen) this.open();
    });

    this.input.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.isOpen) this.open();
    });

    this.input.addEventListener('input', () => {
      if (this.isOpen) this._renderOptions();
      else this.open();
    });

    this.input.addEventListener('keydown', (e) => {
      const options = this.listbox.querySelectorAll('.combobox-option');

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (!this.isOpen) { this.open(); return; }
          this.highlightedIndex = Math.min(this.highlightedIndex + 1, options.length - 1);
          this._highlight(options[this.highlightedIndex]);
          break;

        case 'ArrowUp':
          e.preventDefault();
          this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
          this._highlight(options[this.highlightedIndex]);
          break;

        case 'Enter':
          e.preventDefault();
          if (this.isOpen && this.highlightedIndex >= 0 && options[this.highlightedIndex]) {
            this._selectValue(options[this.highlightedIndex].dataset.value);
          } else if (!this.isOpen) {
            this.open();
          }
          break;

        case 'Escape':
          e.preventDefault();
          this._syncDisplay();
          this.close();
          this.input.blur();
          break;

        case 'Tab':
          this.close();
          break;
      }
    });

    this.input.addEventListener('blur', () => {
      // Small delay to let mousedown on option fire first
      setTimeout(() => { if (this.isOpen) this.close(); }, 150);
    });
  }
}

/** Transform all [data-filterable] selects into Combobox instances */
function initFilterableSelects() {
  document.querySelectorAll('.form-select[data-filterable]').forEach(select => {
    // Skip if already wrapped by a combobox
    if (select.previousElementSibling?.classList?.contains('combobox')) return;
    new Combobox(select);
  });
}

/** Set up a MutationObserver to auto-init comboboxes after dynamic content */
let _comboboxObserver = null;
function observeComboboxes() {
  const workspace = document.getElementById('workspace');
  if (!workspace || _comboboxObserver) return;
  _comboboxObserver = new MutationObserver(() => initFilterableSelects());
  _comboboxObserver.observe(workspace, { childList: true, subtree: true });
}

// Expose for use after dynamic HTML insertion
window.initFilterableSelects = initFilterableSelects;

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
