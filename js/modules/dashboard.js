// ============================================
// Módulo: Dashboard — Página de Inicio
// ============================================
import { getAll, getProjectMeta, updateProjectMeta, getNodes } from '../db.js';
import { renderWorkspace, setBreadcrumbs, updateBadge, showToast, escapeHtml } from '../ui.js';

// ============================================
// Dashboard — Main View
// ============================================

export async function renderDashboard() {
  setBreadcrumbs([{ label: 'Dashboard' }]);
  renderWorkspace('<div class="loading"><div class="spinner"></div></div>');

  try {
    // Fetch all data in parallel
    const [meta, rooms, characters, items, flags, triggers, dialogues, notes, audioTracks] = await Promise.all([
      getProjectMeta(),
      getAll('rooms'),
      getAll('characters'),
      getAll('items'),
      getAll('flags'),
      getAll('timeline'),
      getAll('dialogues'),
      getAll('notes'),
      getAll('audio')
    ]);

    // Count dialogue nodes
    const nodeCounts = await Promise.all(
      dialogues.map(async (d) => {
        const nodes = await getNodes(d.id);
        return nodes.length;
      })
    );
    const nodeCount = nodeCounts.reduce((a, b) => a + b, 0);

    // Update all sidebar badges
    updateBadge('rooms', rooms.length);
    updateBadge('characters', characters.length);
    updateBadge('items', items.length);
    updateBadge('timeline', triggers.length);
    updateBadge('dialogues', dialogues.length);
    updateBadge('audio', audioTracks.length);

    // Update sidebar project name
    const sidebarName = document.getElementById('project-name');
    if (sidebarName && meta.name) {
      sidebarName.textContent = meta.name;
    }

    // Build recent entities list (sort all by updatedAt desc, take top 8)
    const typeConfig = {
      room:     { label: 'Habitación', icon: 'fa-map',      color: 'var(--accent)',  route: 'rooms' },
      char:     { label: 'Personaje',  icon: 'fa-users',    color: 'var(--info)',    route: 'characters' },
      item:     { label: 'Item',       icon: 'fa-box-open', color: 'var(--warning)', route: 'items' },
      flag:     { label: 'Flag',       icon: 'fa-flag',     color: 'var(--danger)',  route: 'items/flags' },
      trigger:  { label: 'Evento',     icon: 'fa-clock',    color: '#c77dff',        route: 'timeline' },
      dialogue: { label: 'Diálogo',    icon: 'fa-comments', color: 'var(--success)', route: 'dialogues' },
      note:     { label: 'Nota',       icon: 'fa-note-sticky', color: '#818cf8',     route: 'notes' },
      audio:    { label: 'Audio',      icon: 'fa-headphones',  color: '#fb923c',     route: 'audio' }
    };

    const allEntities = [
      ...rooms.map(e => ({ ...e, _type: 'room',     _name: e.name })),
      ...characters.map(e => ({ ...e, _type: 'char', _name: e.name })),
      ...items.map(e => ({ ...e, _type: 'item',    _name: e.name })),
      ...flags.map(e => ({ ...e, _type: 'flag',    _name: e.name })),
      ...triggers.map(e => ({ ...e, _type: 'trigger', _name: e.eventName })),
      ...dialogues.map(e => ({ ...e, _type: 'dialogue', _name: e.name })),
      ...notes.map(e => ({ ...e, _type: 'note',    _name: e.title })),
      ...audioTracks.map(e => ({ ...e, _type: 'audio',  _name: e.name }))
    ];

    // Sort by updatedAt desc (fallback to createdAt)
    allEntities.sort((a, b) => {
      const aTime = (a.updatedAt?.seconds || a.createdAt?.seconds || 0);
      const bTime = (b.updatedAt?.seconds || b.createdAt?.seconds || 0);
      return bTime - aTime;
    });

    const recentEntities = allEntities.slice(0, 8);

    // "Creado" — from project meta (editable by user)
    const createdDate = meta.createdAt?.seconds
      ? formatFirestoreDate(meta.createdAt)
      : 'No establecida';

    // "Última modificación" — from most recently modified entity
    let modifiedDate = 'Sin datos';
    if (recentEntities.length > 0) {
      const mostRecent = recentEntities[0];
      const ts = mostRecent.updatedAt || mostRecent.createdAt;
      if (ts?.seconds) {
        modifiedDate = formatFirestoreDate(ts);
      }
    }

    // Build stats cards
    const stats = [
      { key: 'rooms',      label: 'Habitaciones', icon: 'fa-map',           color: 'var(--accent)',  count: rooms.length,     route: 'rooms' },
      { key: 'characters', label: 'Personajes',   icon: 'fa-users',         color: 'var(--info)',    count: characters.length, route: 'characters' },
      { key: 'items',      label: 'Items',        icon: 'fa-box-open',      color: 'var(--warning)', count: items.length,      route: 'items' },
      { key: 'flags',      label: 'Flags',        icon: 'fa-flag',          color: 'var(--danger)',  count: flags.length,      route: 'items/flags' },
      { key: 'timeline',   label: 'Triggers',     icon: 'fa-clock',         color: '#c77dff',        count: triggers.length,   route: 'timeline' },
      { key: 'dialogues',  label: 'Diálogos',     icon: 'fa-comments',      color: 'var(--success)', count: dialogues.length,  route: 'dialogues' },
      { key: 'notes',      label: 'Notas',        icon: 'fa-note-sticky',   color: '#818cf8',        count: notes.length,      route: 'notes' },
      { key: 'nodes',      label: 'Nodos',        icon: 'fa-sitemap',       color: '#f472b6',        count: nodeCount,         route: 'dialogues' },
      { key: 'audio',      label: 'Audio',        icon: 'fa-headphones',    color: '#fb923c',        count: audioTracks.length, route: 'audio' }
    ];

    const statsHtml = stats.map(s => `
      <div class="dash-stat-card" onclick="window.location.hash='${s.route}'" style="--stat-color: ${s.color}">
        <div class="dash-stat-icon"><i class="fa-solid ${s.icon}"></i></div>
        <div class="dash-stat-count">${s.count}</div>
        <div class="dash-stat-label">${s.label}</div>
      </div>
    `).join('');

    // Build recent entities
    let recentHtml = '';
    if (recentEntities.length === 0) {
      recentHtml = `
        <div class="dash-empty-recent">
          <i class="fa-solid fa-inbox" style="font-size:32px;color:var(--text-muted);margin-bottom:12px;display:block;"></i>
          <p style="color:var(--text-muted);font-size:13px;">Todavía no editaste ninguna entidad. Empezá creando una habitación.</p>
        </div>`;
    } else {
      recentHtml = recentEntities.map(e => {
        const cfg = typeConfig[e._type];
        const editedDate = (e.updatedAt?.seconds || e.createdAt?.seconds)
          ? formatFirestoreDateShort(e.updatedAt || e.createdAt)
          : '';
        const hash = cfg.route + '/' + e.id;
        return `
          <div class="dash-recent-item" onclick="window.location.hash='${hash}'">
            <div class="dash-recent-icon" style="--icon-color:${cfg.color}">
              <i class="fa-solid ${cfg.icon}"></i>
            </div>
            <div class="dash-recent-info">
              <div class="dash-recent-name">${escapeHtml(e._name || 'Sin nombre')}</div>
              <div class="dash-recent-meta">
                <span class="dash-recent-type" style="color:${cfg.color}">${cfg.label}</span>
                ${editedDate ? `<span class="dash-recent-date">${editedDate}</span>` : ''}
              </div>
            </div>
          </div>`;
      }).join('');
    }

    // Render dashboard
    renderWorkspace(`
      <div class="dash-container">
        <!-- Project Summary -->
        <div class="dash-project-card">
          <div class="dash-project-header">
            <div class="dash-project-logo"><i class="fa-solid fa-gamepad"></i></div>
            <div class="dash-project-info">
              <div class="dash-project-name" id="dash-project-name" title="Clic para editar">${escapeHtml(meta.name || '31 de Diciembre')}</div>
              <div class="dash-project-type">Adventure Design Toolbox</div>
            </div>
            <button class="btn btn-ghost btn-sm dash-edit-name-btn" id="dash-edit-name-btn" title="Editar nombre del proyecto">
              <i class="fa-solid fa-pen"></i>
            </button>
          </div>
          <div class="dash-project-meta">
            <div class="dash-meta-item" id="dash-created-item" title="Clic para editar">
              <i class="fa-solid fa-calendar-plus"></i>
              <span>Creado: <strong id="dash-created-date">${createdDate}</strong></span>
              <button class="btn btn-ghost btn-sm" id="dash-edit-created-btn" style="padding:2px 4px;margin-left:-4px;"><i class="fa-solid fa-pen" style="font-size:10px;"></i></button>
            </div>
            <div class="dash-meta-item">
              <i class="fa-solid fa-calendar-pen"></i>
              <span>Última modificación: ${modifiedDate}</span>
            </div>
          </div>
        </div>

        <!-- Stats Grid -->
        <div class="dash-section">
          <h2 class="dash-section-title">Resumen del Proyecto</h2>
          <div class="dash-stats-grid">
            ${statsHtml}
          </div>
        </div>

        <!-- Recent Entities -->
        <div class="dash-section">
          <h2 class="dash-section-title">Últimas Ediciones</h2>
          <div class="dash-recent-list">
            ${recentHtml}
          </div>
        </div>
      </div>
    `);

    // Attach edit handlers
    setupProjectNameEdit(meta);
    setupCreatedDateEdit(meta);

  } catch (err) {
    console.error('Dashboard error:', err);
    renderWorkspace(`
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-triangle-exclamation" style="font-size:48px;"></i></div>
        <div class="empty-state-title">Error al cargar el dashboard</div>
        <div class="empty-state-text">${escapeHtml(err.message)}</div>
      </div>
    `);
  }
}

// ============================================
// Project Name Inline Edit
// ============================================

function setupProjectNameEdit(meta) {
  const nameEl = document.getElementById('dash-project-name');
  const editBtn = document.getElementById('dash-edit-name-btn');
  if (!nameEl || !editBtn) return;

  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    startEditProjectName(nameEl, meta);
  });

  nameEl.style.cursor = 'pointer';
  nameEl.addEventListener('click', () => {
    startEditProjectName(nameEl, meta);
  });
}

function startEditProjectName(nameEl, meta) {
  const currentName = nameEl.textContent.trim();

  // Replace with input
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'form-input dash-name-input';
  input.value = currentName;
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  // Hide edit button
  const editBtn = document.getElementById('dash-edit-name-btn');
  if (editBtn) editBtn.style.display = 'none';

  const saveName = async (newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === currentName) {
      // Restore original
      const span = document.createElement('div');
      span.className = 'dash-project-name';
      span.id = 'dash-project-name';
      span.title = 'Clic para editar';
      span.textContent = currentName;
      span.style.cursor = 'pointer';
      input.replaceWith(span);
      if (editBtn) editBtn.style.display = '';
      setupProjectNameEdit(meta);
      return;
    }

    try {
      await updateProjectMeta({ name: trimmed });
      showToast('Nombre del proyecto actualizado', 'success');

      // Update dashboard and sidebar
      const span = document.createElement('div');
      span.className = 'dash-project-name';
      span.id = 'dash-project-name';
      span.title = 'Clic para editar';
      span.textContent = trimmed;
      span.style.cursor = 'pointer';
      input.replaceWith(span);
      if (editBtn) editBtn.style.display = '';

      // Update sidebar
      const sidebarName = document.getElementById('project-name');
      if (sidebarName) sidebarName.textContent = trimmed;

      // Update document title
      document.title = `${trimmed} — Adventure Design Toolbox`;

      setupProjectNameEdit({ ...meta, name: trimmed });
    } catch (err) {
      console.error('Error updating project name:', err);
      showToast('Error al guardar el nombre', 'error');
      const span = document.createElement('div');
      span.className = 'dash-project-name';
      span.id = 'dash-project-name';
      span.title = 'Clic para editar';
      span.textContent = currentName;
      span.style.cursor = 'pointer';
      input.replaceWith(span);
      if (editBtn) editBtn.style.display = '';
      setupProjectNameEdit(meta);
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveName(input.value);
    } else if (e.key === 'Escape') {
      saveName(currentName); // cancel
    }
  });

  input.addEventListener('blur', () => {
    saveName(input.value);
  });
}

// ============================================
// Created Date Inline Edit
// ============================================

function setupCreatedDateEdit(meta) {
  const itemEl = document.getElementById('dash-created-item');
  const editBtn = document.getElementById('dash-edit-created-btn');
  const dateEl = document.getElementById('dash-created-date');
  if (!itemEl || !editBtn || !dateEl) return;

  itemEl.style.cursor = 'pointer';

  const startEdit = (e) => {
    if (e) e.stopPropagation();
    editCreatedDate(dateEl, editBtn, meta);
  };

  editBtn.addEventListener('click', startEdit);
  itemEl.addEventListener('click', startEdit);
}

function editCreatedDate(dateEl, editBtn, meta) {
  // Build a date input (type="date")
  const input = document.createElement('input');
  input.type = 'date';
  input.className = 'form-input dash-date-input';

  // Pre-fill with stored date or today
  if (meta.createdAt?.seconds) {
    const d = new Date(meta.createdAt.seconds * 1000);
    input.value = d.toISOString().split('T')[0];
  }

  dateEl.replaceWith(input);
  if (editBtn) editBtn.style.display = 'none';
  input.focus();

  const saveDate = async () => {
    const val = input.value;
    if (!val) {
      // No date selected — restore
      restoreCreatedDate(input, editBtn, 'No establecida', meta);
      return;
    }

    try {
      // Store as Firestore timestamp (midnight of selected date)
      const dateObj = new Date(val + 'T00:00:00');
      await updateProjectMeta({ createdAt: dateObj });
      showToast('Fecha de creación actualizada', 'success');
      const formatted = dateObj.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
      restoreCreatedDate(input, editBtn, formatted, { ...meta, createdAt: { seconds: Math.floor(dateObj.getTime() / 1000) } });
    } catch (err) {
      console.error('Error saving created date:', err);
      showToast('Error al guardar la fecha', 'error');
      const prevFormatted = meta.createdAt?.seconds
        ? formatFirestoreDate(meta.createdAt)
        : 'No establecida';
      restoreCreatedDate(input, editBtn, prevFormatted, meta);
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveDate(); }
    if (e.key === 'Escape') {
      const prevFormatted = meta.createdAt?.seconds
        ? formatFirestoreDate(meta.createdAt)
        : 'No establecida';
      restoreCreatedDate(input, editBtn, prevFormatted, meta);
    }
  });

  input.addEventListener('blur', saveDate);
}

function restoreCreatedDate(input, editBtn, text, meta) {
  const strong = document.createElement('strong');
  strong.id = 'dash-created-date';
  strong.textContent = text;
  input.replaceWith(strong);
  if (editBtn) editBtn.style.display = '';
  setupCreatedDateEdit(meta);
}

// ============================================
// Date Formatting Helpers
// ============================================

function formatFirestoreDate(timestamp) {
  if (!timestamp) return 'No disponible';
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatFirestoreDateShort(timestamp) {
  if (!timestamp) return '';
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin}min`;
  if (diffHrs < 24) return `Hace ${diffHrs}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}
