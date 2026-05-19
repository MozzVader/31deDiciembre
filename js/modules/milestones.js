// ============================================
// Módulo: Milestones — Hitos del Proyecto
// ============================================
import { getAll, create, update, remove, getOne, generateId } from '../db.js';
import { renderWorkspace, setBreadcrumbs, showToast, confirm, escapeHtml } from '../ui.js';

// ============================================
// Categories
// ============================================
const CATEGORIES = {
  arte:     { label: 'Arte',      icon: 'fa-palette',       color: '#f472b6' },
  codigo:   { label: 'Código',    icon: 'fa-code',          color: '#60a5fa' },
  diseno:   { label: 'Diseño',    icon: 'fa-pencil-ruler',  color: '#c084fc' },
  historia: { label: 'Historia',  icon: 'fa-book-open',     color: '#fbbf24' },
  general:  { label: 'General',   icon: 'fa-star',          color: '#34d399' }
};

// ============================================
// List View — Vertical Timeline
// ============================================

export async function renderMilestonesList() {
  setBreadcrumbs([{ label: 'Hitos del Proyecto' }]);
  const milestones = await getAll('milestones');

  if (milestones.length === 0) {
    renderWorkspace(`
      <div class="workspace-header">
        <div>
          <h1 class="workspace-title">Hitos del Proyecto</h1>
          <p class="workspace-subtitle">Tu línea de tiempo de desarrollo</p>
        </div>
        <button class="btn btn-primary" onclick="window.location.hash='milestones/new'">+ Nuevo Hito</button>
      </div>
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-trophy" style="font-size:48px;"></i></div>
        <div class="empty-state-title">No hay hitos todavía</div>
        <div class="empty-state-text">Registra los momentos importantes del desarrollo de tu juego. Una captura, un logro, un paso adelante.</div>
        <button class="btn btn-primary" onclick="window.location.hash='milestones/new'">+ Crear Hito</button>
      </div>
    `);
    return;
  }

  // Sort by date descending (most recent first)
  const sorted = [...milestones].sort((a, b) => {
    const aTime = a.date || a.createdAt;
    const bTime = b.date || b.createdAt;
    const aSec = aTime?.seconds || 0;
    const bSec = bTime?.seconds || 0;
    return bSec - aSec;
  });

  const timelineHtml = sorted.map(ms => {
    const cat = CATEGORIES[ms.category] || CATEGORIES.general;
    const dateStr = ms.date?.seconds
      ? new Date(ms.date.seconds * 1000).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const imgHtml = ms.imageUrl
      ? `<div class="ms-timeline-img"><img src="${ms.imageUrl}" alt="${escapeHtml(ms.title)}" loading="lazy"></div>`
      : '';
    const descHtml = ms.description
      ? `<div class="ms-timeline-desc">${escapeHtml(ms.description)}</div>`
      : '';

    return `
      <div class="ms-timeline-item" onclick="window.location.hash='milestones/${ms.id}'">
        <div class="ms-timeline-dot" style="background:${cat.color};border-color:${cat.color}33;">
          <i class="fa-solid ${cat.icon}" style="color:#fff;font-size:11px;"></i>
        </div>
        <div class="ms-timeline-card">
          <div class="ms-timeline-header">
            <span class="ms-timeline-date">${dateStr}</span>
            <span class="ms-timeline-cat" style="color:${cat.color};background:${cat.color}18;">
              <i class="fa-solid ${cat.icon}" style="font-size:10px;"></i> ${cat.label}
            </span>
          </div>
          <div class="ms-timeline-title">${escapeHtml(ms.title || 'Sin título')}</div>
          ${descHtml}
          ${imgHtml}
        </div>
      </div>`;
  }).join('');

  renderWorkspace(`
    <div class="workspace-header">
      <div>
        <h1 class="workspace-title">Hitos del Proyecto</h1>
        <p class="workspace-subtitle">${milestones.length} hito${milestones.length !== 1 ? 's' : ''} registrado${milestones.length !== 1 ? 's' : ''}</p>
      </div>
      <button class="btn btn-primary" onclick="window.location.hash='milestones/new'">+ Nuevo Hito</button>
    </div>
    <div class="ms-timeline">${timelineHtml}</div>
  `);
}

// ============================================
// Form — Create / Edit Milestone
// ============================================

export async function renderMilestoneForm(msId = null) {
  let isNew = !msId;
  let currentMsId = msId;
  setBreadcrumbs([
    { label: 'Hitos del Proyecto', route: 'milestones' },
    { label: isNew ? 'Nuevo Hito' : 'Editar Hito' }
  ]);

  let ms = null;
  if (!isNew) {
    ms = await getOne('milestones', currentMsId);
    if (!ms) {
      showToast('Hito no encontrado', 'error');
      window.location.hash = 'milestones';
      return;
    }
  }

  const title = ms?.title || '';
  const description = ms?.description || '';
  const category = ms?.category || 'general';
  const dateVal = ms?.date?.seconds
    ? new Date(ms.date.seconds * 1000).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  const imageUrl = ms?.imageUrl || '';

  const categoryOptions = Object.entries(CATEGORIES).map(([key, cat]) =>
    `<option value="${key}" ${category === key ? 'selected' : ''}>${cat.label}</option>`
  ).join('');

  const imgPreviewHtml = imageUrl
    ? `<img src="${imageUrl}" class="ms-form-img-preview" id="ms-img-preview">`
    : '';

  renderWorkspace(`
    <div class="detail-header">
      <button class="detail-back" onclick="window.location.hash='milestones'"><i class="fa-solid fa-arrow-left"></i> Volver</button>
      <input type="text" class="form-input" id="ms-title" placeholder="Nombre del hito..." value="${escapeHtml(title)}" style="font-size:18px;font-weight:700;background:transparent;border:1px solid transparent;padding:4px 8px;flex:1;max-width:500px;">
      <div class="detail-actions">
        <button class="btn btn-primary btn-sm" id="btn-save-ms"><i class="fa-solid fa-check"></i> Guardar</button>
        ${!isNew ? `<button class="btn btn-danger btn-sm" id="btn-delete-ms"><i class="fa-solid fa-trash"></i> Eliminar</button>` : ''}
      </div>
    </div>

    <div class="form-container" style="max-width:700px;">
      <input type="hidden" id="ms-image-url" value="${escapeHtml(imageUrl)}">

      <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group">
          <label class="form-label">Fecha</label>
          <input type="date" class="form-input" id="ms-date" value="${dateVal}">
        </div>
        <div class="form-group">
          <label class="form-label">Categoría</label>
          <select class="form-select" id="ms-category">
            ${categoryOptions}
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Descripción (opcional)</label>
        <textarea class="form-input" id="ms-description" rows="3" placeholder="Contanos sobre este hito...">${escapeHtml(description)}</textarea>
      </div>

      <div class="form-group">
        <label class="form-label">Imagen (opcional)</label>
        <div class="ms-form-image-area">
          ${imgPreviewHtml}
          <div class="ms-form-image-actions" id="ms-image-actions">
            <div class="image-upload" id="ms-image-upload">
              <div class="image-upload-icon"><i class="fa-solid fa-image"></i></div>
              <div class="image-upload-text">Subir imagen</div>
              <input type="file" accept="image/*" id="ms-image-file" style="display:none;">
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="text" class="form-input" id="ms-image-url-input" placeholder="o pegá una URL..." style="flex:1;font-size:13px;">
              <button class="btn btn-ghost btn-sm" id="btn-apply-ms-url" title="Aplicar URL">OK</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `);

  // --- Event Bindings ---

  // File upload
  const fileInput = document.getElementById('ms-image-file');
  const uploadDiv = document.getElementById('ms-image-upload');
  uploadDiv.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleImageFile);

  // URL apply
  document.getElementById('btn-apply-ms-url')?.addEventListener('click', applyImageUrl);
  document.getElementById('ms-image-url-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyImageUrl();
  });

  // Save
  document.getElementById('btn-save-ms')?.addEventListener('click', saveMilestone);

  // Delete
  if (!isNew) {
    document.getElementById('btn-delete-ms')?.addEventListener('click', async () => {
      const ok = await confirm('¿Eliminás este hito?');
      if (ok) {
        await remove('milestones', currentMsId);
        showToast('Hito eliminado', 'success');
        window.location.hash = 'milestones';
      }
    });
  }

  // --- Image Handlers ---

  function handleImageFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('ms-image-url').value = e.target.result;
      document.getElementById('ms-image-url-input').value = '';
      showImagePreview(e.target.result);
      showToast('Imagen cargada', 'success');
    };
    reader.readAsDataURL(file);
  }

  function applyImageUrl() {
    const url = document.getElementById('ms-image-url-input')?.value.trim();
    if (!url) {
      showToast('Escribí una URL primero', 'error');
      return;
    }
    document.getElementById('ms-image-url').value = url;
    showImagePreview(url);
    showToast('Imagen aplicada', 'success');
  }

  function showImagePreview(src) {
    const actionsDiv = document.getElementById('ms-image-actions');
    let preview = document.getElementById('ms-img-preview');
    if (preview) {
      preview.src = src;
    } else {
      preview = document.createElement('img');
      preview.src = src;
      preview.className = 'ms-form-img-preview';
      preview.id = 'ms-img-preview';
      preview.onerror = () => {
        showToast('No se pudo cargar la imagen', 'error');
        preview.remove();
      };
      const container = actionsDiv?.parentElement;
      if (container) container.insertBefore(preview, actionsDiv);
    }
  }

  // --- Save ---

  async function saveMilestone() {
    const titleVal = document.getElementById('ms-title').value.trim();
    if (!titleVal) {
      showToast('Ponle un nombre al hito', 'error');
      document.getElementById('ms-title').focus();
      return;
    }

    const dateStr = document.getElementById('ms-date').value;
    const data = {
      title: titleVal,
      description: document.getElementById('ms-description').value.trim(),
      category: document.getElementById('ms-category').value,
      date: dateStr ? new Date(dateStr + 'T00:00:00') : null,
      imageUrl: document.getElementById('ms-image-url').value
    };

    try {
      if (isNew || !currentMsId) {
        const id = await create('milestones', data);
        currentMsId = id;
        isNew = false;
        showToast('Hito creado', 'success');
        window.history.replaceState(null, '', '#milestones/' + id);
      } else {
        await update('milestones', currentMsId, data);
        showToast('Hito actualizado', 'success');
      }
      window.location.hash = 'milestones';
    } catch (err) {
      console.error(err);
      showToast('Error al guardar: ' + err.message, 'error');
    }
  }
}
