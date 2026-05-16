// ============================================
// Módulo: Habitaciones (Rooms)
// ============================================
import { getAll, create, update, remove, getOne, generateId } from '../db.js';
import { renderWorkspace, setBreadcrumbs, updateBadge, showToast, confirm, escapeHtml, createSelect } from '../ui.js';

let rooms = [];
let characters = [];

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
        <div class="empty-state-icon">&#127968;</div>
        <div class="empty-state-title">No hay habitaciones todavía</div>
        <div class="empty-state-text">Creá la primera habitación de tu aventura. Cada habitación es un espacio donde el jugador puede explorar e interactuar.</div>
        <button class="btn btn-primary" onclick="window.location.hash='rooms/new'">+ Crear Habitación</button>
      </div>
    `);
    return;
  }

  const cards = rooms.map(room => `
    <div class="card" onclick="window.location.hash='rooms/${room.id}'">
      <div class="card-thumb">
        ${room.imageUrl ? `<img src="${room.imageUrl}" alt="${escapeHtml(room.name)}">` : '&#127968;'}
      </div>
      <div class="card-title">${escapeHtml(room.name)}</div>
      <div class="card-description">${escapeHtml(room.description || 'Sin descripción')}</div>
      <div class="card-meta">
        ${room.exits ? `<span class="card-badge">${room.exits.length} salida${room.exits.length !== 1 ? 's' : ''}</span>` : ''}
        <span>${room.id.slice(0, 8)}...</span>
      </div>
    </div>
  `).join('');

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

  const exitsHtml = exits.map((exit, i) => renderExitRow(exit, otherRooms, flags, i)).join('');

  renderWorkspace(`
    <div class="detail-header">
      <button class="detail-back" onclick="window.location.hash='rooms'">&#9664; Volver</button>
      <h1 class="detail-title">${isNew ? 'Nueva Habitación' : escapeHtml(room.name)}</h1>
    </div>
    <div class="form-container">
      <form id="room-form">
        <div class="form-group">
          <label class="form-label">Nombre</label>
          <input type="text" class="form-input" id="room-name" placeholder="Ej: Bar Principal" value="${escapeHtml(room?.name || '')}" required>
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
              : `<div class="image-upload-icon">&#128247;</div>
                 <div class="image-upload-text">Arrastrá o hacé click para subir una imagen</div>
                 <div class="image-upload-hint">JPG, PNG o GIF — Se sube a Firebase Storage</div>`
            }
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
          ${!isNew ? `<button type="button" class="btn btn-danger" id="btn-delete-room">Eliminar</button>` : ''}
        </div>
      </form>
    </div>
  `);

  // Form submission
  document.getElementById('room-form').onsubmit = async (e) => {
    e.preventDefault();
    const exits = collectExits();
    const data = {
      name: document.getElementById('room-name').value.trim(),
      description: document.getElementById('room-description').value.trim(),
      imageUrl: document.getElementById('room-image-url').value,
      exits
    };

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
  return `
    <div class="dynamic-array-item" data-exit-index="${index}">
      <div class="dynamic-array-item-header">
        <span class="dynamic-array-item-title">Salida #${index + 1}</span>
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

// Expose functions to global scope for inline event handlers
window.handleRoomImage = async function(event) {
  const file = event.target.files[0];
  if (!file) return;

  // For now, we convert to data URL since Storage needs additional setup
  // In production, upload to Firebase Storage
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('room-image-url').value = e.target.result;
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

window.addExit = function() {
  const container = document.getElementById('exits-container');
  const count = container.querySelectorAll('.dynamic-array-item').length;
  // We need to re-render with updated rooms/flags, so let's call a function
  // For simplicity, we clone the last exit's select options
  const lastItem = container.querySelector('.dynamic-array-item:last-child');
  const roomSelect = lastItem?.querySelectorAll('.form-select')[0]?.innerHTML || '';
  const flagSelect = lastItem?.querySelectorAll('.form-select')[1]?.innerHTML || '';

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
          <select class="form-select">${roomSelect}</select>
        </div>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Condición (Flag)</label>
        <select class="form-select">${flagSelect}</select>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
};
