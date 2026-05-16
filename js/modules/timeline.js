// ============================================
// Módulo: Cronología (Timeline / Triggers)
// ============================================
import { getAll, create, update, remove, getOne, getNodes } from '../db.js';
import { renderWorkspace, setBreadcrumbs, updateBadge, showToast, confirm, escapeHtml, createSelect, showModal, closeModal } from '../ui.js';

/** Generate a slug from a name: 'Don Rodolfo entra al bar' → 'event_don_rodolfo_entra_al_bar' */
function generateSlug(prefix, name) {
  const base = name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${prefix}_${base}`;
}

// ============================================
// Helpers — Smart Dropdowns
// ============================================

/** createSelect with an extra CSS class injected on the <select> */
function sel(items, selected, placeholder, extraClass) {
  const html = createSelect(items, selected, placeholder);
  return extraClass ? html.replace('class="form-select"', `class="form-select ${extraClass}"`) : html;
}

/** Resolve a raw value (Firestore ID or slug) to slug/name based on context */
function toSlug(type, raw, data) {
  if (!raw) return '';
  if (/^(room_|char_|item_|dlg_|event_|node_)/.test(raw)) return raw;
  const { characters, rooms, flags, items, dialogues } = data;
  const find = (arr, key) => { const o = arr.find(x => x.id === raw); return o ? (o.slug || o[key] || o.id) : raw; };
  switch (type) {
    case 'MoveCharacter': return find(characters, 'slug');
    case 'SetFlag': return find(flags, 'name');
    case 'UnlockExit': case 'RoomEnter': return find(rooms, 'slug');
    case 'GiveItem': case 'RemoveItem': case 'ItemPickup': return find(items, 'slug');
    case 'StartDialogue': case 'DialogueEnd': return find(dialogues, 'slug');
    default: return raw;
  }
}

/** Render trigger target as a smart dropdown (always has id="trigger-target") */
function triggerTargetHtml(type, value, data) {
  if (type === 'AutoStart')
    return `<input type="text" class="form-input" id="trigger-target" disabled placeholder="(no necesita target)" value="">`;
  switch (type) {
    case 'FlagChange':
      return sel(data.flags.map(f => ({ id: f.name, name: f.name })), value, '— Seleccionar flag —', 'id="trigger-target"');
    case 'RoomEnter':
      return sel(data.rooms.map(r => ({ id: r.slug || r.id, name: r.name })), value, '— Seleccionar habitación —', 'id="trigger-target"');
    case 'ItemPickup':
      return sel(data.items.map(i => ({ id: i.slug || i.id, name: i.name })), value, '— Seleccionar item —', 'id="trigger-target"');
    case 'DialogueEnd':
      return sel(data.dialogues.map(d => ({ id: d.slug || d.id, name: d.name })), value, '— Seleccionar diálogo —', 'id="trigger-target"');
    default:
      return `<input type="text" class="form-input" id="trigger-target" placeholder="ID del elemento" value="${escapeHtml(value)}">`;
  }
}

/** Config for action TARGET dropdown */
function aTargetCfg(type, data) {
  switch (type) {
    case 'MoveCharacter':    return { label: 'Personaje', items: data.characters.map(c => ({ id: c.slug || c.id, name: c.name })), ph: '— Seleccionar personaje —' };
    case 'SetFlag':          return { label: 'Flag',      items: data.flags.map(f => ({ id: f.name, name: f.name })),           ph: '— Seleccionar flag —' };
    case 'UnlockExit':       return { label: 'Habitación', items: data.rooms.map(r => ({ id: r.slug || r.id, name: r.name })),    ph: '— Seleccionar habitación —' };
    case 'GiveItem': case 'RemoveItem':
                             return { label: 'Personaje', items: data.characters.map(c => ({ id: c.slug || c.id, name: c.name })), ph: '— Seleccionar personaje —' };
    case 'StartDialogue':    return { label: 'Diálogo',   items: data.dialogues.map(d => ({ id: d.slug || d.id, name: d.name })),  ph: '— Seleccionar diálogo —' };
    default: return null;
  }
}

/** Config for action VALUE dropdown */
function aValueCfg(type, data) {
  switch (type) {
    case 'MoveCharacter':             return { label: 'Habitación Destino', items: data.rooms.map(r => ({ id: r.slug || r.id, name: r.name })),    ph: '— Seleccionar habitación —' };
    case 'SetFlag':                   return { label: 'Valor', bool: true };
    case 'UnlockExit':                return { label: 'Dirección', text: true, ph: 'Ej: norte, sur, este, oeste' };
    case 'GiveItem': case 'RemoveItem': return { label: 'Item', items: data.items.map(i => ({ id: i.slug || i.id, name: i.name })),      ph: '— Seleccionar item —' };
    case 'StartDialogue':             return { label: 'Nodo Inicial', node: true, ph: '— Seleccionar nodo —' };
    default: return null;
  }
}

/** Build action target + value HTML strings */
function actionFieldsHtml(type, data, targetVal, valueVal) {
  const tc = aTargetCfg(type, data);
  const vc = aValueCfg(type, data);

  // Target
  let targetHtml;
  if (tc && tc.items) {
    targetHtml = `<label class="form-label">${escapeHtml(tc.label)}</label>\n${sel(tc.items, targetVal, tc.ph, 'action-target')}`;
  } else {
    targetHtml = `<label class="form-label">Target</label>\n<input type="text" class="form-input action-target" placeholder="ID del elemento" value="${escapeHtml(targetVal)}">`;
  }

  // Value
  let valueHtml = '';
  if (vc) {
    if (vc.items) {
      valueHtml = `<label class="form-label">${escapeHtml(vc.label)}</label>\n${sel(vc.items, valueVal, vc.ph, 'action-value')}`;
    } else if (vc.bool) {
      valueHtml = `<label class="form-label">${escapeHtml(vc.label)}</label>\n<select class="form-select action-value"><option value="true" ${valueVal === 'true' || valueVal === true ? 'selected' : ''}>true</option><option value="false" ${valueVal === 'false' || valueVal === false ? 'selected' : ''}>false</option></select>`;
    } else if (vc.node) {
      valueHtml = `<label class="form-label">${escapeHtml(vc.label)}</label>\n<select class="form-select action-node"><option value="">${vc.ph}</option></select>`;
    } else if (vc.text) {
      valueHtml = `<label class="form-label">${escapeHtml(vc.label)}</label>\n<input type="text" class="form-input action-value" placeholder="${vc.ph}" value="${escapeHtml(valueVal)}">`;
    }
  }

  // Node row (only for StartDialogue — separate row for clarity)
  const nodeHtml = type === 'StartDialogue'
    ? `<div class="form-row" data-action-extra><div class="form-group"><label class="form-label">Nodo Inicial (opcional)</label><select class="form-select action-node"><option value="">— Seleccionar nodo —</option></select><div class="form-hint">Dejá vacío para arrancar desde el primer nodo del diálogo.</div></div></div>`
    : '';

  return { targetHtml, valueHtml, nodeHtml };
}

// ============================================
// Timeline List
// ============================================

export async function renderTimelineList() {
  setBreadcrumbs([{ label: 'Cronología' }]);
  const events = await getAll('timeline');
  updateBadge('timeline', events.length);

  const flags = await getAll('flags');
  const rooms = await getAll('rooms');
  const characters = await getAll('characters');
  const items = await getAll('items');
  const dialogues = await getAll('dialogues');

  if (events.length === 0) {
    renderWorkspace(`
      <div class="workspace-header">
        <div>
          <h1 class="workspace-title">Cronología</h1>
          <p class="workspace-subtitle">Lo que convierte un mapa estático en una historia</p>
        </div>
        <button class="btn btn-primary" onclick="window.location.hash='timeline/new'">+ Nuevo Evento</button>
      </div>
      <div class="empty-state">
        <div class="empty-state-icon">&#9201;&#65039;</div>
        <div class="empty-state-title">No hay eventos en la línea temporal</div>
        <div class="empty-state-text">Los triggers controlan cuándo entran los personajes, cuándo cambian los flags y cuándo se desbloquean salidas. Son el motor de tu historia.</div>
        <button class="btn btn-primary" onclick="window.location.hash='timeline/new'">+ Crear Evento</button>
      </div>
    `);
    return;
  }

  const timelineData = { characters, rooms, flags, items, dialogues };

  const timelineHtml = events.map(event => {
    const cond = event.triggerCondition || {};
    const condType = cond.type || '?';
    const condValue = cond.value !== undefined ? cond.value : '?';

    // Resolve trigger target to friendly name
    let condTarget = '';
    if (cond.flagId) condTarget = cond.flagId;
    else if (cond.roomId) condTarget = rooms.find(r => r.id === cond.roomId)?.name || cond.roomId;
    else if (cond.itemId) condTarget = items.find(i => i.id === cond.itemId)?.name || cond.itemId;
    else if (cond.dialogueId) condTarget = dialogues.find(d => d.id === cond.dialogueId)?.name || cond.dialogueId;

    const actionsHtml = (event.actions || []).map(a => {
      const icons = { 'MoveCharacter': '&#128694;', 'SetFlag': '&#127919;', 'UnlockExit': '&#128275;', 'GiveItem': '&#127890;', 'RemoveItem': '&#128465;', 'StartDialogue': '&#128172;' };
      let detail = '';
      if (a.type === 'StartDialogue') {
        const dlg = dialogues.find(d => (d.slug || d.id) === (a.dialogueId || a.target));
        detail = dlg ? dlg.name : (a.dialogueId || a.target || '');
        if (a.nodeSlug) detail += ` → ${a.nodeSlug}`;
      } else if (a.type === 'MoveCharacter') {
        const ch = characters.find(c => (c.slug || c.id) === a.target);
        const rm = rooms.find(r => (r.slug || r.id) === a.destination);
        detail = `${ch?.name || a.target} → ${rm?.name || a.destination}`;
      } else if (a.type === 'SetFlag') {
        detail = `${a.target} = ${a.value}`;
      } else if (a.type === 'GiveItem' || a.type === 'RemoveItem') {
        const it = items.find(i => (i.slug || i.id) === a.itemId);
        detail = it?.name || a.itemId || '';
      } else if (a.type === 'UnlockExit') {
        const rm = rooms.find(r => (r.slug || r.id) === a.target);
        detail = `${rm?.name || a.target} — ${a.exitDirection}`;
      } else {
        detail = a.target || a.destination || '';
      }
      return `<span>${icons[a.type] || '&#9881;'} ${escapeHtml(a.type)}: ${escapeHtml(detail)}</span>`;
    }).join('');

    return `
      <div class="timeline-event" onclick="window.location.hash='timeline/${event.id}'">
        <div class="timeline-event-name">${escapeHtml(event.eventName)}</div>
        <div style="font-size:11px;color:var(--muted);font-family:var(--mono);margin-bottom:4px;">${escapeHtml(event.slug || '')}</div>
        <div class="timeline-event-trigger">
          Trigger: <code>${escapeHtml(condType)}(${escapeHtml(condTarget)}) = ${condValue}</code>
        </div>
        <div class="timeline-event-actions">${actionsHtml || '<span>Sin acciones</span>'}</div>
      </div>
    `;
  }).join('');

  renderWorkspace(`
    <div class="workspace-header">
      <div>
        <h1 class="workspace-title">Cronología</h1>
        <p class="workspace-subtitle">${events.length} evento${events.length !== 1 ? 's' : ''} en la línea temporal</p>
      </div>
      <button class="btn btn-primary" onclick="window.location.hash='timeline/new'">+ Nuevo Evento</button>
    </div>
    <div class="timeline">${timelineHtml}</div>
  `);
}

// ============================================
// Timeline Form
// ============================================

export async function renderTimelineForm(eventId = null) {
  const isNew = !eventId;
  setBreadcrumbs([
    { label: 'Cronología', route: 'timeline' },
    { label: isNew ? 'Nuevo Evento' : 'Editar' }
  ]);

  let event = null;
  if (!isNew) {
    event = await getOne('timeline', eventId);
    if (!event) {
      showToast('Evento no encontrado', 'error');
      window.location.hash = 'timeline';
      return;
    }
  }

  const flags = await getAll('flags');
  const rooms = await getAll('rooms');
  const characters = await getAll('characters');
  const items = await getAll('items');
  const dialogues = await getAll('dialogues');
  const actions = event?.actions || [];

  // Store globally for smart dropdowns
  const td = { characters, rooms, flags, items, dialogues };
  window._timelineData = td;

  // Resolve existing trigger target to slug
  const trigType = event?.triggerCondition?.type || 'FlagChange';
  let trigTargetVal = '';
  const tc = event?.triggerCondition || {};
  if (tc.flagId) trigTargetVal = toSlug('SetFlag', tc.flagId, td);
  else if (tc.roomId) trigTargetVal = toSlug('RoomEnter', tc.roomId, td);
  else if (tc.itemId) trigTargetVal = toSlug('ItemPickup', tc.itemId, td);
  else if (tc.dialogueId) trigTargetVal = toSlug('DialogueEnd', tc.dialogueId, td);

  const actionsHtml = actions.map((a, i) => renderActionRow(a, td, i)).join('');

  renderWorkspace(`
    <div class="detail-header">
      <button class="detail-back" onclick="window.location.hash='timeline'">&#9664; Volver</button>
      <h1 class="detail-title">${isNew ? 'Nuevo Evento' : escapeHtml(event.eventName)}</h1>
    </div>
    <div class="form-container">
      <form id="event-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nombre del Evento</label>
            <input type="text" class="form-input" id="event-name" placeholder='Ej: "Don Rodolfo entra al bar"' value="${escapeHtml(event?.eventName || '')}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Slug</label>
            <input type="text" class="form-input font-mono" id="event-slug" placeholder="Ej: event_don_rodolfo_entra" value="${escapeHtml(event?.slug || '')}">
            <div class="form-hint">Código identificador. Se auto-genera del nombre.</div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Condición del Trigger</label>
          <div class="form-hint">¿Qué tiene que pasar para que este evento se dispare?</div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Tipo de Trigger</label>
              <select class="form-select" id="trigger-type">
                <option value="FlagChange" ${trigType === 'FlagChange' ? 'selected' : ''}>Flag Change (un flag cambia de valor)</option>
                <option value="RoomEnter" ${trigType === 'RoomEnter' ? 'selected' : ''}>Room Enter (jugador entra a una habitación)</option>
                <option value="ItemPickup" ${trigType === 'ItemPickup' ? 'selected' : ''}>Item Pickup (jugador toma un item)</option>
                <option value="DialogueEnd" ${trigType === 'DialogueEnd' ? 'selected' : ''}>Dialogue End (termina un diálogo)</option>
                <option value="AutoStart" ${trigType === 'AutoStart' ? 'selected' : ''}>Auto Start (al inicio del juego)</option>
              </select>
            </div>
            <div class="form-group" id="trigger-target-wrap">
              <label class="form-label">Target</label>
              ${triggerTargetHtml(trigType, trigTargetVal, td)}
            </div>
          </div>
          <div class="form-group" style="margin-top:12px;">
            <label class="form-label">Valor Esperado</label>
            <select class="form-select" id="trigger-value">
              <option value="true" ${event?.triggerCondition?.value === true ? 'selected' : ''}>true</option>
              <option value="false" ${event?.triggerCondition?.value === false ? 'selected' : ''}>false</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Acciones</label>
          <div class="form-hint">¿Qué pasa cuando se dispara el trigger? Podés agregar múltiples acciones.</div>
          <div class="dynamic-array" id="actions-container">
            ${actionsHtml}
          </div>
          <button type="button" class="dynamic-array-add mt-2" onclick="window.addAction()">+ Agregar Acción</button>
        </div>

        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary btn-lg">${isNew ? 'Crear Evento' : 'Guardar Cambios'}</button>
          ${!isNew ? `<button type="button" class="btn btn-danger" id="btn-delete-event">Eliminar</button>` : ''}
        </div>
      </form>
    </div>
  `);

  // Auto-generate slug from event name
  const slugInput = document.getElementById('event-slug');
  const nameInput = document.getElementById('event-name');
  nameInput.addEventListener('input', () => {
    if (!slugInput.dataset.manual) {
      slugInput.value = generateSlug('event', nameInput.value);
    }
  });
  slugInput.addEventListener('input', () => {
    slugInput.dataset.manual = '1';
  });

  // Trigger type change → smart dropdown
  document.getElementById('trigger-type').onchange = (e) => {
    const wrap = document.getElementById('trigger-target-wrap');
    const type = e.target.value;
    wrap.innerHTML = `<label class="form-label">Target</label>\n${triggerTargetHtml(type, '', window._timelineData)}`;
  };

  // Load dialogue nodes for StartDialogue actions that already have a dialogue selected
  document.querySelectorAll('.dynamic-array-item').forEach(async (row) => {
    const type = row.querySelector('.action-type')?.value;
    if (type === 'StartDialogue') {
      const dlgSlug = row.querySelector('.action-target')?.value;
      if (dlgSlug) await window.loadDialogueNodes(row, dlgSlug);
    }
  });

  document.getElementById('event-form').onsubmit = async (e) => {
    e.preventDefault();
    const triggerType = document.getElementById('trigger-type').value;
    const triggerTargetEl = document.querySelector('#trigger-target-wrap select, #trigger-target-wrap input');
    const triggerTarget = triggerTargetEl?.value?.trim() || '';
    const triggerValue = document.getElementById('trigger-value').value === 'true';

    const triggerCondition = { type: triggerType, value: triggerValue };

    // Store in the right key (value is now a slug, not a Firestore ID)
    if (triggerType === 'FlagChange') triggerCondition.flagId = triggerTarget;
    else if (triggerType === 'RoomEnter') triggerCondition.roomId = triggerTarget;
    else if (triggerType === 'ItemPickup') triggerCondition.itemId = triggerTarget;
    else if (triggerType === 'DialogueEnd') triggerCondition.dialogueId = triggerTarget;

    const data = {
      slug: document.getElementById('event-slug').value.trim(),
      eventName: document.getElementById('event-name').value.trim(),
      triggerCondition,
      actions: collectActions()
    };

    if (!data.slug) data.slug = generateSlug('event', data.eventName);
    if (!data.eventName) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }

    try {
      if (isNew) {
        await create('timeline', data);
        showToast('Evento creado', 'success');
      } else {
        await update('timeline', eventId, data);
        showToast('Evento actualizado', 'success');
      }
      window.location.hash = 'timeline';
    } catch (err) {
      console.error(err);
      showToast('Error al guardar: ' + err.message, 'error');
    }
  };

  if (!isNew) {
    document.getElementById('btn-delete-event').onclick = async () => {
      const ok = await confirm(`¿Eliminás "${event.eventName}"?`);
      if (ok) {
        await remove('timeline', eventId);
        showToast('Evento eliminado', 'success');
        window.location.hash = 'timeline';
      }
    };
  }
}

// ============================================
// Action Row — Smart Dropdowns
// ============================================

function renderActionRow(action = {}, data = {}, index = 0) {
  const type = action.type || 'MoveCharacter';

  // Resolve existing values to slugs
  let targetVal = '';
  if (action.target) targetVal = toSlug(type, action.target, data);
  else if (action.dialogueId) targetVal = toSlug('StartDialogue', action.dialogueId, data);
  else if (action.itemId) targetVal = toSlug('GiveItem', action.itemId, data);

  let valueVal = '';
  if (type === 'MoveCharacter' && action.destination) valueVal = toSlug('RoomEnter', action.destination, data);
  else if (type === 'SetFlag') valueVal = action.value !== undefined ? String(action.value) : '';
  else if (type === 'UnlockExit') valueVal = action.exitDirection || '';
  else if ((type === 'GiveItem' || type === 'RemoveItem') && action.itemId) valueVal = toSlug('ItemPickup', action.itemId, data);

  const { targetHtml, valueHtml, nodeHtml } = actionFieldsHtml(type, data, targetVal, valueVal);

  // Build onchange for dialogue target (to load nodes)
  const targetOnchange = type === 'StartDialogue' ? ' onchange="window.loadDialogueNodes(this.closest(\'.dynamic-array-item\'), this.value)"' : '';

  return `
    <div class="dynamic-array-item" data-action-index="${index}">
      <div class="dynamic-array-item-header">
        <span class="dynamic-array-item-title">Acción #${index + 1}</span>
        <button type="button" class="dynamic-array-remove" onclick="this.closest('.dynamic-array-item').remove()">&times;</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Tipo de Acción</label>
          <select class="form-select action-type" onchange="window.handleActionTypeChange(this)">
            <option value="MoveCharacter" ${type === 'MoveCharacter' ? 'selected' : ''}>Mover Personaje</option>
            <option value="SetFlag" ${type === 'SetFlag' ? 'selected' : ''}>Cambiar Flag</option>
            <option value="UnlockExit" ${type === 'UnlockExit' ? 'selected' : ''}>Desbloquear Salida</option>
            <option value="GiveItem" ${type === 'GiveItem' ? 'selected' : ''}>Dar Item al Jugador</option>
            <option value="RemoveItem" ${type === 'RemoveItem' ? 'selected' : ''}>Quitar Item al Jugador</option>
            <option value="StartDialogue" ${type === 'StartDialogue' ? 'selected' : ''}>Iniciar Diálogo</option>
          </select>
        </div>
        <div class="form-group action-target-wrap">
          ${targetHtml}
        </div>
      </div>
      <div class="form-row">
        <div class="form-group action-value-wrap">
          ${valueHtml}
        </div>
      </div>
      ${nodeHtml}
    </div>
  `;
}

// ============================================
// Collect Actions from Smart Dropdowns
// ============================================

function collectActions() {
  const container = document.getElementById('actions-container');
  const rows = container.querySelectorAll('.dynamic-array-item');
  const actions = [];

  rows.forEach(row => {
    const type = row.querySelector('.action-type')?.value;
    if (!type) return;

    // Target — always from the first select/input in action-target-wrap
    const targetEl = row.querySelector('.action-target');
    const target = targetEl?.value?.trim() || '';
    if (!target) return;

    // Value — from .action-value select/input
    const valueEl = row.querySelector('.action-value');
    const value = valueEl?.value?.trim() || '';

    // Node — from .action-node select (only for StartDialogue)
    const nodeEl = row.querySelector('.action-node');
    const nodeSlug = nodeEl?.value?.trim() || '';

    const action = { type, target };

    if (type === 'MoveCharacter') {
      action.destination = value;
    } else if (type === 'SetFlag') {
      action.value = value === 'true';
    } else if (type === 'UnlockExit') {
      action.exitDirection = value;
    } else if (type === 'GiveItem' || type === 'RemoveItem') {
      action.itemId = value;
    } else if (type === 'StartDialogue') {
      action.dialogueId = target;
      if (nodeSlug) action.nodeSlug = nodeSlug;
    } else {
      action.value = value;
    }

    actions.push(action);
  });

  return actions;
}

// ============================================
// Action Type Change → Re-render Smart Dropdowns
// ============================================

window.handleActionTypeChange = function(select) {
  const row = select.closest('.dynamic-array-item');
  const type = select.value;
  const data = window._timelineData || {};

  const { targetHtml, valueHtml, nodeHtml } = actionFieldsHtml(type, data, '', '');

  // Replace target
  row.querySelector('.action-target-wrap').innerHTML = targetHtml;

  // Replace value
  row.querySelector('.action-value-wrap').innerHTML = valueHtml;

  // Replace/remove node row
  const existingExtra = row.querySelector('[data-action-extra]');
  if (existingExtra) existingExtra.remove();
  if (nodeHtml) {
    row.insertAdjacentHTML('beforeend', nodeHtml);
  }

  // Attach onchange to dialogue target to load nodes
  if (type === 'StartDialogue') {
    const targetSelect = row.querySelector('.action-target');
    if (targetSelect) {
      targetSelect.onchange = () => window.loadDialogueNodes(row, targetSelect.value);
    }
  }
};

// ============================================
// Load Dialogue Nodes (for StartDialogue node dropdown)
// ============================================

window.loadDialogueNodes = async function(row, dialogueSlug) {
  const nodeSelect = row.querySelector('.action-node');
  if (!nodeSelect) return;

  // Reset
  nodeSelect.innerHTML = '<option value="">— Seleccionar nodo —</option>';

  if (!dialogueSlug) return;

  const data = window._timelineData || {};
  const dlg = data.dialogues.find(d => (d.slug || d.id) === dialogueSlug);
  if (!dlg) return;

  try {
    const nodes = await getNodes(dlg.id);
    const opts = nodes.map(n => ({
      id: n.slug || n.id,
      name: `${n.slug || n.id} — "${(n.text || '').slice(0, 35)}${(n.text || '').length > 35 ? '...' : ''}"`
    }));
    nodeSelect.innerHTML = createSelect(opts, '', '— (arranca desde el primer nodo) —');
  } catch (err) {
    console.error('Error loading dialogue nodes:', err);
  }
};

// ============================================
// Add Action
// ============================================

window.addAction = function() {
  const container = document.getElementById('actions-container');
  const count = container.querySelectorAll('.dynamic-array-item').length;
  container.insertAdjacentHTML('beforeend', renderActionRow({}, window._timelineData || {}, count));
};
