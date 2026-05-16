// ============================================
// Módulo: Cronología (Timeline / Triggers)
// ============================================
import { getAll, create, update, remove, getOne } from '../db.js';
import { renderWorkspace, setBreadcrumbs, updateBadge, showToast, confirm, escapeHtml, createSelect } from '../ui.js';

export async function renderTimelineList() {
  setBreadcrumbs([{ label: 'Cronología' }]);
  const events = await getAll('timeline');
  updateBadge('timeline', events.length);

  const flags = await getAll('flags');
  const rooms = await getAll('rooms');
  const characters = await getAll('characters');

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

  const timelineHtml = events.map(event => {
    const cond = event.triggerCondition || {};
    const condType = cond.type || '?';
    const condFlag = cond.flagId || '';
    const condValue = cond.value !== undefined ? cond.value : '?';

    // Find flag name
    const flagObj = flags.find(f => f.id === condFlag);
    const flagName = flagObj ? flagObj.name : condFlag;

    const actionsHtml = (event.actions || []).map(a => {
      const icons = {
        'MoveCharacter': '&#128694;',
        'SetFlag': '&#127919;',
        'UnlockExit': '&#128275;'
      };
      return `<span>${icons[a.type] || '&#9881;'} ${escapeHtml(a.type)}: ${escapeHtml(a.target || a.destination || '')}</span>`;
    }).join('');

    return `
      <div class="timeline-event" onclick="window.location.hash='timeline/${event.id}'">
        <div class="timeline-event-name">${escapeHtml(event.eventName)}</div>
        <div class="timeline-event-trigger">
          Trigger: <code>${escapeHtml(condType)}(${escapeHtml(flagName)}) = ${condValue}</code>
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
  const actions = event?.actions || [];

  const actionsHtml = actions.map((a, i) => renderActionRow(a, characters, rooms, flags, i)).join('');

  renderWorkspace(`
    <div class="detail-header">
      <button class="detail-back" onclick="window.location.hash='timeline'">&#9664; Volver</button>
      <h1 class="detail-title">${isNew ? 'Nuevo Evento' : escapeHtml(event.eventName)}</h1>
    </div>
    <div class="form-container">
      <form id="event-form">
        <div class="form-group">
          <label class="form-label">Nombre del Evento</label>
          <input type="text" class="form-input" id="event-name" placeholder='Ej: "Don Rodolfo entra al bar"' value="${escapeHtml(event?.eventName || '')}" required>
        </div>

        <div class="form-group">
          <label class="form-label">Condición del Trigger</label>
          <div class="form-hint">¿Qué tiene que pasar para que este evento se dispare?</div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Tipo de Trigger</label>
              <select class="form-select" id="trigger-type">
                <option value="FlagChange" ${event?.triggerCondition?.type === 'FlagChange' ? 'selected' : ''}>Flag Change (un flag cambia de valor)</option>
                <option value="RoomEnter" ${event?.triggerCondition?.type === 'RoomEnter' ? 'selected' : ''}>Room Enter (jugador entra a una habitación)</option>
                <option value="ItemPickup" ${event?.triggerCondition?.type === 'ItemPickup' ? 'selected' : ''}>Item Pickup (jugador toma un item)</option>
                <option value="DialogueEnd" ${event?.triggerCondition?.type === 'DialogueEnd' ? 'selected' : ''}>Dialogue End (termina un diálogo)</option>
                <option value="AutoStart" ${event?.triggerCondition?.type === 'AutoStart' ? 'selected' : ''}>Auto Start (al inicio del juego)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Target (Flag/Room/Item ID)</label>
              <input type="text" class="form-input" id="trigger-target" placeholder="ID del flag, habitación o item" value="${escapeHtml(event?.triggerCondition?.flagId || event?.triggerCondition?.roomId || event?.triggerCondition?.targetId || '')}">
              <div class="form-hint">ID del elemento que dispara el trigger. Seleccioná un flag para FlagChange, etc.</div>
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

  // Trigger type change: update target placeholder
  document.getElementById('trigger-type').onchange = (e) => {
    const input = document.getElementById('trigger-target');
    const placeholders = {
      'FlagChange': 'Seleccioná o escribí el ID del flag',
      'RoomEnter': 'Seleccioná o escribí el ID de la habitación',
      'ItemPickup': 'Seleccioná o escribí el ID del item',
      'DialogueEnd': 'ID del diálogo',
      'AutoStart': '(no necesita target)'
    };
    input.placeholder = placeholders[e.target.value] || 'ID del elemento';
    if (e.target.value === 'AutoStart') {
      input.disabled = true;
      input.value = '';
    } else {
      input.disabled = false;
    }
  };

  document.getElementById('event-form').onsubmit = async (e) => {
    e.preventDefault();
    const triggerType = document.getElementById('trigger-type').value;
    const triggerTarget = document.getElementById('trigger-target').value.trim();
    const triggerValue = document.getElementById('trigger-value').value === 'true';

    const triggerCondition = {
      type: triggerType,
      value: triggerValue
    };

    // Set the right key based on trigger type
    if (triggerType === 'FlagChange') triggerCondition.flagId = triggerTarget;
    else if (triggerType === 'RoomEnter') triggerCondition.roomId = triggerTarget;
    else if (triggerType === 'ItemPickup') triggerCondition.itemId = triggerTarget;
    else if (triggerType === 'DialogueEnd') triggerCondition.dialogueId = triggerTarget;

    const data = {
      eventName: document.getElementById('event-name').value.trim(),
      triggerCondition,
      actions: collectActions()
    };

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

function renderActionRow(action = {}, characters = [], rooms = [], flags = [], index = 0) {
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
            <option value="MoveCharacter" ${action.type === 'MoveCharacter' ? 'selected' : ''}>Mover Personaje</option>
            <option value="SetFlag" ${action.type === 'SetFlag' ? 'selected' : ''}>Cambiar Flag</option>
            <option value="UnlockExit" ${action.type === 'UnlockExit' ? 'selected' : ''}>Desbloquear Salida</option>
            <option value="GiveItem" ${action.type === 'GiveItem' ? 'selected' : ''}>Dar Item al Jugador</option>
            <option value="RemoveItem" ${action.type === 'RemoveItem' ? 'selected' : ''}>Quitar Item al Jugador</option>
            <option value="StartDialogue" ${action.type === 'StartDialogue' ? 'selected' : ''}>Iniciar Diálogo</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Target</label>
          <input type="text" class="form-input action-target" placeholder="ID del personaje, flag, etc." value="${escapeHtml(action.target || action.destination || '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Valor / Destino extra</label>
          <input type="text" class="form-input action-value" placeholder="Valor del flag, ID destino, etc." value="${escapeHtml(action.value !== undefined ? String(action.value) : (action.exitDirection || ''))}">
        </div>
        <div class="form-group" style="display:flex;align-items:flex-end;">
          <button type="button" class="btn btn-ghost btn-sm" onclick="window.fillActionFromDropdown(this)" title="Autocompletar desde lista">Autocompletar</button>
        </div>
      </div>
    </div>
  `;
}

function collectActions() {
  const container = document.getElementById('actions-container');
  const items = container.querySelectorAll('.dynamic-array-item');
  const actions = [];
  items.forEach(item => {
    const type = item.querySelector('.action-type')?.value;
    const target = item.querySelector('.action-target')?.value.trim();
    const value = item.querySelector('.action-value')?.value.trim();

    if (type && target) {
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
        action.dialogueId = value;
      } else {
        action.value = value;
      }

      actions.push(action);
    }
  });
  return actions;
}

window.handleActionTypeChange = function(select) {
  const item = select.closest('.dynamic-array-item');
  const targetInput = item.querySelector('.action-target');
  const valueInput = item.querySelector('.action-value');
  const placeholders = {
    'MoveCharacter': { target: 'ID del personaje', value: 'ID de la habitación destino' },
    'SetFlag': { target: 'ID del flag', value: 'true o false' },
    'UnlockExit': { target: 'ID de la habitación', value: 'Dirección de la salida' },
    'GiveItem': { target: 'ID del item', value: '' },
    'RemoveItem': { target: 'ID del item', value: '' },
    'StartDialogue': { target: 'ID del diálogo', value: '' }
  };
  const p = placeholders[select.value] || { target: 'ID', value: 'Valor' };
  targetInput.placeholder = p.target;
  valueInput.placeholder = p.value;
};

window.addAction = function() {
  const container = document.getElementById('actions-container');
  const count = container.querySelectorAll('.dynamic-array-item').length;
  container.insertAdjacentHTML('beforeend', renderActionRow({}, [], [], [], count));
};

window.fillActionFromDropdown = async function(btn) {
  const item = btn.closest('.dynamic-array-item');
  const type = item.querySelector('.action-type')?.value;
  const targetInput = item.querySelector('.action-target');

  let collection = '';
  if (type === 'MoveCharacter' || type === 'StartDialogue') collection = 'characters';
  else if (type === 'SetFlag') collection = 'flags';
  else if (type === 'UnlockExit' || type === 'GiveItem' || type === 'RemoveItem') collection = 'rooms';

  if (!collection) return;

  const { getAll: ga } = await import('../db.js');
  const docs = await ga(collection);

  let options = docs.map(d => `<option value="${d.id}">${d.name || d.id} (${d.id.slice(0, 8)})</option>`).join('');

  const modal = document.createElement('div');
  modal.innerHTML = `
    <select class="form-select" id="autocomplete-select" style="margin-bottom:12px;">
      <option value="">— Seleccionar —</option>
      ${options}
    </select>
    <p class="text-xs text-muted">Seleccioná un elemento para autocompletar el campo Target.</p>
  `;
  const selected = await new Promise(resolve => {
    const { showModal, closeModal } = await import('../ui.js');
    showModal('Autocompletar', modal.innerHTML, `
      <button class="btn btn-ghost" id="ac-cancel">Cancelar</button>
      <button class="btn btn-primary" id="ac-ok">Aplicar</button>
    `);
    document.getElementById('ac-ok').onclick = () => {
      const val = document.getElementById('autocomplete-select').value;
      closeModal();
      resolve(val);
    };
    document.getElementById('ac-cancel').onclick = () => {
      closeModal();
      resolve('');
    };
  });

  if (selected) targetInput.value = selected;
};
