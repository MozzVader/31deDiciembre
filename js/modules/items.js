// ============================================
// Módulo: Inventario & Flags (Items & Conditions)
// ============================================
import { getAll, create, update, remove, getOne, getNodes } from '../db.js';
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
      <button class="tab ${activeTab === 'items' ? 'active' : ''}" data-tab="items"><i class="fa-solid fa-box-open"></i> Items (${itemsCount})</button>
      <button class="tab ${activeTab === 'flags' ? 'active' : ''}" data-tab="flags"><i class="fa-solid fa-bullseye"></i> Flags (${flagsCount})</button>
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
        <div class="empty-state-icon"><i class="fa-solid fa-box-open" style="font-size:48px;"></i></div>
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
            <div><i class="fa-solid fa-box" style="font-size:24px;color:var(--accent);"></i></div>
            <div class="card-body">
              <div class="card-title">${escapeHtml(item.name)}</div>
              <div class="card-description">${escapeHtml(item.description || 'Sin descripción')}</div>
            </div>
          </div>
          <div class="card-meta" style="flex-wrap:wrap;">
            <span class="text-xs font-mono">${escapeHtml(item.slug || '')}</span>
            ${item.combinations?.length ? `<span class="card-badge">${item.combinations.length} combinación${item.combinations.length !== 1 ? 'es' : ''}</span>` : ''}
            ${item.interactions?.length ? `<span class="card-badge" style="background:rgba(92,168,252,0.1);color:var(--info);"><i class="fa-solid fa-hand-pointer" style="font-size:10px;margin-right:3px;"></i>${item.interactions.length} interacción${item.interactions.length !== 1 ? 'es' : ''}</span>` : ''}
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
  const flags = await getAll('flags');
  const combinations = item?.combinations || [];
  const interactions = item?.interactions || [];

  // Store on window for dynamic add functions
  window._availableComboItems = allItems;
  window._availableComboDialogues = dialogues;
  window._itemFormData = { allItems, dialogues, flags };

  renderWorkspace(`
    <div class="detail-header">
      <button class="detail-back" onclick="window.location.hash='items'"><i class="fa-solid fa-arrow-left"></i> Volver</button>
      <h1 class="detail-title">${isNew ? 'Nuevo Item' : escapeHtml(item.name)}</h1>
    </div>
    <div class="form-container" style="max-width:960px;">
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

        <!-- ========== INTERACCIONES DEL ITEM ========== -->
        <hr class="form-section-divider">
        <div class="form-group">
          <label class="form-label">
            <i class="fa-solid fa-hand-pointer" style="color:var(--info);margin-right:6px;"></i>
            Interacciones del Item
          </label>
          <div class="form-hint">Definí qué pasa cuando el jugador interactúa con este item en el inventario. Examinar (clic derecho) o Usar (clic izquierdo). Esto te permite crear "puertas lógicas": el jugador intenta usar el item y se entera de que le falta algo.</div>
          <div id="item-interactions-container" class="dynamic-array">
            ${interactions.map((int, i) => renderItemInteractionRow(int, i, { dialogues, flags, allItems })).join('')}
          </div>
          <button type="button" class="dynamic-array-add mt-2" onclick="window.addItemInteraction()">
            + Añadir Interacción
          </button>
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

  // Load dialogue nodes for StartDialogue actions that already have a dialogue selected
  document.querySelectorAll('#item-interactions-container .hs-action-card').forEach(async (actionCard) => {
    const type = actionCard.querySelector('.item-action-type')?.value;
    if (type === 'StartDialogue') {
      const dlgSlug = actionCard.querySelector('.item-action-target')?.value;
      const savedNode = actionCard.querySelector('.item-action-node')?.dataset.savedNode || '';
      actionCard.querySelector('.item-action-target')?.addEventListener('change', function() {
        window.loadItemDialogueNodes(actionCard, this.value);
      });
      if (dlgSlug) {
        await window.loadItemDialogueNodes(actionCard, dlgSlug, savedNode);
      }
    }
  });

  document.getElementById('item-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
      slug: document.getElementById('item-slug').value.trim(),
      name: document.getElementById('item-name').value.trim(),
      description: document.getElementById('item-description').value.trim(),
      combinations: collectCombos(),
      interactions: collectItemInteractions()
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
// Item Interactions — Render / Collect / Add
// ============================================

const ITEM_INTERACTION_TYPE_LABELS = {
  examine: 'Examinar (Clic Derecho)',
  use: 'Usar (Clic Izquierdo)'
};

const ITEM_ACTION_LABELS = {
  StartDialogue: 'Iniciar Diálogo',
  AddItem: 'Agregar Item al Inventario',
  RemoveItem: 'Quitar Item del Inventario',
  SetFlag: 'Cambiar Flag'
};

function renderItemInteractionRow(interaction, index, data) {
  const type = interaction.type || 'examine';
  const actions = (interaction.actions || [])
    .map((act, i) => renderItemActionRow(act, i, data)).join('');

  return `
    <div class="interaction-card" data-item-interaction-index="${index}">
      <div class="interaction-card-header">
        <div class="interaction-card-header-left">
          <i class="fa-solid fa-hand-pointer"></i>
          <span class="interaction-title">Interacción #${index + 1} — ${ITEM_INTERACTION_TYPE_LABELS[type] || type}</span>
        </div>
        <button type="button" class="dynamic-array-remove" onclick="this.closest('.interaction-card').remove()">&times;</button>
      </div>
      <div class="interaction-card-body">
        <div class="form-group">
          <label class="form-label">Tipo de Interacción</label>
          <select class="form-select item-interaction-type" onchange="window.handleItemInteractionTypeChange(this)">
            <option value="examine" ${type === 'examine' ? 'selected' : ''}>Examinar (Clic Derecho)</option>
            <option value="use" ${type === 'use' ? 'selected' : ''}>Usar (Clic Izquierdo)</option>
          </select>
          <div class="form-hint">Examinar: el jugador mira el item. Usar: el jugador intenta usar el item activamente.</div>
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Acciones (Resultados)</label>
          <div class="dynamic-array item-interaction-actions-container">
            ${actions}
          </div>
          <button type="button" class="dynamic-array-add mt-2" onclick="window.addItemAction(this.closest('.interaction-card'))">
            + Añadir Acción
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderItemActionRow(action, index, data) {
  const type = action.type || 'StartDialogue';

  let targetVal = '';
  let valueVal = '';
  switch (type) {
    case 'StartDialogue':
      targetVal = action.dialogueSlug || '';
      valueVal = action.nodeSlug || '';
      break;
    case 'AddItem':
    case 'RemoveItem':
      targetVal = action.itemSlug || '';
      break;
    case 'SetFlag':
      targetVal = action.flagSlug || '';
      valueVal = action.value !== undefined ? String(action.value) : '';
      break;
  }

  const { targetHtml, valueHtml } = itemActionFieldsHtml(type, data, targetVal, valueVal);

  return `
    <div class="hs-action-card" data-item-action-index="${index}">
      <div class="hs-action-card-header">
        <span class="hs-action-title">${ITEM_ACTION_LABELS[type] || type}</span>
        <button type="button" class="dynamic-array-remove" onclick="this.closest('.hs-action-card').remove()">&times;</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Tipo de Acción</label>
          <select class="form-select item-action-type" onchange="window.handleItemActionTypeChange(this)">
            <option value="StartDialogue" ${type === 'StartDialogue' ? 'selected' : ''}>Iniciar Diálogo</option>
            <option value="AddItem" ${type === 'AddItem' ? 'selected' : ''}>Agregar Item</option>
            <option value="RemoveItem" ${type === 'RemoveItem' ? 'selected' : ''}>Quitar Item</option>
            <option value="SetFlag" ${type === 'SetFlag' ? 'selected' : ''}>Cambiar Flag</option>
          </select>
        </div>
        <div class="form-group item-action-target-wrap">
          ${targetHtml}
        </div>
        <div class="form-group item-action-value-wrap" ${!valueHtml ? 'style="display:none"' : ''}>
          ${valueHtml}
        </div>
      </div>
    </div>
  `;
}

function itemActionFieldsHtml(type, data, targetVal, valueVal) {
  let targetHtml = '';
  let valueHtml = '';

  switch (type) {
    case 'StartDialogue': {
      const dlgOpts = data.dialogues.map(d => ({ id: d.slug || d.id, name: d.name }));
      targetHtml = `<label class="form-label">Diálogo</label>
        <select class="form-select item-action-target">
          <option value="">— Seleccionar diálogo —</option>
          ${dlgOpts.map(o => `<option value="${escapeHtml(o.id)}" ${o.id === targetVal ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('')}
        </select>
        <div class="form-hint">Al seleccionar un diálogo se cargan sus nodos abajo.</div>`;
      valueHtml = `<label class="form-label">Nodo Inicial (opcional)</label>
        <select class="form-select item-action-node" data-saved-node="${escapeHtml(valueVal || '')}"><option value="">— (arranca desde el primer nodo) —</option></select>
        <div class="form-hint">Dejá vacío para arrancar desde el primer nodo.</div>`;
      break;
    }
    case 'AddItem':
    case 'RemoveItem': {
      const itemOpts = data.allItems.map(i => ({ id: i.slug || i.id, name: i.name }));
      targetHtml = `<label class="form-label">Item</label>
        <select class="form-select item-action-target">
          <option value="">— Seleccionar item —</option>
          ${itemOpts.map(o => `<option value="${escapeHtml(o.id)}" ${o.id === targetVal ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('')}
        </select>`;
      break;
    }
    case 'SetFlag': {
      const flagOpts = data.flags.map(f => ({ id: f.name, name: f.name }));
      targetHtml = `<label class="form-label">Flag</label>
        <select class="form-select item-action-target">
          <option value="">— Seleccionar flag —</option>
          ${flagOpts.map(o => `<option value="${escapeHtml(o.id)}" ${o.id === targetVal ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('')}
        </select>`;
      valueHtml = `<label class="form-label">Valor</label>
        <select class="form-select item-action-value">
          <option value="true" ${valueVal === 'true' ? 'selected' : ''}>true</option>
          <option value="false" ${valueVal === 'false' ? 'selected' : ''}>false</option>
        </select>`;
      break;
    }
  }

  return { targetHtml, valueHtml };
}

function collectItemInteractions() {
  const container = document.getElementById('item-interactions-container');
  if (!container) return [];
  const cards = container.querySelectorAll('.interaction-card');
  const interactions = [];

  cards.forEach(card => {
    const type = card.querySelector('.item-interaction-type')?.value || 'examine';
    const actions = collectItemActions(card);
    interactions.push({ type, actions });
  });

  return interactions;
}

function collectItemActions(interactionCard) {
  const container = interactionCard.querySelector('.item-interaction-actions-container');
  if (!container) return [];
  const cards = container.querySelectorAll('.hs-action-card');
  const actions = [];

  cards.forEach(card => {
    const type = card.querySelector('.item-action-type')?.value || '';
    const target = card.querySelector('.item-action-target')?.value?.trim() || '';
    const value = card.querySelector('.item-action-value')?.value?.trim() || '';
    if (!type) return;

    const action = { type };

    switch (type) {
      case 'StartDialogue':
        action.dialogueSlug = target || null;
        action.nodeSlug = card.querySelector('.item-action-node')?.value?.trim() || null;
        break;
      case 'AddItem':
      case 'RemoveItem':
        action.itemSlug = target || null;
        break;
      case 'SetFlag':
        action.flagSlug = target || null;
        action.value = value === 'true' ? true : (value === 'false' ? false : value);
        break;
    }

    actions.push(action);
  });

  return actions;
}

// ============================================
// Window Functions — Item Interaction Dynamic Add
// ============================================

window.addItemInteraction = function() {
  const container = document.getElementById('item-interactions-container');
  if (!container) return;
  const count = container.querySelectorAll('.interaction-card').length;
  const data = window._itemFormData || {};
  const html = renderItemInteractionRow({}, count, data);
  container.insertAdjacentHTML('beforeend', html);
};

window.addItemAction = function(interactionCard) {
  const container = interactionCard.querySelector('.item-interaction-actions-container');
  if (!container) return;
  const count = container.querySelectorAll('.hs-action-card').length;
  const data = window._itemFormData || {};
  const html = renderItemActionRow({}, count, data);
  container.insertAdjacentHTML('beforeend', html);
};

window.handleItemInteractionTypeChange = function(select) {
  const card = select.closest('.interaction-card');
  const labelSpan = card.querySelector('.interaction-title');
  if (labelSpan) {
    const idx = card.dataset.itemInteractionIndex;
    const num = parseInt(idx) + 1;
    labelSpan.textContent = `Interacción #${num} — ${ITEM_INTERACTION_TYPE_LABELS[select.value] || select.value}`;
  }
};

window.handleItemActionTypeChange = function(select) {
  const card = select.closest('.hs-action-card');
  const type = select.value;
  const data = window._itemFormData || {};

  const { targetHtml, valueHtml } = itemActionFieldsHtml(type, data, '', '');

  card.querySelector('.item-action-target-wrap').innerHTML = targetHtml;
  const valueWrap = card.querySelector('.item-action-value-wrap');
  valueWrap.innerHTML = valueHtml;
  valueWrap.style.display = valueHtml ? '' : 'none';

  const titleSpan = card.querySelector('.hs-action-title');
  if (titleSpan) titleSpan.textContent = ITEM_ACTION_LABELS[type] || type;

  if (type === 'StartDialogue') {
    const targetSelect = card.querySelector('.item-action-target');
    if (targetSelect) {
      targetSelect.onchange = () => window.loadItemDialogueNodes(card, targetSelect.value);
    }
  }
};

window.loadItemDialogueNodes = async function(actionCard, dialogueSlug, selectedNodeSlug = '') {
  const nodeSelect = actionCard.querySelector('.item-action-node');
  if (!nodeSelect) return;

  nodeSelect.innerHTML = '<option value="">— (arranca desde el primer nodo) —</option>';
  if (!dialogueSlug) return;

  const data = window._itemFormData || {};
  const dlg = data.dialogues.find(d => (d.slug || d.id) === dialogueSlug);
  if (!dlg) return;

  try {
    const nodes = await getNodes(dlg.id);
    const opts = nodes.map(n => ({
      id: n.slug || n.id,
      name: `${n.slug || n.id} — "${(n.text || '').slice(0, 40)}${(n.text || '').length > 40 ? '...' : ''}"`
    }));
    nodeSelect.innerHTML = createSelect(opts, selectedNodeSlug, '— (arranca desde el primer nodo) —');
  } catch (err) {
    console.error('Error loading dialogue nodes:', err);
  }
};

// ============================================
// Flags
// ============================================

function renderFlagsList(flags) {
  if (flags.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-bullseye" style="font-size:48px;"></i></div>
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
      <button class="detail-back" onclick="window.location.hash='items/flags'"><i class="fa-solid fa-arrow-left"></i> Volver</button>
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
