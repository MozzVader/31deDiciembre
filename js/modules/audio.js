// ============================================
// Módulo: Audio — Biblioteca de Sonido
// ============================================
import { getAll, getOne, create, update, remove } from '../db.js';
import { renderWorkspace, setBreadcrumbs, showToast, confirm, escapeHtml, createSelect, updateBadge } from '../ui.js';

// ============================================
// Categories
// ============================================
const CATEGORIES = {
  musica_incidental: { label: 'Música Incidental', icon: 'fa-music',        color: '#c084fc' },
  ambiente:          { label: 'Ambiente',          icon: 'fa-cloud-sun',     color: '#60a5fa' },
  efecto_sonido:     { label: 'Efecto de Sonido',  icon: 'fa-bolt',          color: '#fbbf24' },
  voz:               { label: 'Voz / Diálogo',     icon: 'fa-microphone',    color: '#34d399' },
  cortina:           { label: 'Cortina / Transición', icon: 'fa-forward',    color: '#f472b6' },
  ui:                { label: 'UI Sounds',          icon: 'fa-volume-high',   color: '#fb923c' }
};

// ============================================
// List View — Card grid with inline player
// ============================================

let activeFilter = 'all';
let activeAudio = null; // currently playing audio element

export async function renderAudioList() {
  setBreadcrumbs([{ label: 'Biblioteca de Audio' }]);
  const tracks = await getAll('audio');
  updateBadge('audio', tracks.length);

  if (tracks.length === 0) {
    renderWorkspace(`
      <div class="workspace-header">
        <div>
          <h1 class="workspace-title">Biblioteca de Audio</h1>
          <p class="workspace-subtitle">Música, efectos de sonido, voces y más</p>
        </div>
        <button class="btn btn-primary" onclick="window.location.hash='audio/new'"><i class="fa-solid fa-plus"></i> Nuevo Audio</button>
      </div>
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-headphones" style="font-size:48px;"></i></div>
        <div class="empty-state-title">Sin pistas de audio todavía</div>
        <div class="empty-state-text">Agregá las pistas que tu juego necesita: música incidental, efectos de sonido, ambientación, voces y más.</div>
        <button class="btn btn-primary" onclick="window.location.hash='audio/new'">+ Agregar Audio</button>
      </div>
    `);
    return;
  }

  // Stop any currently playing audio
  stopAllAudio();

  // Category filter tabs
  const filterHtml = buildFilterTabs(tracks);
  const filtered = activeFilter === 'all' ? tracks : tracks.filter(t => t.category === activeFilter);

  // Sort: by category first, then name
  const sorted = [...filtered].sort((a, b) => {
    const catA = a.category || '';
    const catB = b.category || '';
    if (catA !== catB) return catA.localeCompare(catB);
    return (a.name || '').localeCompare(b.name || '');
  });

  const cardsHtml = sorted.map(track => {
    const cat = CATEGORIES[track.category] || CATEGORIES.musica_incidental;
    const tagBadges = (track.tags || []).slice(0, 4).map(t =>
      `<span class="audio-tag">${escapeHtml(t)}</span>`
    ).join('');
    const moreTags = (track.tags || []).length > 4
      ? `<span class="audio-tag audio-tag-more">+${(track.tags.length - 4)}</span>`
      : '';
    const durationHtml = track.duration
      ? `<span class="audio-duration"><i class="fa-solid fa-clock" style="font-size:10px;"></i> ${escapeHtml(track.duration)}</span>`
      : '';
    const roomHtml = track.room
      ? `<span class="audio-room"><i class="fa-solid fa-map" style="font-size:10px;"></i> ${escapeHtml(track.room)}</span>`
      : '';
    const descHtml = track.description
      ? `<div class="audio-card-desc">${escapeHtml(track.description)}</div>`
      : '';

    return `
      <div class="audio-card" onclick="window.location.hash='audio/${track.id}'" data-category="${track.category || ''}">
        <div class="audio-card-header">
          <div class="audio-card-icon" style="background:${cat.color}20;color:${cat.color};">
            <i class="fa-solid ${cat.icon}"></i>
          </div>
          <div class="audio-card-info">
            <div class="audio-card-name">${escapeHtml(track.name || 'Sin nombre')}</div>
            <div class="audio-card-meta">
              <span class="audio-card-cat" style="color:${cat.color};">${cat.label}</span>
              ${durationHtml}
              ${roomHtml}
            </div>
          </div>
        </div>
        ${descHtml}
        <div class="audio-card-footer">
          <div class="audio-tags">${tagBadges}${moreTags}</div>
          <button class="audio-play-btn" data-url="${escapeHtml(track.url || '')}" onclick="event.stopPropagation(); window.toggleAudioPreview(this);" title="Reproducir">
            <i class="fa-solid fa-play"></i>
          </button>
        </div>
      </div>`;
  }).join('');

  renderWorkspace(`
    <div class="workspace-header">
      <div>
        <h1 class="workspace-title">Biblioteca de Audio</h1>
        <p class="workspace-subtitle">${tracks.length} pista${tracks.length !== 1 ? 's' : ''} registrada${tracks.length !== 1 ? 's' : ''}</p>
      </div>
      <button class="btn btn-primary" onclick="window.location.hash='audio/new'"><i class="fa-solid fa-plus"></i> Nuevo Audio</button>
    </div>
    ${filterHtml}
    ${sorted.length === 0
      ? `<div class="empty-state" style="padding:40px 20px;">
           <div class="empty-state-text">No hay pistas en esta categoría.</div>
         </div>`
      : `<div class="audio-grid">${cardsHtml}</div>`
    }
  `);

  // Bind filter clicks
  document.querySelectorAll('.audio-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      renderAudioList();
    });
  });
}

// ============================================
// Filter Tabs
// ============================================

function buildFilterTabs(tracks) {
  const catCounts = {};
  tracks.forEach(t => {
    const key = t.category || '_none';
    catCounts[key] = (catCounts[key] || 0) + 1;
  });

  let html = `<div class="audio-filters">
    <button class="audio-filter-btn ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">Todas <span class="audio-filter-count">${tracks.length}</span></button>`;

  Object.entries(CATEGORIES).forEach(([key, cat]) => {
    const count = catCounts[key] || 0;
    if (count > 0) {
      html += `<button class="audio-filter-btn ${activeFilter === key ? 'active' : ''}" data-filter="${key}">
        <i class="fa-solid ${cat.icon}" style="font-size:11px;"></i> ${cat.label} <span class="audio-filter-count">${count}</span>
      </button>`;
    }
  });

  html += '</div>';
  return html;
}

// ============================================
// Inline Audio Preview
// ============================================

function stopAllAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio = null;
  }
  // Reset all play buttons in the document
  document.querySelectorAll('.audio-play-btn.playing').forEach(btn => {
    btn.classList.remove('playing');
    btn.innerHTML = '<i class="fa-solid fa-play"></i>';
  });
}

window.toggleAudioPreview = function(btn) {
  const url = btn.dataset.url;
  if (!url) {
    showToast('No hay URL de audio configurada', 'info');
    return;
  }

  const isPlaying = btn.classList.contains('playing');

  // Stop everything first
  stopAllAudio();

  if (isPlaying) return; // just stopped

  // Play
  const audio = new Audio(url);
  activeAudio = audio;
  btn.classList.add('playing');
  btn.innerHTML = '<i class="fa-solid fa-pause"></i>';

  audio.play().catch(() => {
    showToast('No se pudo reproducir el audio', 'error');
    btn.classList.remove('playing');
    btn.innerHTML = '<i class="fa-solid fa-play"></i>';
    activeAudio = null;
  });

  audio.addEventListener('ended', () => {
    btn.classList.remove('playing');
    btn.innerHTML = '<i class="fa-solid fa-play"></i>';
    activeAudio = null;
  });

  audio.addEventListener('error', () => {
    showToast('Error al cargar el audio', 'error');
    btn.classList.remove('playing');
    btn.innerHTML = '<i class="fa-solid fa-play"></i>';
    activeAudio = null;
  });
};

// ============================================
// Form — Create / Edit Audio
// ============================================

export async function renderAudioForm(audioId = null) {
  const isNew = !audioId;
  let currentId = audioId;

  setBreadcrumbs([
    { label: 'Audio', route: 'audio' },
    { label: isNew ? 'Nueva Pista' : 'Editar Pista' }
  ]);

  // Fetch existing data and rooms in parallel
  const [audio, rooms] = await Promise.all([
    isNew ? null : getOne('audio', currentId),
    getAll('rooms')
  ]);

  if (!isNew && !audio) {
    showToast('Pista de audio no encontrada', 'error');
    window.location.hash = 'audio';
    return;
  }

  // Stop any playing audio
  stopAllAudio();

  const name = audio?.name || '';
  const description = audio?.description || '';
  const category = audio?.category || 'musica_incidental';
  const url = audio?.url || '';
  const duration = audio?.duration || '';
  const room = audio?.room || '';
  const tagsStr = (audio?.tags || []).join(', ');

  const categoryOptions = Object.entries(CATEGORIES).map(([key, cat]) =>
    `<option value="${key}" ${category === key ? 'selected' : ''}>${cat.label}</option>`
  ).join('');

  const roomOptions = [
    { id: '', name: '— Sin habitación asignada —' },
    ...rooms.map(r => ({ id: r.slug || r.id, name: r.name || r.slug || r.id }))
  ];

  const urlPreviewHtml = url
    ? `<div class="audio-form-player" id="audio-form-player">
         <audio controls src="${escapeHtml(url)}" preload="metadata" style="width:100%;height:40px;border-radius:var(--radius-sm);"></audio>
       </div>`
    : '';

  renderWorkspace(`
    <div class="detail-header">
      <button class="detail-back" onclick="window.location.hash='audio'"><i class="fa-solid fa-arrow-left"></i> Volver</button>
      <input type="text" class="form-input" id="audio-name" placeholder="Nombre de la pista..." value="${escapeHtml(name)}" style="font-size:18px;font-weight:700;background:transparent;border:1px solid transparent;padding:4px 8px;flex:1;max-width:500px;">
      <div class="detail-actions">
        <button class="btn btn-primary btn-sm" id="btn-save-audio"><i class="fa-solid fa-check"></i> Guardar</button>
        ${!isNew ? `<button class="btn btn-danger btn-sm" id="btn-delete-audio"><i class="fa-solid fa-trash"></i> Eliminar</button>` : ''}
      </div>
    </div>

    <div class="form-container" style="max-width:700px;">

      <div class="form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group">
          <label class="form-label">Categoría</label>
          <select class="form-select" id="audio-category">
            ${categoryOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Duración</label>
          <input type="text" class="form-input" id="audio-duration" placeholder="Ej: 2:30, 0:45" value="${escapeHtml(duration)}">
          <div class="form-hint">Formato min:seg. Es informativo, no se valida automáticamente.</div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">URL del Archivo de Audio</label>
        <input type="text" class="form-input" id="audio-url" placeholder="https://ejemplo.com/mi-pista.mp3" value="${escapeHtml(url)}">
        <div class="form-hint">Pegá el enlace al archivo de audio. No se sube a Firestore, solo se guarda la referencia.</div>
        <button class="btn btn-ghost btn-sm" id="btn-preview-audio" style="margin-top:6px;"><i class="fa-solid fa-headphones"></i> Vista previa</button>
        <div id="audio-player-container">${urlPreviewHtml}</div>
      </div>

      <div class="form-group">
        <label class="form-label">Habitación Asignada (opcional)</label>
        ${createSelect(roomOptions, room, '— Sin habitación asignada —', true)}
        <div class="form-hint">Si la pista se usa en una habitación específica, seleccionala acá.</div>
      </div>

      <div class="form-group">
        <label class="form-label">Etiquetas</label>
        <input type="text" class="form-input" id="audio-tags" placeholder="Ej: tensión, noche, capítulo 1, boss" value="${escapeHtml(tagsStr)}">
        <div class="form-hint">Separadas por coma. Sirven para filtrar y organizar.</div>
      </div>

      <div class="form-group">
        <label class="form-label">Notas / Descripción</label>
        <textarea class="form-textarea" id="audio-description" rows="3" placeholder="Para qué se usa esta pista, contexto en el juego, notas de producción...">${escapeHtml(description)}</textarea>
      </div>

    </div>
  `);

  // --- Event Bindings ---

  // Preview button
  document.getElementById('btn-preview-audio')?.addEventListener('click', previewAudio);

  // Save
  document.getElementById('btn-save-audio')?.addEventListener('click', saveAudio);

  // Delete
  if (!isNew) {
    document.getElementById('btn-delete-audio')?.addEventListener('click', async () => {
      const ok = await confirm('¿Eliminás esta pista de audio?');
      if (ok) {
        stopAllAudio();
        await remove('audio', currentId);
        showToast('Pista eliminada', 'success');
        window.location.hash = 'audio';
      }
    });
  }

  // --- Preview ---
  function previewAudio() {
    const urlVal = document.getElementById('audio-url').value.trim();
    if (!urlVal) {
      showToast('Escribí una URL de audio primero', 'info');
      return;
    }

    const container = document.getElementById('audio-player-container');
    // Remove existing player
    const existing = document.getElementById('audio-form-player');
    if (existing) existing.remove();

    const playerDiv = document.createElement('div');
    playerDiv.className = 'audio-form-player';
    playerDiv.id = 'audio-form-player';
    playerDiv.innerHTML = `<audio controls src="${escapeHtml(urlVal)}" preload="metadata" style="width:100%;height:40px;border-radius:var(--radius-sm);"></audio>`;
    container.appendChild(playerDiv);

    const audio = playerDiv.querySelector('audio');
    audio.play().catch(() => {
      showToast('No se pudo reproducir. Verificá que la URL sea correcta.', 'error');
    });
  }

  // --- Save ---
  async function saveAudio() {
    const nameVal = document.getElementById('audio-name').value.trim();
    if (!nameVal) {
      showToast('Ponle un nombre a la pista', 'error');
      document.getElementById('audio-name').focus();
      return;
    }

    const tagsRaw = document.getElementById('audio-tags').value.trim();
    const tags = tagsRaw
      ? tagsRaw.split(',').map(t => t.trim()).filter(t => t.length > 0)
      : [];

    const roomSelect = document.querySelector('.form-select[data-filterable]');

    const data = {
      name: nameVal,
      description: document.getElementById('audio-description').value.trim(),
      category: document.getElementById('audio-category').value,
      url: document.getElementById('audio-url').value.trim(),
      duration: document.getElementById('audio-duration').value.trim(),
      room: roomSelect ? roomSelect.value : '',
      tags
    };

    try {
      if (isNew || !currentId) {
        const id = await create('audio', data);
        currentId = id;
        isNew = false;
        showToast('Pista de audio creada', 'success');
        window.history.replaceState(null, '', '#audio/' + id);
      } else {
        await update('audio', currentId, data);
        showToast('Pista de audio actualizada', 'success');
      }
      window.location.hash = 'audio';
    } catch (err) {
      console.error(err);
      showToast('Error al guardar: ' + err.message, 'error');
    }
  }
}
