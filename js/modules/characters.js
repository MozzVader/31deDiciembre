// ============================================
// Módulo: Personajes (Characters)
// ============================================
import { getAll, create, update, remove, getOne } from '../db.js';
import { renderWorkspace, setBreadcrumbs, updateBadge, showToast, confirm, escapeHtml, createSelect } from '../ui.js';

/** Generate a slug from a name: 'Diego' → 'char_diego' */
function generateSlug(prefix, name) {
  const base = name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${prefix}_${base}`;
}

export async function renderCharactersList() {
  setBreadcrumbs([{ label: 'Personajes' }]);
  const characters = await getAll('characters');
  updateBadge('characters', characters.length);

  if (characters.length === 0) {
    renderWorkspace(`
      <div class="workspace-header">
        <div>
          <h1 class="workspace-title">Personajes</h1>
          <p class="workspace-subtitle">Quienes caminan por las habitaciones</p>
        </div>
        <button class="btn btn-primary" onclick="window.location.hash='characters/new'">+ Nuevo Personaje</button>
      </div>
      <div class="empty-state">
        <div class="empty-state-icon">&#129489;&#8205;&#129489;&#8205;&#128101;</div>
        <div class="empty-state-title">No hay personajes todavía</div>
        <div class="empty-state-text">Creá los personajes que van a interactuar con el jugador en tu aventura.</div>
        <button class="btn btn-primary" onclick="window.location.hash='characters/new'">+ Crear Personaje</button>
      </div>
    `);
    return;
  }

  const rooms = await getAll('rooms');
  const roomMap = {};
  rooms.forEach(r => roomMap[r.id] = r.name);

  const cards = characters.map(char => {
    const startRoom = char.initialRoomId ? (roomMap[char.initialRoomId] || '?') : 'Entra por trigger';
    return `
      <div class="card" onclick="window.location.hash='characters/${char.id}'">
        <div class="card-header">
          <div class="card-avatar">
            ${char.avatarUrl ? `<img src="${char.avatarUrl}" alt="${escapeHtml(char.name)}">` : '&#128100;'}
          </div>
          <div class="card-body">
            <div class="card-title">${escapeHtml(char.name)}</div>
            <div class="card-description">${escapeHtml(char.role || 'Sin rol definido')}</div>
          </div>
        </div>
        <div class="card-meta">
          <span class="card-badge">${escapeHtml(startRoom)}</span>
          <span class="text-xs font-mono">${escapeHtml(char.slug || '')}</span>
        </div>
        <div class="card-actions" onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-sm" onclick="window.location.hash='characters/${char.id}'">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="window.deleteCharacter('${char.id}', '${escapeHtml(char.name)}')">Eliminar</button>
        </div>
      </div>
    `;
  }).join('');

  renderWorkspace(`
    <div class="workspace-header">
      <div>
        <h1 class="workspace-title">Personajes</h1>
        <p class="workspace-subtitle">${characters.length} personaje${characters.length !== 1 ? 's' : ''} en el proyecto</p>
      </div>
      <button class="btn btn-primary" onclick="window.location.hash='characters/new'">+ Nuevo Personaje</button>
    </div>
    <div class="card-grid">${cards}</div>
  `);
}

export async function renderCharacterForm(charId = null) {
  const isNew = !charId;
  setBreadcrumbs([
    { label: 'Personajes', route: 'characters' },
    { label: isNew ? 'Nuevo Personaje' : 'Editar' }
  ]);

  let character = null;
  if (!isNew) {
    character = await getOne('characters', charId);
    if (!character) {
      showToast('Personaje no encontrado', 'error');
      window.location.hash = 'characters';
      return;
    }
  }

  const rooms = await getAll('rooms');
  const dialogues = await getAll('dialogues');

  const avatarStyle = 'max-height:150px;max-width:150px;border-radius:50%;object-fit:cover;';

  renderWorkspace(`
    <div class="detail-header">
      <button class="detail-back" onclick="window.location.hash='characters'">&#9664; Volver</button>
      <h1 class="detail-title">${isNew ? 'Nuevo Personaje' : escapeHtml(character.name)}</h1>
    </div>
    <div class="form-container">
      <form id="character-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nombre</label>
            <input type="text" class="form-input" id="char-name" placeholder="Ej: Don Rodolfo" value="${escapeHtml(character?.name || '')}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Slug</label>
            <input type="text" class="form-input font-mono" id="char-slug" placeholder="Ej: char_diego" value="${escapeHtml(character?.slug || '')}">
            <div class="form-hint">Se auto-genera del nombre.</div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Rol / Tipo</label>
          <input type="text" class="form-input" id="char-role" placeholder="Ej: Barman, NPC, Antagonista" value="${escapeHtml(character?.role || '')}">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Habitación Inicial</label>
            ${createSelect(rooms, character?.initialRoomId || '', '— Entra por trigger —')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Biografía / Motivación</label>
          <textarea class="form-textarea" id="char-bio" placeholder="¿Qué lo trae aquí esta noche? ¿Qué quiere?">${escapeHtml(character?.bio || '')}</textarea>
          <div class="form-hint">Esto es para el diseño, no para el jugador. Pensá en su motivación y arco.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Diálogo Principal</label>
          ${createSelect(dialogues, character?.defaultDialogueId || '', '— Seleccionar árbol de diálogos —')}
          <div class="form-hint">El diálogo que se activa por defecto cuando el jugador interactúa con este personaje.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Avatar</label>
          <div class="image-upload" id="char-image-upload" style="padding:16px;">
            <input type="file" accept="image/*" id="char-image-file" onchange="window.handleCharImage(event)">
            ${character?.avatarUrl
              ? `<img src="${character.avatarUrl}" class="image-preview" id="char-image-preview" style="${avatarStyle}">`
              : `<div class="image-upload-icon">&#128100;</div>
                 <div class="image-upload-text">Subir avatar del personaje</div>`
            }
          </div>
          <div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
            <span class="text-xs text-muted">O desde URL:</span>
            <input type="text" class="form-input" id="char-avatar-url-input" placeholder="https://ejemplo.com/avatar.png" value="${character?.avatarUrl && !character.avatarUrl.startsWith('data:') ? escapeHtml(character.avatarUrl) : ''}" style="flex:1;padding:6px 10px;font-size:12px;">
            <button type="button" class="btn btn-ghost btn-sm" onclick="window.applyCharAvatarUrl()">Aplicar</button>
            ${character?.avatarUrl ? `<button type="button" class="btn btn-ghost btn-sm" onclick="window.clearCharAvatar()" style="color:var(--danger);border-color:transparent;">Quitar</button>` : ''}
          </div>
          <input type="hidden" id="char-avatar-url" value="${character?.avatarUrl || ''}">
        </div>

        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary btn-lg">${isNew ? 'Crear Personaje' : 'Guardar Cambios'}</button>
          ${!isNew ? `<button type="button" class="btn btn-danger" id="btn-delete-char">Eliminar Personaje</button>` : ''}
        </div>
      </form>
    </div>
  `);

  // Auto-generate slug from name
  const slugInput = document.getElementById('char-slug');
  const nameInput = document.getElementById('char-name');
  nameInput.addEventListener('input', () => {
    if (!slugInput.dataset.manual) {
      slugInput.value = generateSlug('char', nameInput.value);
    }
  });
  slugInput.addEventListener('input', () => {
    slugInput.dataset.manual = '1';
  });

  document.getElementById('character-form').onsubmit = async (e) => {
    e.preventDefault();
    const selects = document.querySelectorAll('#character-form .form-select');
    const data = {
      slug: document.getElementById('char-slug').value.trim(),
      name: document.getElementById('char-name').value.trim(),
      role: document.getElementById('char-role').value.trim(),
      initialRoomId: selects[0]?.value || null,
      bio: document.getElementById('char-bio').value.trim(),
      defaultDialogueId: selects[1]?.value || null,
      avatarUrl: document.getElementById('char-avatar-url').value
    };

    if (!data.slug) data.slug = generateSlug('char', data.name);
    if (!data.name) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }

    try {
      if (isNew) {
        await create('characters', data);
        showToast('Personaje creado', 'success');
      } else {
        await update('characters', charId, data);
        showToast('Personaje actualizado', 'success');
      }
      window.location.hash = 'characters';
    } catch (err) {
      console.error(err);
      showToast('Error al guardar: ' + err.message, 'error');
    }
  };

  if (!isNew) {
    document.getElementById('btn-delete-char').onclick = async () => {
      const ok = await confirm(`¿Eliminás "${character.name}"?`);
      if (ok) {
        await remove('characters', charId);
        showToast('Personaje eliminado', 'success');
        window.location.hash = 'characters';
      }
    };
  }
}

// ============================================
// Avatar Handling
// ============================================

const AVATAR_STYLE = 'max-height:150px;max-width:150px;border-radius:50%;object-fit:cover;';

window.handleCharImage = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('char-avatar-url').value = e.target.result;
    document.getElementById('char-avatar-url-input').value = '';
    const uploadDiv = document.getElementById('char-image-upload');
    const existingImg = document.getElementById('char-image-preview');
    if (existingImg) {
      existingImg.src = e.target.result;
    } else {
      const img = document.createElement('img');
      img.src = e.target.result;
      img.className = 'image-preview';
      img.id = 'char-image-preview';
      img.style.cssText = AVATAR_STYLE;
      uploadDiv.querySelector('.image-upload-icon')?.remove();
      uploadDiv.querySelector('.image-upload-text')?.remove();
      uploadDiv.insertBefore(img, uploadDiv.firstChild);
    }
  };
  reader.readAsDataURL(file);
};

window.applyCharAvatarUrl = function() {
  const url = document.getElementById('char-avatar-url-input')?.value.trim();
  if (!url) {
    showToast('Escribí una URL primero', 'error');
    return;
  }
  document.getElementById('char-avatar-url').value = url;
  const uploadDiv = document.getElementById('char-image-upload');
  const existingImg = document.getElementById('char-image-preview');
  if (existingImg) {
    existingImg.src = url;
  } else {
    const img = document.createElement('img');
    img.src = url;
    img.className = 'image-preview';
    img.id = 'char-image-preview';
    img.style.cssText = AVATAR_STYLE;
    img.onerror = () => {
      showToast('No se pudo cargar la imagen desde esa URL', 'error');
      img.remove();
    };
    uploadDiv.querySelector('.image-upload-icon')?.remove();
    uploadDiv.querySelector('.image-upload-text')?.remove();
    uploadDiv.insertBefore(img, uploadDiv.firstChild);
  }
  showToast('Avatar aplicado', 'success');
};

window.clearCharAvatar = function() {
  document.getElementById('char-avatar-url').value = '';
  document.getElementById('char-avatar-url-input').value = '';
  const img = document.getElementById('char-image-preview');
  if (img) img.remove();
  const uploadDiv = document.getElementById('char-image-upload');
  if (uploadDiv && !uploadDiv.querySelector('.image-upload-icon')) {
    uploadDiv.insertAdjacentHTML('afterbegin', `
      <div class="image-upload-icon">&#128100;</div>
      <div class="image-upload-text">Subir avatar del personaje</div>
    `);
  }
};

// ============================================
// Delete from list view
// ============================================

window.deleteCharacter = async function(charId, name) {
  const ok = await confirm(`¿Eliminás "${name}"?`);
  if (ok) {
    await remove('characters', charId);
    showToast('Personaje eliminado', 'success');
    renderCharactersList();
  }
};
