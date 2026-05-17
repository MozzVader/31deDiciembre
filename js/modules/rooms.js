// ============================================
// Módulo: Habitaciones (Rooms) — con Hotspots
// ============================================
import { getAll, create, update, remove, getOne, getNodes } from '../db.js';
import { renderWorkspace, setBreadcrumbs, updateBadge, showToast, confirm, escapeHtml, createSelect, quickCreateBtn } from '../ui.js';

/** Generate a slug from a name: 'Bar Principal' → 'room_bar_principal' */
function generateSlug(prefix, name) {
  const base = name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${prefix}_${base}`;
}

/** createSelect with optional extra CSS class */
function sel(items, selected, placeholder, extraClass, filterable = false) {
  const html = createSelect(items, selected, placeholder, filterable);
  if (!extraClass) return html;
  // Add extra class to the <select> — works whether or not data-filterable is present
  return html.replace('<select class="form-select"', `<select class="form-select ${extraClass}"`);
}

/** Get current hotspot options from the form DOM */
function getRoomHotspotOptions() {
  const opts = [];
  const container = document.getElementById('hotspots-container');
  if (!container) return opts;
  container.querySelectorAll('.hotspot-card').forEach(card => {
    const slug = card.querySelector('.hotspot-slug')?.value.trim() || '';
    const name = card.querySelector('.hotspot-name')?.value.trim() || '';
    if (slug) opts.push({ id: slug, name: name || slug });
  });
  return opts;
}

let rooms = [];

// ============================================
// Room List
// ============================================

export async function renderRoomsList() {
  setBreadcrumbs([{ label: 'Habitaciones' }]);
  rooms = await getAll('rooms');
  updateBadge('rooms', rooms.length);

  if (rooms.length === 0) {
    renderWorkspace(`
      <div class="workspace-header">
        <div>
          <h1 class="workspace-title">Habitaciones</h1>
          <p class="workspace-subtitle">El espacio físico donde pasa la acción</p>
        </div>
        <button class="btn btn-primary" onclick="window.location.hash='rooms/new'">+ Nueva Habitación</button>
      </div>
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-house" style="font-size:48px;"></i></div>
        <div class="empty-state-title">No hay habitaciones todavía</div>
        <div class="empty-state-text">Creá la primera habitación de tu aventura. Cada habitación es un espacio donde el jugador puede explorar e interactuar con objetos de escena.</div>
        <button class="btn btn-primary" onclick="window.location.hash='rooms/new'">+ Crear Habitación</button>
      </div>
    `);
    return;
  }

  // Build a map of roomId → name for resolving exit targets
  const roomNameMap = {};
  rooms.forEach(r => { roomNameMap[r.id] = r.name; });

  const cards = rooms.map(room => {
    // Resolve exit target names
    const exitNames = (room.exits || [])
      .map(exit => {
        const dir = exit.direction ? `${exit.direction} → ` : '→ ';
        const dest = roomNameMap[exit.targetRoomId] || 'Destino eliminado';
        return `${dir}${dest}`;
      });
    const exitsHtml = exitNames.length
      ? exitNames.map(n => `<span class="card-badge">${escapeHtml(n)}</span>`).join('')
      : '<span style="color:var(--text-muted)">Sin salidas</span>';

    const hsCount = (room.hotspots || []).length;
    const hsHtml = hsCount > 0
      ? `<span class="card-badge"><i class="fa-solid fa-crosshairs" style="font-size:10px;margin-right:3px;"></i>${hsCount} hotspot${hsCount !== 1 ? 's' : ''}</span>`
      : '';

    return `
    <div class="card" onclick="window.location.hash='rooms/${room.id}'">
      <div class="card-thumb">
        ${room.imageUrl ? `<img src="${room.imageUrl}" alt="${escapeHtml(room.name)}">` : '<i class="fa-solid fa-house" style="font-size:28px;color:var(--text-muted);"></i>'}
      </div>
      <div class="card-title">${escapeHtml(room.name)}</div>
      <div class="card-description">${escapeHtml(room.description || 'Sin descripción')}</div>
      <div class="card-meta">
        ${exitsHtml}
        ${hsHtml}
      </div>
      <div class="card-actions" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-sm" onclick="window.location.hash='rooms/${room.id}'">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="window.deleteRoom('${room.id}', '${escapeHtml(room.name)}')">Eliminar</button>
      </div>
    </div>
  `;
  }).join('');

  renderWorkspace(`
    <div class="workspace-header">
      <div>
        <h1 class="workspace-title">Habitaciones</h1>
        <p class="workspace-subtitle">${rooms.length} habitación${rooms.length !== 1 ? 'es' : ''} en el proyecto</p>
      </div>
      <button class="btn btn-primary" onclick="window.location.hash='rooms/new'">+ Nueva Habitación</button>
    </div>
    <div class="card-grid">${cards}</div>
  `);
}

// ============================================
// Room Form
// ============================================

export async function renderRoomForm(roomId = null) {
  const isNew = !roomId;
  setBreadcrumbs([
    { label: 'Habitaciones', route: 'rooms' },
    { label: isNew ? 'Nueva Habitación' : 'Editar' }
  ]);

  let room = null;
  if (!isNew) {
    room = await getOne('rooms', roomId);
    if (!room) {
      showToast('Habitación no encontrada', 'error');
      window.location.hash = 'rooms';
      return;
    }
  }

  // Fetch data for all dropdowns
  const [allRooms, flags, items, dialogues] = await Promise.all([
    getAll('rooms'),
    getAll('flags'),
    getAll('items'),
    getAll('dialogues')
  ]);

  const otherRooms = allRooms.filter(r => r.id !== roomId);
  const exits = room?.exits || [];
  const hotspots = room?.hotspots || [];

  // Store on window for dynamic add functions
  window._currentRoomId = roomId;
  window._availableRooms = otherRooms;
  window._availableFlags = flags;
  window._roomFormData = { items, flags, dialogues };

  const exitsHtml = exits.map((exit, i) => renderExitRow(exit, otherRooms, flags, i)).join('');
  const hotspotsHtml = hotspots.map((hs, i) => renderHotspotCard(hs, i, { items, flags, dialogues })).join('');

  renderWorkspace(`
    <div class="detail-header">
      <button class="detail-back" onclick="window.location.hash='rooms'"><i class="fa-solid fa-arrow-left"></i> Volver</button>
      <h1 class="detail-title">${isNew ? 'Nueva Habitación' : escapeHtml(room.name)}</h1>
    </div>
    <div class="form-container" style="max-width:960px;">
      <form id="room-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nombre</label>
            <input type="text" class="form-input" id="room-name" placeholder="Ej: Bar Principal" value="${escapeHtml(room?.name || '')}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Slug</label>
            <input type="text" class="form-input font-mono" id="room-slug" placeholder="Ej: room_bar" value="${escapeHtml(room?.slug || '')}">
            <div class="form-hint">Se auto-genera del nombre. Podés editarlo manualmente.</div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Descripción (para el dev)</label>
          <textarea class="form-textarea" id="room-description" placeholder="Describe esta habitación. No es lo que ve el jugador, es para que el dev sepa qué hay acá.">${escapeHtml(room?.description || '')}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Imagen</label>
          <div class="image-upload" id="room-image-upload">
            <input type="file" accept="image/*" id="room-image-file" onchange="window.handleRoomImage(event)">
            ${room?.imageUrl
              ? `<img src="${room.imageUrl}" class="image-preview" id="room-image-preview">`
              : `<div class="image-upload-icon"><i class="fa-solid fa-camera"></i></div>
                 <div class="image-upload-text">Subir imagen desde archivo</div>
                 <div class="image-upload-hint">JPG, PNG o GIF</div>`
            }
          </div>
          <div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
            <span class="text-xs text-muted">O cargala desde URL:</span>
            <input type="text" class="form-input" id="room-image-url-input" placeholder="https://ejemplo.com/imagen.jpg" value="${room?.imageUrl && !room.imageUrl.startsWith('data:') ? escapeHtml(room.imageUrl) : ''}" style="flex:1;padding:6px 10px;font-size:12px;">
            <button type="button" class="btn btn-ghost btn-sm" onclick="window.applyRoomImageUrl()">Aplicar</button>
            ${room?.imageUrl ? `<button type="button" class="btn btn-ghost btn-sm" onclick="window.clearRoomImage()" style="color:var(--danger);border-color:transparent;">Quitar</button>` : ''}
          </div>
          <input type="hidden" id="room-image-url" value="${room?.imageUrl || ''}">
        </div>

        <!-- Salidas (Exits) -->
        <div class="form-group">
          <label class="form-label">Salidas</label>
          <div class="form-hint">Definí cómo el jugador puede salir de esta habitación hacia otras.</div>
          <div class="dynamic-array" id="exits-container">
            ${exitsHtml}
          </div>
          <button type="button" class="dynamic-array-add mt-2" onclick="window.addExit()">
            + Agregar Salida
          </button>
        </div>

        <!-- ========== HOTSPOTS (Objetos de Escena) ========== -->
        <hr class="form-section-divider">
        <div class="form-group">
          <label class="form-label">
            <i class="fa-solid fa-crosshairs" style="color:var(--warning);margin-right:6px;"></i>
            Objetos de Escena (Hotspots)
          </label>
          <div class="form-hint">Los objetos interactivos dibujados en el fondo de la habitación. Cada uno puede tener múltiples interacciones: examinar, usar un item, recoger, hablar. El puente entre hotspot e item: si Diego agarra un vaso de la mesa, el hotspot cambia de estado y se agrega el item al inventario.</div>
          <div id="hotspots-container" class="hotspot-section">
            ${hotspotsHtml}
          </div>
          <button type="button" class="dynamic-array-add mt-2" onclick="window.addHotspot()">
            + Añadir Objeto de Escena
          </button>
        </div>

        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary btn-lg">${isNew ? 'Crear Habitación' : 'Guardar Cambios'}</button>
          ${!isNew ? `<button type="button" class="btn btn-danger" id="btn-delete-room">Eliminar Habitación</button>` : ''}
        </div>
      </form>
    </div>
  `);

  // Auto-generate room slug from name
  const slugInput = document.getElementById('room-slug');
  const nameInput = document.getElementById('room-name');
  nameInput.addEventListener('input', () => {
    if (!slugInput.dataset.manual) {
      slugInput.value = generateSlug('room', nameInput.value);
    }
  });
  slugInput.addEventListener('input', () => {
    slugInput.dataset.manual = '1';
  });

  // Attach hotspot name → slug auto-generation
  attachHotspotListeners();

  // Load dialogue nodes for StartDialogue actions that already have a dialogue selected
  document.querySelectorAll('.hs-action-card').forEach(async (actionCard) => {
    const type = actionCard.querySelector('.hs-action-type')?.value;
    if (type === 'StartDialogue') {
      const dlgSlug = actionCard.querySelector('.hs-action-target')?.value;
      const savedNode = actionCard.querySelector('.hs-action-node')?.dataset.savedNode || '';
      // Attach onchange listener for future changes
      actionCard.querySelector('.hs-action-target')?.addEventListener('change', function() {
        window.loadHsDialogueNodes(actionCard, this.value);
      });
      // Load existing nodes (with saved selection)
      if (dlgSlug) {
        await window.loadHsDialogueNodes(actionCard, dlgSlug, savedNode);
      }
    }
  });

  // Form submission
  document.getElementById('room-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
      slug: document.getElementById('room-slug').value.trim(),
      name: document.getElementById('room-name').value.trim(),
      description: document.getElementById('room-description').value.trim(),
      imageUrl: document.getElementById('room-image-url').value,
      exits: collectExits(),
      hotspots: collectHotspots()
    };

    if (!data.slug) data.slug = generateSlug('room', data.name);
    if (!data.name) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }

    try {
      if (isNew) {
        await create('rooms', data);
        showToast('Habitación creada', 'success');
      } else {
        await update('rooms', roomId, data);
        showToast('Habitación actualizada', 'success');
      }
      window.location.hash = 'rooms';
    } catch (err) {
      console.error(err);
      showToast('Error al guardar: ' + err.message, 'error');
    }
  };

  // Delete
  if (!isNew) {
    document.getElementById('btn-delete-room').onclick = async () => {
      const ok = await confirm(`¿Eliminás "${room.name}"? Esta acción no se puede deshacer.`);
      if (ok) {
        await remove('rooms', roomId);
        showToast('Habitación eliminada', 'success');
        window.location.hash = 'rooms';
      }
    };
  }
}

// ============================================
// Hotspot Card — Collapsible
// ============================================

function renderHotspotCard(hotspot, index, data) {
  const interactions = (hotspot.interactions || [])
    .map((int, i) => renderInteractionRow(int, i, data)).join('');
  const itemOpts = data.items.map(i => ({ id: i.slug || i.id, name: i.name }));

  return `
    <div class="hotspot-card collapsed" data-hotspot-index="${index}">
      <div class="hotspot-card-header" onclick="this.closest('.hotspot-card').classList.toggle('collapsed')">
        <div class="hotspot-card-header-left">
          <i class="fa-solid fa-crosshairs hotspot-icon"></i>
          <span class="hotspot-card-title">${escapeHtml(hotspot.name) || `Hotspot #${index + 1}`}</span>
          <span class="hotspot-slug-label font-mono text-xs text-muted">${escapeHtml(hotspot.slug || '')}</span>
        </div>
        <div class="hotspot-card-header-right">
          <button type="button" class="dynamic-array-remove" onclick="event.stopPropagation(); this.closest('.hotspot-card').remove()">&times;</button>
          <i class="fa-solid fa-chevron-down hotspot-chevron"></i>
        </div>
      </div>
      <div class="hotspot-card-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nombre</label>
            <input type="text" class="form-input hotspot-name" placeholder="Ej: Cubetera vacía" value="${escapeHtml(hotspot.name || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Slug</label>
            <input type="text" class="form-input font-mono hotspot-slug" placeholder="Ej: hotspot_cubetera" value="${escapeHtml(hotspot.slug || '')}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Descripción (para el dev)</label>
          <textarea class="form-textarea hotspot-description" rows="2" placeholder="Una vieja cubetera de metal. Está vacía y con manchas de condensación.">${escapeHtml(hotspot.description || '')}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Item Conectado (opcional)</label>
          <div class="quick-create-wrap">
            ${sel(itemOpts, hotspot.connectedItemSlug || '', '— Ninguno —', 'hotspot-connected-item', true)}
            ${quickCreateBtn('item')}
          </div>
          <div class="form-hint">Si al interactuar con este hotspot se agrega un item al inventario, conectalo acá. Te ayuda a mantener la traza: "este hotspot de la mesa está conectado al item Vaso de mi base de datos".</div>
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Interacciones</label>
          <div class="form-hint">Definí qué puede hacer el jugador con este objeto de escena.</div>
          <div class="dynamic-array hotspot-interactions-container">
            ${interactions}
          </div>
          <button type="button" class="dynamic-array-add mt-2" onclick="window.addHotspotInteraction(this.closest('.hotspot-card'))">
            + Añadir Interacción
          </button>
        </div>
      </div>
    </div>
  `;
}

// ============================================
// Interaction Row
// ============================================

const INTERACTION_TYPE_LABELS = {
  examine: 'Examinar (Mirar)',
  use: 'Usar',
  open: 'Abrir',
  close: 'Cerrar',
  use_item: 'Usar Item sobre esto',
  pick_up: 'Recoger (Pick Up)',
  talk_to: 'Hablar con'
};

function renderInteractionRow(interaction, index, data) {
  const type = interaction.type || 'examine';
  const actions = (interaction.actions || [])
    .map((act, i) => renderHotspotActionRow(act, i, data)).join('');
  const itemOpts = data.items.map(i => ({ id: i.slug || i.id, name: i.name }));
  const flagOpts = data.flags.map(f => ({ id: f.name, name: f.name }));

  return `
    <div class="interaction-card" data-interaction-index="${index}">
      <div class="interaction-card-header">
        <div class="interaction-card-header-left">
          <i class="fa-solid fa-hand-pointer"></i>
          <span class="interaction-title">Interacción #${index + 1} — ${INTERACTION_TYPE_LABELS[type] || type}</span>
        </div>
        <button type="button" class="dynamic-array-remove" onclick="this.closest('.interaction-card').remove()">&times;</button>
      </div>
      <div class="interaction-card-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tipo de Interacción</label>
            <select class="form-select interaction-type" onchange="window.handleInteractionTypeChange(this)">
              <option value="examine" ${type === 'examine' ? 'selected' : ''}>Examinar (Mirar)</option>
              <option value="use" ${type === 'use' ? 'selected' : ''}>Usar</option>
              <option value="open" ${type === 'open' ? 'selected' : ''}>Abrir</option>
              <option value="close" ${type === 'close' ? 'selected' : ''}>Cerrar</option>
              <option value="use_item" ${type === 'use_item' ? 'selected' : ''}>Usar Item sobre esto</option>
              <option value="pick_up" ${type === 'pick_up' ? 'selected' : ''}>Recoger (Pick Up)</option>
              <option value="talk_to" ${type === 'talk_to' ? 'selected' : ''}>Hablar con</option>
            </select>
          </div>
          <div class="form-group interaction-required-item-wrap" style="${type !== 'use_item' ? 'display:none' : ''}">
            <label class="form-label">Item Requerido</label>
            <div class="quick-create-wrap">
              ${sel(itemOpts, interaction.requiredItemSlug || '', '— Seleccionar item —', 'interaction-required-item', true)}
              ${quickCreateBtn('item')}
            </div>
            <div class="form-hint">El item del inventario que el jugador necesita usar sobre este hotspot.</div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Condición (Flag)</label>
          <div class="quick-create-wrap">
            ${sel(flagOpts, interaction.conditionSlug || '', '— Sin condición (siempre accesible) —', 'interaction-condition', true)}
            ${quickCreateBtn('flag')}
          </div>
          <div class="form-hint">La interacción solo está disponible si este flag está activo.</div>
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Acciones (Resultados)</label>
          <div class="dynamic-array interaction-actions-container">
            ${actions}
          </div>
          <button type="button" class="dynamic-array-add mt-2" onclick="window.addHotspotAction(this.closest('.interaction-card'))">
            + Añadir Acción
          </button>
        </div>
      </div>
    </div>
  `;
}

// ============================================
// Hotspot Action Row
// ============================================

const HS_ACTION_LABELS = {
  StartDialogue: 'Iniciar Diálogo',
  AddItem: 'Agregar Item al Inventario',
  RemoveItem: 'Quitar Item del Inventario',
  SetFlag: 'Cambiar Flag',
  ChangeHotspotState: 'Cambiar Estado del Hotspot'
};

function renderHotspotActionRow(action, index, data) {
  const type = action.type || 'StartDialogue';

  // Resolve target and value based on action type
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
    case 'ChangeHotspotState':
      targetVal = action.hotspotSlug || '';
      valueVal = action.newState || '';
      break;
  }

  const { targetHtml, valueHtml } = hsActionFieldsHtml(type, data, targetVal, valueVal);

  return `
    <div class="hs-action-card" data-hs-action-index="${index}">
      <div class="hs-action-card-header">
        <span class="hs-action-title">${HS_ACTION_LABELS[type] || type}</span>
        <button type="button" class="dynamic-array-remove" onclick="this.closest('.hs-action-card').remove()">&times;</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Tipo de Acción</label>
          <select class="form-select hs-action-type" onchange="window.handleHsActionTypeChange(this)">
            <option value="StartDialogue" ${type === 'StartDialogue' ? 'selected' : ''}>Iniciar Diálogo</option>
            <option value="AddItem" ${type === 'AddItem' ? 'selected' : ''}>Agregar Item</option>
            <option value="RemoveItem" ${type === 'RemoveItem' ? 'selected' : ''}>Quitar Item</option>
            <option value="SetFlag" ${type === 'SetFlag' ? 'selected' : ''}>Cambiar Flag</option>
            <option value="ChangeHotspotState" ${type === 'ChangeHotspotState' ? 'selected' : ''}>Cambiar Estado Hotspot</option>
          </select>
        </div>
        <div class="form-group hs-action-target-wrap">
          ${targetHtml}
        </div>
        <div class="form-group hs-action-value-wrap" ${!valueHtml ? 'style="display:none"' : ''}>
          ${valueHtml}
        </div>
      </div>
    </div>
  `;
}

/** Build target + value HTML for a hotspot action based on its type */
function hsActionFieldsHtml(type, data, targetVal, valueVal) {
  let targetHtml = '';
  let valueHtml = '';

  switch (type) {
    case 'StartDialogue': {
      const dlgOpts = data.dialogues.map(d => ({ id: d.slug || d.id, name: d.name }));
      targetHtml = `<label class="form-label">Diálogo</label>
        <div class="quick-create-wrap">
          ${sel(dlgOpts, targetVal, '— Seleccionar diálogo —', 'hs-action-target', true)}
          ${quickCreateBtn('dialogue')}
        </div>
        <div class="form-hint">Al seleccionar un diálogo se cargan sus nodos abajo.</div>`;
      valueHtml = `<label class="form-label">Nodo Inicial (opcional)</label>
        <div class="quick-create-wrap">
          <select class="form-select hs-action-node" data-saved-node="${escapeHtml(valueVal || '')}" data-filterable><option value="">— (arranca desde el primer nodo) —</option></select>
          ${quickCreateBtn('node')}
        </div>
        <div class="form-hint">Dejá vacío para arrancar desde el primer nodo.</div>`;
      break;
    }
    case 'AddItem':
    case 'RemoveItem': {
      const itemOpts = data.items.map(i => ({ id: i.slug || i.id, name: i.name }));
      targetHtml = `<label class="form-label">Item</label>
        <div class="quick-create-wrap">
          ${sel(itemOpts, targetVal, '— Seleccionar item —', 'hs-action-target', true)}
          ${quickCreateBtn('item')}
        </div>`;
      break;
    }
    case 'SetFlag': {
      const flagOpts = data.flags.map(f => ({ id: f.name, name: f.name }));
      targetHtml = `<label class="form-label">Flag</label>
        <div class="quick-create-wrap">
          ${sel(flagOpts, targetVal, '— Seleccionar flag —', 'hs-action-target', true)}
          ${quickCreateBtn('flag')}
        </div>`;
      valueHtml = `<label class="form-label">Valor</label>
        <select class="form-select hs-action-value">
          <option value="true" ${valueVal === 'true' ? 'selected' : ''}>true</option>
          <option value="false" ${valueVal === 'false' ? 'selected' : ''}>false</option>
        </select>`;
      break;
    }
    case 'ChangeHotspotState': {
      const hsOpts = getRoomHotspotOptions();
      targetHtml = `<label class="form-label">Hotspot</label>
        ${sel(hsOpts, targetVal, '— Seleccionar hotspot —', 'hs-action-target')}`;
      valueHtml = `<label class="form-label">Nuevo Estado</label>
        <input type="text" class="form-input hs-action-value" placeholder="Ej: llena, abierta, rota" value="${escapeHtml(valueVal || '')}">
        <div class="form-hint">El estado que va a tomar el hotspot. El motor lo usa para cambiar el gráfico o la descripción.</div>`;
      break;
    }
  }

  return { targetHtml, valueHtml };
}

// ============================================
// Collection Functions
// ============================================

function collectExits() {
  const container = document.getElementById('exits-container');
  const items = container.querySelectorAll('.dynamic-array-item');
  const exits = [];
  items.forEach(item => {
    const direction = item.querySelector('.exit-direction')?.value.trim() || '';
    const selects = item.querySelectorAll('.form-select');
    const targetRoomId = selects[0]?.value || '';
    const conditionFlag = selects[1]?.value || '';
    if (direction) {
      exits.push({ direction, targetRoomId, conditionFlag });
    }
  });
  return exits;
}

function collectHotspots() {
  const container = document.getElementById('hotspots-container');
  if (!container) return [];
  const cards = container.querySelectorAll('.hotspot-card');
  const hotspots = [];

  cards.forEach(card => {
    const name = card.querySelector('.hotspot-name')?.value.trim() || '';
    if (!name) return;

    const slug = card.querySelector('.hotspot-slug')?.value.trim() || '';
    const description = card.querySelector('.hotspot-description')?.value.trim() || '';
    const connectedItemSlug = card.querySelector('.hotspot-connected-item')?.value || '';
    const interactions = collectInteractions(card);

    hotspots.push({
      slug: slug || generateSlug('hotspot', name),
      name,
      description,
      connectedItemSlug: connectedItemSlug || null,
      interactions
    });
  });

  return hotspots;
}

function collectInteractions(hotspotCard) {
  const container = hotspotCard.querySelector('.hotspot-interactions-container');
  if (!container) return [];
  const cards = container.querySelectorAll('.interaction-card');
  const interactions = [];

  cards.forEach(card => {
    const type = card.querySelector('.interaction-type')?.value || '';
    const requiredItemSlug = card.querySelector('.interaction-required-item')?.value || '';
    const conditionSlug = card.querySelector('.interaction-condition')?.value || '';
    const actions = collectHsActions(card);

    interactions.push({
      type,
      requiredItemSlug: type === 'use_item' ? (requiredItemSlug || null) : null,
      conditionSlug: conditionSlug || null,
      actions
    });
  });

  return interactions;
}

function collectHsActions(interactionCard) {
  const container = interactionCard.querySelector('.interaction-actions-container');
  if (!container) return [];
  const cards = container.querySelectorAll('.hs-action-card');
  const actions = [];

  cards.forEach(card => {
    const type = card.querySelector('.hs-action-type')?.value || '';
    const target = card.querySelector('.hs-action-target')?.value?.trim() || '';
    const value = card.querySelector('.hs-action-value')?.value?.trim() || '';
    if (!type) return;

    const action = { type };

    switch (type) {
      case 'StartDialogue':
        action.dialogueSlug = target || null;
        action.nodeSlug = card.querySelector('.hs-action-node')?.value?.trim() || null;
        break;
      case 'AddItem':
      case 'RemoveItem':
        action.itemSlug = target || null;
        break;
      case 'SetFlag':
        action.flagSlug = target || null;
        action.value = value === 'true' ? true : (value === 'false' ? false : value);
        break;
      case 'ChangeHotspotState':
        action.hotspotSlug = target || null;
        action.newState = value || null;
        break;
    }

    actions.push(action);
  });

  return actions;
}

// ============================================
// Window Functions — Dynamic Add
// ============================================

window.addExit = async function() {
  const container = document.getElementById('exits-container');
  if (!container) return;

  const count = container.querySelectorAll('.dynamic-array-item').length;

  let roomsList = window._availableRooms || [];
  let flagsList = window._availableFlags || [];

  if (roomsList.length === 0) {
    try {
      const [allRooms, allFlags] = await Promise.all([
        getAll('rooms'),
        getAll('flags')
      ]);
      roomsList = allRooms.filter(r => r.id !== window._currentRoomId);
      flagsList = allFlags;
      window._availableRooms = roomsList;
      window._availableFlags = flagsList;
    } catch (err) {
      console.error('Error fetching rooms/flags:', err);
    }
  }

  const html = `
    <div class="dynamic-array-item" data-exit-index="${count}">
      <div class="dynamic-array-item-header">
        <span class="dynamic-array-item-title">Salida #${count + 1}</span>
        <button type="button" class="dynamic-array-remove" onclick="this.closest('.dynamic-array-item').remove()">&times;</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Dirección / Nombre</label>
          <input type="text" class="form-input exit-direction" placeholder='Ej: "Puerta Amarilla"'>
        </div>
        <div class="form-group">
          <label class="form-label">Habitación Destino</label>
          ${createSelect(roomsList, '', '— Seleccionar destino —')}
        </div>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Condición (Flag)</label>
        ${createSelect(flagsList, '', '— Sin condición (siempre accesible) —')}
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
};

window.addHotspot = function() {
  const container = document.getElementById('hotspots-container');
  if (!container) return;

  const count = container.querySelectorAll('.hotspot-card').length;
  const data = window._roomFormData || {};

  const html = renderHotspotCard({}, count, data);
  container.insertAdjacentHTML('beforeend', html);

  // Attach name → slug auto-generation to the new card
  const newCard = container.querySelector(`.hotspot-card[data-hotspot-index="${count}"]`);
  if (newCard) attachSingleHotspotListeners(newCard, count);
};

window.addHotspotInteraction = function(hotspotCard) {
  const container = hotspotCard.querySelector('.hotspot-interactions-container');
  if (!container) return;

  const count = container.querySelectorAll('.interaction-card').length;
  const data = window._roomFormData || {};

  const html = renderInteractionRow({}, count, data);
  container.insertAdjacentHTML('beforeend', html);
};

window.addHotspotAction = function(interactionCard) {
  const container = interactionCard.querySelector('.interaction-actions-container');
  if (!container) return;

  const count = container.querySelectorAll('.hs-action-card').length;
  const data = window._roomFormData || {};

  const html = renderHotspotActionRow({}, count, data);
  container.insertAdjacentHTML('beforeend', html);

  // Attach dialogue node loading for new StartDialogue actions
  const newCard = container.querySelector(`.hs-action-card[data-hs-action-index="${count}"]`);
  if (newCard) {
    const type = newCard.querySelector('.hs-action-type')?.value;
    if (type === 'StartDialogue') {
      newCard.querySelector('.hs-action-target')?.addEventListener('change', function() {
        window.loadHsDialogueNodes(newCard, this.value);
      });
    }
  }
};

// ============================================
// Type Change Handlers
// ============================================

window.handleInteractionTypeChange = function(select) {
  const card = select.closest('.interaction-card');
  const wrap = card.querySelector('.interaction-required-item-wrap');
  const labelSpan = card.querySelector('.interaction-title');

  if (select.value === 'use_item') {
    wrap.style.display = '';
  } else {
    wrap.style.display = 'none';
  }

  // Update the interaction title label
  if (labelSpan) {
    const idx = card.dataset.interactionIndex;
    const num = parseInt(idx) + 1;
    labelSpan.textContent = `Interacción #${num} — ${INTERACTION_TYPE_LABELS[select.value] || select.value}`;
  }
};

window.handleHsActionTypeChange = function(select) {
  const card = select.closest('.hs-action-card');
  const type = select.value;
  const data = window._roomFormData || {};

  const { targetHtml, valueHtml } = hsActionFieldsHtml(type, data, '', '');

  // Update target and value fields
  card.querySelector('.hs-action-target-wrap').innerHTML = targetHtml;
  const valueWrap = card.querySelector('.hs-action-value-wrap');
  valueWrap.innerHTML = valueHtml;
  valueWrap.style.display = valueHtml ? '' : 'none';

  // Update the action title label
  const titleSpan = card.querySelector('.hs-action-title');
  if (titleSpan) titleSpan.textContent = HS_ACTION_LABELS[type] || type;

  // Attach onchange to dialogue target to load nodes
  if (type === 'StartDialogue') {
    const targetSelect = card.querySelector('.hs-action-target');
    if (targetSelect) {
      targetSelect.onchange = () => window.loadHsDialogueNodes(card, targetSelect.value);
    }
  }
};

// ============================================
// Load Dialogue Nodes (for StartDialogue in hotspots)
// ============================================

window.loadHsDialogueNodes = async function(actionCard, dialogueSlug, selectedNodeSlug = '') {
  const nodeSelect = actionCard.querySelector('.hs-action-node');
  if (!nodeSelect) return;

  // Reset
  nodeSelect.innerHTML = '<option value="">— (arranca desde el primer nodo) —</option>';

  if (!dialogueSlug) return;

  const data = window._roomFormData || {};
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
// Hotspot Listeners — name → slug auto-gen
// ============================================

function attachHotspotListeners() {
  const container = document.getElementById('hotspots-container');
  if (!container) return;
  container.querySelectorAll('.hotspot-card').forEach((card, i) => {
    attachSingleHotspotListeners(card, i);
  });
}

function attachSingleHotspotListeners(card, index) {
  const nameInput = card.querySelector('.hotspot-name');
  const slugInput = card.querySelector('.hotspot-slug');
  const titleSpan = card.querySelector('.hotspot-card-title');
  const slugLabel = card.querySelector('.hotspot-slug-label');

  if (nameInput && slugInput) {
    nameInput.addEventListener('input', () => {
      if (!slugInput.dataset.manual) {
        slugInput.value = generateSlug('hotspot', nameInput.value);
      }
      if (titleSpan) titleSpan.textContent = nameInput.value || `Hotspot #${index + 1}`;
      if (slugLabel) slugLabel.textContent = slugInput.value;
    });
    slugInput.addEventListener('input', () => {
      slugInput.dataset.manual = '1';
      if (slugLabel) slugLabel.textContent = slugInput.value;
    });
  }
}

// ============================================
// Exit Row Render
// ============================================

function renderExitRow(exit = {}, rooms = [], flags = [], index = 0) {
  const targetRoom = rooms.find(r => r.id === exit.targetRoomId);
  const targetName = targetRoom ? targetRoom.name : '';
  const titleText = targetName
    ? `Salida #${index + 1} → ${targetName}`
    : `Salida #${index + 1}`;

  return `
    <div class="dynamic-array-item" data-exit-index="${index}">
      <div class="dynamic-array-item-header">
        <span class="dynamic-array-item-title">${escapeHtml(titleText)}</span>
        <button type="button" class="dynamic-array-remove" onclick="this.closest('.dynamic-array-item').remove()">&times;</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Dirección / Nombre</label>
          <input type="text" class="form-input exit-direction" placeholder='Ej: "Puerta Amarilla"' value="${escapeHtml(exit.direction || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Habitación Destino</label>
          ${createSelect(rooms, exit.targetRoomId || '', '— Seleccionar destino —')}
        </div>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Condición (Flag)</label>
        ${createSelect(flags, exit.conditionFlag || '', '— Sin condición (siempre accesible) —')}
      </div>
    </div>
  `;
}

// ============================================
// Image Handling
// ============================================

window.handleRoomImage = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('room-image-url').value = e.target.result;
    document.getElementById('room-image-url-input').value = '';
    const uploadDiv = document.getElementById('room-image-upload');
    const existingImg = document.getElementById('room-image-preview');
    if (existingImg) {
      existingImg.src = e.target.result;
    } else {
      const img = document.createElement('img');
      img.src = e.target.result;
      img.className = 'image-preview';
      img.id = 'room-image-preview';
      uploadDiv.querySelector('.image-upload-icon')?.remove();
      uploadDiv.querySelector('.image-upload-text')?.remove();
      uploadDiv.querySelector('.image-upload-hint')?.remove();
      uploadDiv.insertBefore(img, uploadDiv.firstChild);
    }
  };
  reader.readAsDataURL(file);
};

window.applyRoomImageUrl = function() {
  const url = document.getElementById('room-image-url-input')?.value.trim();
  if (!url) {
    showToast('Escribí una URL primero', 'error');
    return;
  }
  document.getElementById('room-image-url').value = url;
  const uploadDiv = document.getElementById('room-image-upload');
  const existingImg = document.getElementById('room-image-preview');
  if (existingImg) {
    existingImg.src = url;
  } else {
    const img = document.createElement('img');
    img.src = url;
    img.className = 'image-preview';
    img.id = 'room-image-preview';
    img.onerror = () => {
      showToast('No se pudo cargar la imagen desde esa URL', 'error');
      img.remove();
    };
    uploadDiv.querySelector('.image-upload-icon')?.remove();
    uploadDiv.querySelector('.image-upload-text')?.remove();
    uploadDiv.querySelector('.image-upload-hint')?.remove();
    uploadDiv.insertBefore(img, uploadDiv.firstChild);
  }
  showToast('Imagen aplicada', 'success');
};

window.clearRoomImage = function() {
  document.getElementById('room-image-url').value = '';
  document.getElementById('room-image-url-input').value = '';
  const img = document.getElementById('room-image-preview');
  if (img) img.remove();
  const uploadDiv = document.getElementById('room-image-upload');
  if (uploadDiv && !uploadDiv.querySelector('.image-upload-icon')) {
    uploadDiv.insertAdjacentHTML('afterbegin', `
      <div class="image-upload-icon"><i class="fa-solid fa-camera"></i></div>
      <div class="image-upload-text">Subir imagen desde archivo</div>
      <div class="image-upload-hint">JPG, PNG o GIF</div>
    `);
  }
};

// ============================================
// Delete from list view
// ============================================

window.deleteRoom = async function(roomId, name) {
  const ok = await confirm(`¿Eliminás "${name}"? Esta acción no se puede deshacer.`);
  if (ok) {
    await remove('rooms', roomId);
    showToast('Habitación eliminada', 'success');
    renderRoomsList();
  }
};
