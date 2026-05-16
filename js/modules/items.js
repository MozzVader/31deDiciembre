// ============================================
// Módulo: Inventario & Flags (Items & Conditions)
// ============================================
import { getAll, create, update, remove, getOne } from '../db.js';
import { renderWorkspace, setBreadcrumbs, updateBadge, showToast, confirm, escapeHtml, createSelect } from '../ui.js';

/** Generate a slug from a name: 'Fernet' → 'item_fernet' */
function generateSlug(prefix, name) {
  const base = name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${prefix}_${base}`;
}

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

  return `
    <div class="card-grid">
      ${items.map(item => `
        <div class="card" onclick="window.location.hash='items/${item.id}'">
          <div class="card-header">
            <div style="font-size:24px;">&#128230;</div>
            <div class="card-body">
              <div class="card-title">${escapeHtml(item.name)}</div>
              <div class="card-description">${escapeHtml(item.description || 'Sin descripción')}</div>
            </div>
          </div>
          <div class="card-meta" style="flex-wrap:wrap;">
            <span class="text-xs font-mono">${escapeHtml(item.slug || '')}</span>
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
  const dialogues = await getAll('dialogues');
  const combinations = item?.combinations || [];

  // Store on window for addCombo()
  window._availableComboItems = allItems;
  window._availableComboDialogues = dialogues;

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
            <div class="form-hint">El nombre visible del item (para el jugador).</div>
          </div>
          <div class="form-group">
            <label class="form-label">Slug</label>
            <input type="text" class="form-input font-mono" id="item-slug" placeholder="Ej: item_fernet" value="${escapeHtml(item?.slug || '')}">
            <div class="form-hint">Código identificador. Se auto-genera del nombre.</div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Descripción</label>
          <textarea class="form-textarea" id="item-description" placeholder="La botella de Fernet Branca, el elixir de la noche porteña">${escapeHtml(item?.description || '')}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Combinaciones</label>
          <div class="form-hint">Definí qué pasa cuando se combina este item con otro. Ej: Fernet + Vaso = Vaso con Fernet</div>
          <div class="dynamic-array" id="combinations-container">
            ${combinations.map((combo, i) => renderComboRow(combo, allItems, dialogues, i)).join('')}
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

  // Auto-generate slug from name
  const slugInput = document.getElementById('item-slug');
  const nameInput = document.getElementById('item-name');
  nameInput.addEventListener('input', () => {
    if (!slugInput.dataset.manual) {
      slugInput.value = generateSlug('item', nameInput.value);
    }
  });
  slugInput.addEventListener('input', () => {
    slugInput.dataset.manual = '1';
  });

  document.getElementById('item-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
      slug: document.getElementById('item-slug').value.trim(),
      name: document.getElementById('item-name').value.trim(),
      description: document.getElementById('item-description').value.trim(),
      combinations: collectCombos()
    };

    if (!data.slug) data.slug = generateSlug('item', data.name);
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

function renderComboRow(combo = {}, items = [], dialogues = [], index = 0) {
  return `
    <div class="dynamic-array-item" data-combo-index="${index}">
      <div class="dynamic-array-item-header">
        <span class="dynamic-array-item-title">Combinación #${index + 1}</span>
        <button type="button" class="dynamic-array-remove" onclick="this.closest('.dynamic-array-item').remove()">&times;</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Combinar con (Item)</label>
          ${createSelect(items, combo.withItemSlug || combo.combineWithItemId || '', '— Seleccionar item —')}
        </div>
        <div class="form-group">
          <label class="form-label">Resultado (Item)</label>
          ${createSelect(items, combo.resultItemSlug || combo.resultItemId || '', '— Item resultado —')}
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-checkbox">
            <input type="checkbox" class="combo-consumes-self" ${combo.consumesSelf ? 'checked' : ''}>
            <span class="form-checkbox-label">Se consume este item (self)</span>
          </label>
          <div class="form-hint">El item que tiene esta receta desaparece del inventario.</div>
        </div>
        <div class="form-group">
          <label class="form-checkbox">
            <input type="checkbox" class="combo-consumes-target" ${combo.consumesTarget ? 'checked' : ''}>
            <span class="form-checkbox-label">Se consume el otro item (target)</span>
          </label>
          <div class="form-hint">El item con el que se combina desaparece del inventario.</div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Diálogo al combinar</label>
          ${createSelect(dialogues, combo.resultDialogueSlug || '', '— Opcional —')}
        </div>
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
    const withItemSlug = selects[0]?.value || '';
    const resultItemSlug = selects[1]?.value || '';
    const resultDialogueSlug = selects[2]?.value || '';
    const consumesSelf = item.querySelector('.combo-consumes-self')?.checked || false;
    const consumesTarget = item.querySelector('.combo-consumes-target')?.checked || false;
    if (withItemSlug) {
      combos.push({ withItemSlug, resultItemSlug, consumesSelf, consumesTarget, resultDialogueSlug });
    }
  });
  return combos;
}

window.addCombo = async function() {
  const container = document.getElementById('combinations-container');
  if (!container) return;

  const count = container.querySelectorAll('.dynamic-array-item').length;

  // Try cached data first; fetch from DB if empty
  let itemsList = window._availableComboItems || [];
  let dialoguesList = window._availableComboDialogues || [];

  if (itemsList.length === 0) {
    try {
      const [allItems, allDialogues] = await Promise.all([
        getAll('items'),
        getAll('dialogues')
      ]);
      itemsList = allItems;
      dialoguesList = allDialogues;
      window._availableComboItems = itemsList;
      window._availableComboDialogues = dialoguesList;
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  }

  const html = `
    <div class="dynamic-array-item" data-combo-index="${count}">
      <div class="dynamic-array-item-header">
        <span class="dynamic-array-item-title">Combinación #${count + 1}</span>
        <button type="button" class="dynamic-array-remove" onclick="this.closest('.dynamic-array-item').remove()">&times;</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Combinar con (Item)</label>
          ${createSelect(itemsList, '', '— Seleccionar item —')}
        </div>
        <div class="form-group">
          <label class="form-label">Resultado (Item)</label>
          ${createSelect(itemsList, '', '— Item resultado —')}
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-checkbox">
            <input type="checkbox" class="combo-consumes-self">
            <span class="form-checkbox-label">Se consume este item (self)</span>
          </label>
          <div class="form-hint">El item que tiene esta receta desaparece del inventario.</div>
        </div>
        <div class="form-group">
          <label class="form-checkbox">
            <input type="checkbox" class="combo-consumes-target" checked>
            <span class="form-checkbox-label">Se consume el otro item (target)</span>
          </label>
          <div class="form-hint">El item con el que se combina desaparece del inventario.</div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Diálogo al combinar</label>
          ${createSelect(dialoguesList, '', '— Opcional —')}
        </div>
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
