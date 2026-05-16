// ============================================
// Módulo: Habitaciones (Rooms)
// ============================================
import { getAll, create, update, remove, getOne } from '../db.js';
import { renderWorkspace, setBreadcrumbs, updateBadge, showToast, confirm, escapeHtml, createSelect } from '../ui.js';

/** Generate a slug from a name: 'Bar Principal' → 'room_bar_principal' */
function generateSlug(prefix, name) {
  const base = name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${prefix}_${base}`;
}

let rooms = [];

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
        <div class="empty-state-text">Creá la primera habitación de tu aventura. Cada habitación es un espacio donde el jugador puede explorar e interactuar.</div>
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

    return `
    <div class="card" onclick="window.location.hash='rooms/${room.id}'">
      <div class="card-thumb">
        ${room.imageUrl ? `<img src="${room.imageUrl}" alt="${escapeHtml(room.name)}">` : '<i class="fa-solid fa-house" style="font-size:28px;color:var(--text-muted);"></i>'}
      </div>
      <div class="card-title">${escapeHtml(room.name)}</div>
      <div class="card-description">${escapeHtml(room.description || 'Sin descripción')}</div>
      <div class="card-meta">
        ${exitsHtml}
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

  // Get other rooms for exit targets
  const allRooms = await getAll('rooms');
  const otherRooms = allRooms.filter(r => r.id !== roomId);

  // Get flags for exit conditions
  const flags = await getAll('flags');
  const exits = room?.exits || [];

  // Store current room ID and available data on window for addExit()
  window._currentRoomId = roomId;
  window._availableRooms = otherRooms;
  window._availableFlags = flags;

  const exitsHtml = exits.map((exit, i) => renderExitRow(exit, otherRooms, flags, i)).join('');

  renderWorkspace(`
    <div class="detail-header">
      <button class="detail-back" onclick="window.location.hash='rooms'"><i class="fa-solid fa-arrow-left"></i> Volver</button>
      <h1 class="detail-title">${isNew ? 'Nueva Habitación' : escapeHtml(room.name)}</h1>
    </div>
    <div class="form-container">
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

        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary btn-lg">${isNew ? 'Crear Habitación' : 'Guardar Cambios'}</button>
          ${!isNew ? `<button type="button" class="btn btn-danger" id="btn-delete-room">Eliminar Habitación</button>` : ''}
        </div>
      </form>
    </div>
  `);

  // Auto-generate slug from name
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

  // Form submission
  document.getElementById('room-form').onsubmit = async (e) => {
    e.preventDefault();
    const exits = collectExits();
    const data = {
      slug: document.getElementById('room-slug').value.trim(),
      name: document.getElementById('room-name').value.trim(),
      description: document.getElementById('room-description').value.trim(),
      imageUrl: document.getElementById('room-image-url').value,
      exits
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

function renderExitRow(exit = {}, rooms = [], flags = [], index = 0) {
  // Resolve target room name for the title
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
// Add Exit — fetches fresh data from DB
// ============================================

window.addExit = async function() {
  const container = document.getElementById('exits-container');
  if (!container) return;

  const count = container.querySelectorAll('.dynamic-array-item').length;

  // Try to get rooms/flags from the cached window data
  // If empty (first exit on a new room), fetch fresh from DB
  let roomsList = window._availableRooms || [];
  let flagsList = window._availableFlags || [];

  if (roomsList.length === 0) {
    try {
      const [allRooms, allFlags] = await Promise.all([
        getAll('rooms'),
        getAll('flags')
      ]);
      // Exclude current room
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
