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
}

/**
 * Close modal
 */
export function closeModal() {
  document.getElementById('modal-overlay').classList.remove('visible');
}

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
    const separator = i > 0 ? '<span class="breadcrumb-separator">&#9656;</span>' : '';
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
