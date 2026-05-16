// ============================================
// Módulo: Inventario & Flags (Items & Conditions)
// ============================================
import { getAll, create, update, remove, getOne } from '../db.js';
import { renderWorkspace, setBreadcrumbs, updateBadge, showToast, confirm, escapeHtml, createSelect } from '../ui.js';

let currentTab = 'items';

export async function renderItemsView() {
  setBreadcrumbs([{ label: 'Inventario & Flags' }]);
  await renderTabs('items');
}

export async function renderFlagsView() {
  setBreadcrumbs([{ label: 'Inventario & Flags' }]);
  await renderTabs('flags');
}

async function renderTabs(activeTab = 'items') {
  currentTab = activeTab;
  const items = await getAll('items');
  const flags = await getAll('flags');
  updateBadge('items', items.length + flags.length);

  const itemsCount = items.length;
  const flagsCount = flags.length;

  let contentHtml = '';

  if (activeTab === 'items') {
    contentHtml = await renderItemsList(items);
  } else {
    contentHtml = renderFlagsList(flags);
  }

  renderWorkspace(`
    <div class="workspace-header">
      <div>
        <h1 class="workspace-title">Inventario & Flags</h1>
        <p class="workspace-subtitle">Items: ${itemsCount} — Flags: ${flagsCount}</p>
      </div>
      <button class="btn btn-primary" id="btn-add-item-flag">
        + Nuevo ${activeTab === 'items' ? 'Item' : 'Flag'}
      </button>
    </div>
    <div class="tabs">
      <button class="tab ${activeTab === 'items' ? 'active' : ''}" data-tab="items">&#127890; Items (${itemsCount})</button>
      <button class="tab ${activeTab === 'flags' ? 'active' : ''}" data-tab="flags">&#127919; Flags (${flagsCount})</button>
    </div>
    <div id="tab-content">${contentHtml}</div>
  `);

  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = () => renderTabs(tab.dataset.tab);
  });

  // Add button
  document.getElementById('btn-add-item-flag').onclick = () => {
    if (activeTab === 'items') {
      window.location.hash = 'items/new';
    } else {
      window.location.hash = 'items/flags/new';
    }
  };
}

// ============================================
// Items
// ============================================

async function renderItemsList(items) {
  if (items.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">&#127890;</div>
        <div class="empty-state-title">No hay items todavía</div>
        <div class="empty-state-text">Creá los objetos que el jugador puede encontrar, usar y combinar.</div>
      </div>
    `;
  }

  const allItems = items; // for combination dropdowns

  return `
    <div class="card-grid">
      ${items.map(item => `
        <div class="card" onclick="window.location.hash='items/${item.id}'">
          <div class="card-header">
            <div style="font-size:24px;">${item.iconUrl ? `<img src="${item.iconUrl}" style="width:32px;height:32px;border-radius:6px;">` : '&#128230;'}</div>
            <div class="card-body">
              <div class="card-title">${escapeHtml(item.name)}</div>
              <div class="card-description">${escapeHtml(item.description || '')}</div>
            </div>
          </div>
          <div class="card-meta">
            ${item.isCombinable ? '<span class="card-badge">Combinable</span>' : ''}
            ${item.combinations?.length ? `<span class="card-badge">${item.combinations.length} combinación${item.combinations.length !== 1 ? 'es' : ''}</span>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

export async function renderItemForm(itemId = null) {
  const isNew = !itemId;
  setBreadcrumbs([
    { label: 'Inventario & Flags', route: 'items' },
    { label: 'Items', route: 'items' },
    { label: isNew ? 'Nuevo Item' : 'Editar' }
  ]);

  let item = null;
  if (!isNew) {
    item = await getOne('items', itemId);
    if (!item) {
      showToast('Item no encontrado', 'error');
      window.location.hash = 'items';
      return;
    }
  }

  const allItems = (await getAll('items')).filter(i => i.id !== itemId);
  const flags = await getAll('flags');
  const combinations = item?.combinations || [];

  renderWorkspace(`
    <div class="detail-header">
      <button class="detail-back" onclick="window.location.hash='items'">&#9664; Volver</button>
      <h1 class="detail-title">${isNew ? 'Nuevo Item' : escapeHtml(item.name)}</h1>
    </div>
    <div class="form-container">
      <form id="item-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nombre</label>
            <input type="text" class="form-input" id="item-name" placeholder="Ej: Fernet" value="${escapeHtml(item?.name || '')}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Icono URL</label>
            <input type="text" class="form-input" id="item-icon" placeholder="URL del ícono (opcional)" value="${escapeHtml(item?.iconUrl || '')}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Descripción</label>
          <textarea class="form-textarea" id="item-description" placeholder="Descripción del objeto para el dev">${escapeHtml(item?.description || '')}</textarea>
        </div>

        <div class="form-group">
          <label class="form-checkbox">
            <input type="checkbox" id="item-combinable" ${item?.isCombinable ? 'checked' : ''}>
            <span class="form-checkbox-label">Es combinable con otros items</span>
          </label>
        </div>

        <div class="form-group" id="combinations-section" style="display:${item?.isCombinable ? 'block' : 'none'}">
          <label class="form-label">Combinaciones</label>
          <div class="form-hint">Definí qué pasa cuando se combina este item con otro. Ej: Fernet + Vaso = FernetServido</div>
          <div class="dynamic-array" id="combinations-container">
            ${combinations.map((combo, i) => renderComboRow(combo, allItems, flags, i)).join('')}
          </div>
          <button type="button" class="dynamic-array-add mt-2" onclick="window.addCombo()">+ Agregar Combinación</button>
        </div>

        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary btn-lg">${isNew ? 'Crear Item' : 'Guardar Cambios'}</button>
          ${!isNew ? `<button type="button" class="btn btn-danger" id="btn-delete-item">Eliminar</button>` : ''}
        </div>
      </form>
    </div>
  `);

  // Toggle combinations section
  document.getElementById('item-combinable').onchange = (e) => {
    document.getElementById('combinations-section').style.display = e.target.checked ? 'block' : 'none';
  };

  document.getElementById('item-form').onsubmit = async (e) => {
    e.preventDefault();
    const isCombinable = document.getElementById('item-combinable').checked;
    const data = {
      name: document.getElementById('item-name').value.trim(),
      iconUrl: document.getElementById('item-icon').value.trim(),
      description: document.getElementById('item-description').value.trim(),
      isCombinable,
      combinations: isCombinable ? collectCombos() : []
    };

    if (!data.name) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }

    try {
      if (isNew) {
        await create('items', data);
        showToast('Item creado', 'success');
      } else {
        await update('items', itemId, data);
        showToast('Item actualizado', 'success');
      }
      window.location.hash = 'items';
    } catch (err) {
      console.error(err);
      showToast('Error al guardar: ' + err.message, 'error');
    }
  };

  if (!isNew) {
    document.getElementById('btn-delete-item').onclick = async () => {
      const ok = await confirm(`¿Eliminás "${item.name}"?`);
      if (ok) {
        await remove('items', itemId);
        showToast('Item eliminado', 'success');
        window.location.hash = 'items';
      }
    };
  }
}

function renderComboRow(combo = {}, items = [], flags = [], index = 0) {
  return `
    <div class="dynamic-array-item" data-combo-index="${index}">
      <div class="dynamic-array-item-header">
        <span class="dynamic-array-item-title">Combinación #${index + 1}</span>
        <button type="button" class="dynamic-array-remove" onclick="this.closest('.dynamic-array-item').remove()">&times;</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Combinar con</label>
          ${createSelect(items, combo.combineWithItemId || '', '— Item —')}
        </div>
        <div class="form-group">
          <label class="form-label">Resultado (Item)</label>
          ${createSelect(items, combo.resultItemId || '', '— Item resultado —')}
        </div>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Flag al combinar</label>
        ${createSelect(flags, combo.resultFlagId || '', '— Flag resultado (opcional) —')}
      </div>
    </div>
  `;
}

function collectCombos() {
  const container = document.getElementById('combinations-container');
  const items = container.querySelectorAll('.dynamic-array-item');
  const combos = [];
  items.forEach(item => {
    const selects = item.querySelectorAll('.form-select');
    const combineWithItemId = selects[0]?.value || '';
    const resultItemId = selects[1]?.value || '';
    const resultFlagId = selects[2]?.value || '';
    if (combineWithItemId) {
      combos.push({ combineWithItemId, resultItemId, resultFlagId });
    }
  });
  return combos;
}

window.addCombo = function() {
  const container = document.getElementById('combinations-container');
  const count = container.querySelectorAll('.dynamic-array-item').length;
  const lastItem = container.querySelector('.dynamic-array-item:last-child');
  const s0 = lastItem?.querySelectorAll('.form-select')[0]?.innerHTML || '';
  const s1 = lastItem?.querySelectorAll('.form-select')[1]?.innerHTML || '';
  const s2 = lastItem?.querySelectorAll('.form-select')[2]?.innerHTML || '';

  const html = `
    <div class="dynamic-array-item" data-combo-index="${count}">
      <div class="dynamic-array-item-header">
        <span class="dynamic-array-item-title">Combinación #${count + 1}</span>
        <button type="button" class="dynamic-array-remove" onclick="this.closest('.dynamic-array-item').remove()">&times;</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Combinar con</label>
          <select class="form-select">${s0}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Resultado (Item)</label>
          <select class="form-select">${s1}</select>
        </div>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Flag al combinar</label>
        <select class="form-select">${s2}</select>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
};

// ============================================
// Flags
// ============================================

function renderFlagsList(flags) {
  if (flags.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">&#127919;</div>
        <div class="empty-state-title">No hay flags todavía</div>
        <div class="empty-state-text">Los flags son las condiciones que controlan tu juego. Ej: diego_tomo_cafe = true desbloquea un evento.</div>
      </div>
    `;
  }

  return `
    <div class="flex flex-col gap-2">
      ${flags.map(flag => `
        <div class="flag-toggle ${flag.state ? 'active' : ''}" style="cursor:default;">
          <div class="flag-switch"></div>
          <span class="flag-name">${escapeHtml(flag.name)}</span>
          <span class="flag-state ${flag.state ? 'true' : 'false'}">${flag.state ? 'TRUE' : 'FALSE'}</span>
          <button class="btn btn-ghost btn-sm" style="margin-left:8px;" onclick="event.stopPropagation(); window.location.hash='items/flags/${flag.id}'">Editar</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--danger);border-color:transparent;" onclick="event.stopPropagation(); window.deleteFlag('${flag.id}', '${escapeHtml(flag.name)}')">Eliminar</button>
        </div>
      `).join('')}
    </div>
  `;
}

export async function renderFlagForm(flagId = null) {
  const isNew = !flagId;
  setBreadcrumbs([
    { label: 'Inventario & Flags', route: 'items' },
    { label: 'Flags', route: 'items/flags' },
    { label: isNew ? 'Nuevo Flag' : 'Editar' }
  ]);

  let flag = null;
  if (!isNew) {
    flag = await getOne('flags', flagId);
    if (!flag) {
      showToast('Flag no encontrado', 'error');
      window.location.hash = 'items/flags';
      return;
    }
  }

  renderWorkspace(`
    <div class="detail-header">
      <button class="detail-back" onclick="window.location.hash='items/flags'">&#9664; Volver</button>
      <h1 class="detail-title">${isNew ? 'Nuevo Flag' : escapeHtml(flag.name)}</h1>
    </div>
    <div class="form-container" style="max-width:480px;">
      <form id="flag-form">
        <div class="form-group">
          <label class="form-label">Nombre del Flag</label>
          <input type="text" class="form-input font-mono" id="flag-name" placeholder="Ej: diego_tomo_cafe" value="${escapeHtml(flag?.name || '')}" required>
          <div class="form-hint">Usá snake_case. Este nombre se usa como identificador en triggers y condiciones.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Estado Inicial</label>
          <label class="flag-toggle ${flag?.state ? 'active' : ''}" id="flag-toggle" style="cursor:pointer;">
            <div class="flag-switch"></div>
            <span class="flag-name" id="flag-state-label">${flag?.state ? 'true' : 'false'}</span>
            <input type="hidden" id="flag-state" value="${flag?.state || false}">
          </label>
          <div class="form-hint">Este es el valor del flag cuando arranca el juego a las 20:00.</div>
        </div>

        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary btn-lg">${isNew ? 'Crear Flag' : 'Guardar Cambios'}</button>
          ${!isNew ? `<button type="button" class="btn btn-danger" id="btn-delete-flag">Eliminar</button>` : ''}
        </div>
      </form>
    </div>
  `);

  // Toggle
  document.getElementById('flag-toggle').onclick = () => {
    const input = document.getElementById('flag-state');
    const toggle = document.getElementById('flag-toggle');
    const label = document.getElementById('flag-state-label');
    const newVal = input.value !== 'true';
    input.value = newVal;
    toggle.classList.toggle('active', newVal);
    label.textContent = newVal ? 'true' : 'false';
  };

  document.getElementById('flag-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('flag-name').value.trim(),
      state: document.getElementById('flag-state').value === 'true'
    };

    if (!data.name) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }

    try {
      if (isNew) {
        await create('flags', data);
        showToast('Flag creado', 'success');
      } else {
        await update('flags', flagId, data);
        showToast('Flag actualizado', 'success');
      }
      window.location.hash = 'items/flags';
    } catch (err) {
      console.error(err);
      showToast('Error al guardar: ' + err.message, 'error');
    }
  };

  if (!isNew) {
    document.getElementById('btn-delete-flag').onclick = async () => {
      const ok = await confirm(`¿Eliminás el flag "${flag.name}"?`);
      if (ok) {
        await remove('flags', flagId);
        showToast('Flag eliminado', 'success');
        window.location.hash = 'items/flags';
      }
    };
  }
}

window.deleteFlag = async function(flagId, name) {
  const ok = await confirm(`¿Eliminás el flag "${name}"?`);
  if (ok) {
    await remove('flags', flagId);
    showToast('Flag eliminado', 'success');
    renderTabs('flags');
  }
};
