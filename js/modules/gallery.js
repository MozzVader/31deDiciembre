// ============================================
// Modulo: Gallery — Referencias Visuales / Moodboard
// ============================================
import { getAll, getOne, create, update, remove } from '../db.js';
import { renderWorkspace, setBreadcrumbs, showToast, showModal, closeModal, escapeHtml, confirm, updateBadge } from '../ui.js';

// ============================================
// Constants
// ============================================

const CATEGORIES = {
  personajes:  { label: 'Personajes',    icon: 'fa-user',          color: '#60a5fa' },
  ambientes:   { label: 'Ambientes',     icon: 'fa-mountain-sun',  color: '#34d399' },
  interfaces:  { label: 'Interfaces UI', icon: 'fa-display',       color: '#c084fc' },
  paletas:     { label: 'Paletas',       icon: 'fa-palette',       color: '#f472b6' },
  conceptos:   { label: 'Concept Art',   icon: 'fa-lightbulb',     color: '#fbbf24' },
  referencias: { label: 'Referencias',   icon: 'fa-bookmark',      color: '#fb923c' },
  misc:        { label: 'Miscelaneo',    icon: 'fa-folder',        color: '#94a3b8' }
};

let activeFilter = 'all';
let activeSearch = '';

// ============================================
// List View
// ============================================

export async function renderGalleryList() {
  setBreadcrumbs([{ label: 'Gallery' }]);
  renderWorkspace('<div class="loading"><div class="spinner"></div></div>');

  try {
    const images = await getAll('gallery');
    updateBadge('gallery', images.length);

    // Build filter tabs
    const catCounts = {};
    Object.keys(CATEGORIES).forEach(k => { catCounts[k] = 0; });
    images.forEach(img => {
      if (CATEGORIES[img.category]) catCounts[img.category]++;
    });

    // Filter and search
    let filtered = images;
    if (activeFilter !== 'all') {
      filtered = filtered.filter(img => img.category === activeFilter);
    }
    if (activeSearch.trim()) {
      const q = activeSearch.toLowerCase();
      filtered = filtered.filter(img =>
        (img.name || '').toLowerCase().includes(q) ||
        (img.description || '').toLowerCase().includes(q) ||
        (img.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }

    // Sort by createdAt desc
    filtered.sort((a, b) => {
      const at = a.createdAt?.seconds || 0;
      const bt = b.createdAt?.seconds || 0;
      return bt - at;
    });

    if (images.length === 0) {
      renderWorkspace(`
        <div class="empty-state">
          <div class="empty-state-icon"><i class="fa-solid fa-images" style="font-size:48px;"></i></div>
          <div class="empty-state-title">Aun no hay referencias</div>
          <div class="empty-state-text">Subi imagenes de referencia, mood boards, concept art, paletas de color o cualquier inspiracion visual para tu aventura grafica.</div>
          <button class="btn btn-primary" onclick="window.location.hash='gallery/new'">
            <i class="fa-solid fa-plus"></i> Subir Imagen
          </button>
        </div>
      `);
      return;
    }

    const filterHtml = buildFilterTabs(catCounts, images.length);

    // Build search bar
    const searchHtml = `
      <div class="gallery-search-row">
        <div class="gallery-search">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" class="gallery-search-input" id="gallery-search" value="${escapeHtml(activeSearch)}" placeholder="Buscar por nombre, descripcion o tag...">
          ${activeSearch ? `<button class="gallery-search-clear" id="gallery-search-clear"><i class="fa-solid fa-xmark"></i></button>` : ''}
        </div>
        <div class="gallery-count">${filtered.length} imagen${filtered.length !== 1 ? 'es' : ''}</div>
      </div>
    `;

    // Build masonry grid
    const gridHtml = filtered.map(img => buildImageCard(img)).join('');

    renderWorkspace(`
      <div class="workspace-header">
        <div>
          <div class="workspace-title">Gallery</div>
          <div class="workspace-subtitle">Referencias visuales y mood board de tu aventura</div>
        </div>
        <button class="btn btn-primary" onclick="window.location.hash='gallery/new'">
          <i class="fa-solid fa-plus"></i> Subir Imagen
        </button>
      </div>
      ${filterHtml}
      ${searchHtml}
      <div class="gallery-grid" id="gallery-grid">
        ${gridHtml}
      </div>
      ${filtered.length === 0 && (activeFilter !== 'all' || activeSearch) ? `
        <div class="gallery-no-results">
          <i class="fa-solid fa-filter-circle-xmark"></i>
          <span>No hay resultados para este filtro.</span>
          <button class="btn btn-ghost btn-sm" onclick="resetGalleryFilters()">Limpiar filtros</button>
        </div>
      ` : ''}
    `);

    // Bind filter clicks
    document.querySelectorAll('.gallery-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.filter;
        renderGalleryList();
      });
    });

    // Bind search
    const searchInput = document.getElementById('gallery-search');
    let searchTimer = null;
    searchInput?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        activeSearch = searchInput.value;
        renderGalleryList();
      }, 200);
    });

    document.getElementById('gallery-search-clear')?.addEventListener('click', () => {
      activeSearch = '';
      renderGalleryList();
    });

    // Bind lightbox
    document.querySelectorAll('.gallery-card-img').forEach(img => {
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = img.closest('.gallery-card');
        const imgId = card?.dataset.id;
        if (imgId) openLightbox(imgId, images);
      });
    });

    // Expose reset function
    window.resetGalleryFilters = () => {
      activeFilter = 'all';
      activeSearch = '';
      renderGalleryList();
    };

  } catch (err) {
    console.error('Gallery list error:', err);
    renderWorkspace(`
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-triangle-exclamation" style="font-size:48px;"></i></div>
        <div class="empty-state-title">Error al cargar la gallery</div>
        <div class="empty-state-text">${escapeHtml(err.message)}</div>
      </div>
    `);
  }
}

// ============================================
// Build Image Card
// ============================================

function buildImageCard(img) {
  const cat = CATEGORIES[img.category] || CATEGORIES.misc;
  const tags = (img.tags || []).slice(0, 3);
  const tagsOverflow = (img.tags || []).length - 3;

  return `
    <div class="gallery-card" data-id="${img.id}" onclick="window.location.hash='gallery/${img.id}'">
      <div class="gallery-card-img-wrapper">
        ${img.imageUrl
          ? `<img class="gallery-card-img" src="${escapeHtml(img.imageUrl)}" alt="${escapeHtml(img.name || '')}" loading="lazy">`
          : `<div class="gallery-card-img-placeholder"><i class="fa-solid fa-image"></i></div>`
        }
        <div class="gallery-card-badge" style="background:${cat.color};">
          <i class="fa-solid ${cat.icon}"></i>
        </div>
      </div>
      <div class="gallery-card-body">
        <div class="gallery-card-name">${escapeHtml(img.name || 'Sin nombre')}</div>
        ${img.description ? `<div class="gallery-card-desc">${escapeHtml(img.description)}</div>` : ''}
        ${tags.length > 0 ? `
          <div class="gallery-card-tags">
            ${tags.map(t => `<span class="gallery-tag">${escapeHtml(t)}</span>`).join('')}
            ${tagsOverflow > 0 ? `<span class="gallery-tag gallery-tag-more">+${tagsOverflow}</span>` : ''}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// ============================================
// Filter Tabs
// ============================================

function buildFilterTabs(catCounts, total) {
  let html = `<div class="gallery-filters">
    <button class="gallery-filter-btn ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">
      Todas <span class="gallery-filter-count">${total}</span>
    </button>`;

  Object.entries(CATEGORIES).forEach(([key, cat]) => {
    const count = catCounts[key] || 0;
    if (count > 0) {
      html += `
        <button class="gallery-filter-btn ${activeFilter === key ? 'active' : ''}" data-filter="${key}">
          <i class="fa-solid ${cat.icon}"></i> ${cat.label} <span class="gallery-filter-count">${count}</span>
        </button>`;
    }
  });

  html += '</div>';
  return html;
}

// ============================================
// Lightbox
// ============================================

function openLightbox(imgId, allImages) {
  const img = allImages.find(i => i.id === imgId);
  if (!img) return;

  const cat = CATEGORIES[img.category] || CATEGORIES.misc;

  const body = `
    <div class="gallery-lightbox">
      <div class="gallery-lightbox-img">
        ${img.imageUrl
          ? `<img src="${escapeHtml(img.imageUrl)}" alt="${escapeHtml(img.name || '')}">`
          : `<div class="gallery-lightbox-placeholder"><i class="fa-solid fa-image" style="font-size:64px;"></i></div>`
        }
      </div>
      <div class="gallery-lightbox-info">
        <div class="gallery-lightbox-name">${escapeHtml(img.name || 'Sin nombre')}</div>
        <div class="gallery-lightbox-cat" style="color:${cat.color};">
          <i class="fa-solid ${cat.icon}"></i> ${cat.label}
        </div>
        ${img.description ? `<div class="gallery-lightbox-desc">${escapeHtml(img.description)}</div>` : ''}
        ${(img.tags || []).length > 0 ? `
          <div class="gallery-lightbox-tags">
            ${(img.tags || []).map(t => `<span class="gallery-tag">${escapeHtml(t)}</span>`).join('')}
          </div>
        ` : ''}
        <div class="gallery-lightbox-actions">
          <a href="#gallery/${img.id}" class="btn btn-ghost btn-sm"><i class="fa-solid fa-pen"></i> Editar</a>
          <a href="${escapeHtml(img.imageUrl || '#')}" target="_blank" class="btn btn-ghost btn-sm" ${img.imageUrl ? '' : 'style="display:none;"'}><i class="fa-solid fa-up-right-from-square"></i> Abrir original</a>
        </div>
      </div>
    </div>
  `;

  showModal('', body, '');
  // Center the modal for lightbox
  const modal = document.getElementById('modal');
  if (modal) {
    modal.classList.add('modal-lightbox');
  }
}

// ============================================
// Upload / Edit Form
// ============================================

export async function renderGalleryForm(imageId = null) {
  const isNew = !imageId;
  setBreadcrumbs([
    { label: 'Gallery', hash: 'gallery' },
    { label: isNew ? 'Subir Imagen' : 'Editar Imagen' }
  ]);
  renderWorkspace('<div class="loading"><div class="spinner"></div></div>');

  try {
    const image = imageId ? await getOne('gallery', imageId) : null;

    if (imageId && !image) {
      showToast('Imagen no encontrada', 'error');
      window.location.hash = 'gallery';
      return;
    }

    const catOptions = Object.entries(CATEGORIES).map(([key, cat]) =>
      `<option value="${key}" ${image?.category === key ? 'selected' : ''}>${cat.label}</option>`
    ).join('');

    const rooms = await getAll('rooms');
    const roomOptions = rooms.map(r => `<option value="${r.name}" ${image?.room === r.name ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('');

    renderWorkspace(`
      <div class="form-container" style="max-width:740px;">
        <!-- Header -->
        <div class="detail-header">
          <button class="detail-back" onclick="window.location.hash='gallery'">
            <i class="fa-solid fa-arrow-left"></i> Gallery
          </button>
          <input type="text" class="form-input" id="gallery-name" value="${escapeHtml(image?.name || '')}" placeholder="Nombre de la referencia..." style="flex:1;max-width:400px;">
          <div class="detail-actions">
            <button class="btn btn-ghost btn-sm" id="btn-save-gallery" title="Guardar">
              <i class="fa-solid fa-floppy-disk"></i> Guardar
            </button>
            ${!isNew ? `
              <button class="btn btn-danger btn-sm" id="btn-delete-gallery" title="Eliminar">
                <i class="fa-solid fa-trash"></i>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Image Preview / Upload -->
        <div class="gallery-upload-area" id="gallery-upload-area">
          ${image?.imageUrl ? `
            <div class="gallery-upload-preview">
              <img src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.name || '')}" id="gallery-preview-img">
              <button class="gallery-upload-remove" id="gallery-upload-remove" title="Quitar imagen">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          ` : `
            <div class="gallery-upload-placeholder" id="gallery-upload-placeholder">
              <i class="fa-solid fa-cloud-arrow-up"></i>
              <div class="gallery-upload-text">Arrastra una imagen aca o click para seleccionar</div>
              <div class="gallery-upload-hint">JPG, PNG, GIF, WebP — Max 5MB</div>
            </div>
          `}
          <input type="file" id="gallery-file-input" accept="image/*" style="display:none;">
        </div>

        <!-- URL fallback -->
        <div class="form-group">
          <label class="form-label">O URL externa</label>
          <input type="text" class="form-input" id="gallery-url" value="${escapeHtml(image?.imageUrl || '')}" placeholder="https://ejemplo.com/imagen.jpg">
          <div class="form-hint">Si no subis un archivo, pega una URL de imagen externa</div>
        </div>

        <!-- Metadata -->
        <div class="form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:4px;">
          <div class="form-group">
            <label class="form-label">Categoria</label>
            <select class="form-select" id="gallery-category">
              ${catOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Habitacion relacionada</label>
            <select class="form-select" id="gallery-room">
              <option value="">-- Sin asignar --</option>
              ${roomOptions}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Descripcion</label>
          <textarea class="form-textarea" id="gallery-description" rows="3" placeholder="Describe la referencia: estilo, colores, que te inspira...">${escapeHtml(image?.description || '')}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Tags</label>
          <input type="text" class="form-input" id="gallery-tags" value="${(image?.tags || []).join(', ')}" placeholder="Separados por coma: cyberpunk, neon, oscuro">
        </div>
      </div>
    `);

    // ---- Bind Events ----

    // Save
    document.getElementById('btn-save-gallery').addEventListener('click', () => saveGallery(imageId));

    // Delete
    if (!isNew) {
      document.getElementById('btn-delete-gallery').addEventListener('click', () => deleteGallery(imageId));
    }

    // File upload — click to open
    const uploadArea = document.getElementById('gallery-upload-area');
    const fileInput = document.getElementById('gallery-file-input');
    const placeholder = document.getElementById('gallery-upload-placeholder');
    const removeBtn = document.getElementById('gallery-upload-remove');

    placeholder?.addEventListener('click', () => fileInput?.click());
    uploadArea?.addEventListener('click', (e) => {
      if (e.target.closest('.gallery-upload-preview')) return;
      if (e.target === uploadArea || e.target.closest('.gallery-upload-placeholder')) {
        fileInput?.click();
      }
    });

    // Drag & drop
    uploadArea?.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('gallery-upload-dragover');
    });
    uploadArea?.addEventListener('dragleave', () => {
      uploadArea.classList.remove('gallery-upload-dragover');
    });
    uploadArea?.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('gallery-upload-dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) processFile(file);
    });

    // File input change
    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) processFile(file);
    });

    // Remove image
    removeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const urlInput = document.getElementById('gallery-url');
      if (urlInput) urlInput.value = '';
      const previewContainer = document.querySelector('.gallery-upload-preview');
      if (previewContainer) {
        previewContainer.remove();
      }
      // Re-add placeholder
      const newPlaceholder = document.createElement('div');
      newPlaceholder.className = 'gallery-upload-placeholder';
      newPlaceholder.id = 'gallery-upload-placeholder';
      newPlaceholder.innerHTML = `
        <i class="fa-solid fa-cloud-arrow-up"></i>
        <div class="gallery-upload-text">Arrastra una imagen aca o click para seleccionar</div>
        <div class="gallery-upload-hint">JPG, PNG, GIF, WebP — Max 5MB</div>
      `;
      uploadArea.appendChild(newPlaceholder);
      newPlaceholder.addEventListener('click', () => fileInput?.click());
    });

    // URL input preview
    document.getElementById('gallery-url')?.addEventListener('change', (e) => {
      const url = e.target.value.trim();
      if (url) {
        // Show preview from URL
        showUrlPreview(url, uploadArea);
      }
    });

  } catch (err) {
    console.error('Gallery form error:', err);
    renderWorkspace(`
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-triangle-exclamation" style="font-size:48px;"></i></div>
        <div class="empty-state-title">Error al cargar</div>
        <div class="empty-state-text">${escapeHtml(err.message)}</div>
      </div>
    `);
  }
}

// ============================================
// Process File (resize + base64)
// ============================================

function processFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Solo se permiten imagenes', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('La imagen no puede superar los 5MB', 'error');
    return;
  }

  // Resize to max 1200px on longest side, compress to JPEG
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 1200;
      let w = img.width;
      let h = img.height;

      if (w > MAX || h > MAX) {
        if (w > h) {
          h = Math.round(h * MAX / w);
          w = MAX;
        } else {
          w = Math.round(w * MAX / h);
          h = MAX;
        }
      }

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      const base64 = canvas.toDataURL('image/jpeg', 0.8);

      // Update preview
      showPreviewFromData(base64);
      // Set URL field
      const urlInput = document.getElementById('gallery-url');
      if (urlInput) urlInput.value = base64;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function showPreviewFromData(base64) {
  const uploadArea = document.getElementById('gallery-upload-area');
  if (!uploadArea) return;

  // Remove old placeholder/preview
  const oldPlaceholder = document.getElementById('gallery-upload-placeholder');
  const oldPreview = document.querySelector('.gallery-upload-preview');
  if (oldPlaceholder) oldPlaceholder.remove();
  if (oldPreview) oldPreview.remove();

  const preview = document.createElement('div');
  preview.className = 'gallery-upload-preview';
  preview.innerHTML = `
    <img src="${base64}" alt="Preview" id="gallery-preview-img">
    <button class="gallery-upload-remove" id="gallery-upload-remove" title="Quitar imagen">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;
  uploadArea.appendChild(preview);

  const fileInput = document.getElementById('gallery-file-input');

  preview.querySelector('#gallery-upload-remove')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const urlInput = document.getElementById('gallery-url');
    if (urlInput) urlInput.value = '';
    preview.remove();
    // Re-add placeholder
    const newPlaceholder = document.createElement('div');
    newPlaceholder.className = 'gallery-upload-placeholder';
    newPlaceholder.id = 'gallery-upload-placeholder';
    newPlaceholder.innerHTML = `
      <i class="fa-solid fa-cloud-arrow-up"></i>
      <div class="gallery-upload-text">Arrastra una imagen aca o click para seleccionar</div>
      <div class="gallery-upload-hint">JPG, PNG, GIF, WebP — Max 5MB</div>
    `;
    uploadArea.appendChild(newPlaceholder);
    newPlaceholder.addEventListener('click', () => fileInput?.click());
  });
}

function showUrlPreview(url, uploadArea) {
  if (!uploadArea) return;

  const oldPlaceholder = document.getElementById('gallery-upload-placeholder');
  const oldPreview = document.querySelector('.gallery-upload-preview');
  if (oldPlaceholder) oldPlaceholder.remove();
  if (oldPreview) oldPreview.remove();

  const preview = document.createElement('div');
  preview.className = 'gallery-upload-preview';
  preview.innerHTML = `
    <img src="${escapeHtml(url)}" alt="Preview" id="gallery-preview-img">
    <button class="gallery-upload-remove" id="gallery-upload-remove" title="Quitar imagen">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;
  uploadArea.appendChild(preview);

  const fileInput = document.getElementById('gallery-file-input');

  preview.querySelector('#gallery-upload-remove')?.addEventListener('click', (e) => {
    e.stopPropagation();
    preview.remove();
    const newPlaceholder = document.createElement('div');
    newPlaceholder.className = 'gallery-upload-placeholder';
    newPlaceholder.id = 'gallery-upload-placeholder';
    newPlaceholder.innerHTML = `
      <i class="fa-solid fa-cloud-arrow-up"></i>
      <div class="gallery-upload-text">Arrastra una imagen aca o click para seleccionar</div>
      <div class="gallery-upload-hint">JPG, PNG, GIF, WebP — Max 5MB</div>
    `;
    uploadArea.appendChild(newPlaceholder);
    newPlaceholder.addEventListener('click', () => fileInput?.click());
  });
}

// ============================================
// Save
// ============================================

async function saveGallery(imageId) {
  const name = document.getElementById('gallery-name').value.trim();
  if (!name) {
    showToast('El nombre es obligatorio', 'error');
    return;
  }

  const imageUrl = document.getElementById('gallery-url').value.trim();
  if (!imageUrl) {
    showToast('Subi una imagen o pega una URL', 'error');
    return;
  }

  const tagsRaw = document.getElementById('gallery-tags').value;
  const tags = tagsRaw ? tagsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

  const data = {
    name,
    imageUrl,
    description: document.getElementById('gallery-description').value.trim(),
    category: document.getElementById('gallery-category').value,
    room: document.getElementById('gallery-room').value,
    tags
  };

  try {
    if (imageId) {
      await update('gallery', imageId, data);
      showToast('Imagen actualizada', 'success');
    } else {
      const newId = await create('gallery', data);
      showToast('Imagen subida correctamente', 'success');
      window.location.hash = 'gallery/' + newId;
      return;
    }
    window.location.hash = 'gallery';
  } catch (err) {
    console.error('Save gallery error:', err);
    showToast('Error al guardar: ' + err.message, 'error');
  }
}

// ============================================
// Delete
// ============================================

async function deleteGallery(imageId) {
  const yes = await confirm('Eliminar esta imagen? Esta accion no se puede deshacer.');
  if (!yes) return;

  try {
    await remove('gallery', imageId);
    showToast('Imagen eliminada', 'success');
    window.location.hash = 'gallery';
  } catch (err) {
    console.error('Delete gallery error:', err);
    showToast('Error al eliminar: ' + err.message, 'error');
  }
}
