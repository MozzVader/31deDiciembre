// ============================================
// Modulo: Puzzle Designer — Diseno de Rompecabezas
// ============================================
import { getAll, getOne, create, update, remove, generateId } from '../db.js';
import { renderWorkspace, setBreadcrumbs, updateBadge, showToast, showModal, closeModal, escapeHtml, confirm } from '../ui.js';

// ============================================
// Constants
// ============================================

const DIFFICULTIES = [
  { value: 'facil',     label: 'Facil',       icon: 'fa-face-smile',    color: '#4ade80' },
  { value: 'moderado',  label: 'Moderado',    icon: 'fa-face-meh',      color: '#fbbf24' },
  { value: 'dificil',   label: 'Dificil',     icon: 'fa-face-frown',    color: '#f87171' },
  { value: 'experto',   label: 'Experto',     icon: 'fa-fire',          color: '#c084fc' }
];

const STATUSES = [
  { value: 'borrador',   label: 'Borrador',    color: 'var(--text-muted)' },
  { value: 'disenio',    label: 'En Diseno',   color: '#fbbf24' },
  { value: 'listo',      label: 'Listo',       color: '#4ade80' },
  { value: 'implementado', label: 'Implementado', color: 'var(--accent)' }
];

const STEP_TYPES = [
  { value: 'combinar',   label: 'Combinar Items',     icon: 'fa-link',          color: '#fbbf24' },
  { value: 'usar_item',  label: 'Usar Item en Objeto', icon: 'fa-hand-pointer', color: '#60a5fa' },
  { value: 'dialogo',    label: 'Dialogo Clave',       icon: 'fa-comments',     color: '#34d399' },
  { value: 'secuencia',  label: 'Secuencia de Acciones', icon: 'fa-list-ol',    color: '#c084fc' },
  { value: 'logica',     label: 'Logica / Acertijo',   icon: 'fa-brain',        color: '#f472b6' },
  { value: 'explorar',   label: 'Exploracion / Busqueda', icon: 'fa-magnifying-glass', color: '#fb923c' },
  { value: 'spatial',    label: 'Puzzle Espacial',     icon: 'fa-arrows-up-down-left-right', color: '#a78bfa' }
];

let activeFilter = 'all';

// ============================================
// List View
// ============================================

export async function renderPuzzlesList() {
  setBreadcrumbs([{ label: 'Puzzles' }]);
  renderWorkspace('<div class="loading"><div class="spinner"></div></div>');

  try {
    const puzzles = await getAll('puzzles');
    updateBadge('puzzles', puzzles.length);

    // Build filter tabs
    const difficultyCounts = {};
    DIFFICULTIES.forEach(d => { difficultyCounts[d.value] = 0; });
    puzzles.forEach(p => {
      if (difficultyCounts[p.difficulty] !== undefined) difficultyCounts[p.difficulty]++;
    });

    // Sort puzzles: by status priority then by name
    const statusOrder = { implementado: 0, listo: 1, disenio: 2, borrador: 3 };
    puzzles.sort((a, b) => {
      const sa = statusOrder[a.status] ?? 4;
      const sb = statusOrder[b.status] ?? 4;
      if (sa !== sb) return sa - sb;
      return (a.name || '').localeCompare(b.name || '');
    });

    const filtered = activeFilter === 'all'
      ? puzzles
      : puzzles.filter(p => p.difficulty === activeFilter);

    if (puzzles.length === 0) {
      renderWorkspace(`
        <div class="empty-state">
          <div class="empty-state-icon"><i class="fa-solid fa-puzzle-piece" style="font-size:48px;"></i></div>
          <div class="empty-state-title">Aun no hay puzzles</div>
          <div class="empty-state-text">Aca vas a disenar los rompecabezas, acertijos y desafios de tu aventura grafica. Cada puzzle puede tener multiples pasos y caminos alternativos.</div>
          <button class="btn btn-primary" onclick="window.location.hash='puzzles/new'">
            <i class="fa-solid fa-plus"></i> Crear Puzzle
          </button>
        </div>
      `);
      return;
    }

    const filterHtml = buildFilterTabs(difficultyCounts);

    const cardsHtml = filtered.map(p => {
      const diff = DIFFICULTIES.find(d => d.value === p.difficulty) || DIFFICULTIES[0];
      const stat = STATUSES.find(s => s.value === p.status) || STATUSES[0];
      const steps = p.steps || [];
      const totalPaths = steps.reduce((sum, s) => sum + (s.alternativePaths?.length || 0) + 1, 0);
      const roomLabel = p.room || '';
      const tags = (p.tags || []).slice(0, 3);
      const tagsOverflow = (p.tags || []).length - 3;

      return `
        <div class="puzzle-card" onclick="window.location.hash='puzzles/${p.id}'">
          <div class="puzzle-card-header">
            <div class="puzzle-card-icon" style="background:${diff.color}15; color:${diff.color}">
              <i class="fa-solid fa-puzzle-piece"></i>
            </div>
            <div class="puzzle-card-info">
              <div class="puzzle-card-name">${escapeHtml(p.name || 'Sin nombre')}</div>
              <div class="puzzle-card-meta">
                <span class="puzzle-card-diff" style="color:${diff.color}">
                  <i class="fa-solid ${diff.icon}"></i> ${diff.label}
                </span>
                <span class="puzzle-card-status" style="color:${stat.color}">
                  <i class="fa-solid fa-circle" style="font-size:6px;vertical-align:middle;"></i> ${stat.label}
                </span>
                ${roomLabel ? `<span class="puzzle-card-room"><i class="fa-solid fa-map-pin"></i> ${escapeHtml(roomLabel)}</span>` : ''}
              </div>
            </div>
          </div>
          ${p.description ? `<div class="puzzle-card-desc">${escapeHtml(p.description)}</div>` : ''}
          <div class="puzzle-card-footer">
            <div class="puzzle-card-stats">
              <span title="Pasos"><i class="fa-solid fa-list-ol"></i> ${steps.length} paso${steps.length !== 1 ? 's' : ''}</span>
              <span title="Caminos alternativos"><i class="fa-solid fa-code-branch"></i> ${totalPaths} camino${totalPaths !== 1 ? 's' : ''}</span>
            </div>
            ${tags.length > 0 ? `
              <div class="puzzle-card-tags">
                ${tags.map(t => `<span class="puzzle-tag">${escapeHtml(t)}</span>`).join('')}
                ${tagsOverflow > 0 ? `<span class="puzzle-tag puzzle-tag-more">+${tagsOverflow}</span>` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    renderWorkspace(`
      <div class="workspace-header">
        <div>
          <div class="workspace-title">Puzzle Designer</div>
          <div class="workspace-subtitle">Rompecabezas, acertijos y desafios de tu aventura</div>
        </div>
        <button class="btn btn-primary" onclick="window.location.hash='puzzles/new'">
          <i class="fa-solid fa-plus"></i> Nuevo Puzzle
        </button>
      </div>
      ${filterHtml}
      <div class="puzzle-grid">
        ${cardsHtml}
      </div>
    `);

    // Bind filter clicks
    document.querySelectorAll('.puzzle-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.filter;
        renderPuzzlesList();
      });
    });

  } catch (err) {
    console.error('Puzzles list error:', err);
    renderWorkspace(`
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-triangle-exclamation" style="font-size:48px;"></i></div>
        <div class="empty-state-title">Error al cargar puzzles</div>
        <div class="empty-state-text">${escapeHtml(err.message)}</div>
      </div>
    `);
  }
}

// ============================================
// Filter Tabs
// ============================================

function buildFilterTabs(difficultyCounts) {
  const total = Object.values(difficultyCounts).reduce((a, b) => a + b, 0);
  let html = `<div class="puzzle-filters">
    <button class="puzzle-filter-btn ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">
      Todas <span class="puzzle-filter-count">${total}</span>
    </button>`;

  DIFFICULTIES.forEach(d => {
    const count = difficultyCounts[d.value] || 0;
    html += `
      <button class="puzzle-filter-btn ${activeFilter === d.value ? 'active' : ''}" data-filter="${d.value}">
        <i class="fa-solid ${d.icon}"></i> ${d.label} <span class="puzzle-filter-count">${count}</span>
      </button>`;
  });

  html += '</div>';
  return html;
}

// ============================================
// Form View (Create / Edit)
// ============================================

export async function renderPuzzleForm(puzzleId = null) {
  const isNew = !puzzleId;
  setBreadcrumbs([
    { label: 'Puzzles', hash: 'puzzles' },
    { label: isNew ? 'Nuevo Puzzle' : 'Editar Puzzle' }
  ]);
  renderWorkspace('<div class="loading"><div class="spinner"></div></div>');

  try {
    // Fetch puzzle data and rooms
    const [puzzle, rooms] = await Promise.all([
      puzzleId ? getOne('puzzles', puzzleId) : null,
      getAll('rooms')
    ]);

    const steps = puzzle?.steps || [];
    const diff = DIFFICULTIES.find(d => d.value === puzzle?.difficulty) || DIFFICULTIES[0];

    // Build room select options
    const roomOptions = rooms.map(r => `<option value="${r.name}" ${puzzle?.room === r.name ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('');

    renderWorkspace(`
      <div class="puzzle-form-container">
        <!-- Detail Header -->
        <div class="detail-header">
          <button class="detail-back" onclick="window.location.hash='puzzles'">
            <i class="fa-solid fa-arrow-left"></i> Puzzles
          </button>
          <input type="text" class="puzzle-name-input" id="puzzle-name" value="${escapeHtml(puzzle?.name || '')}" placeholder="Nombre del puzzle...">
          <div class="detail-actions">
            <button class="btn btn-ghost btn-sm" id="btn-save-puzzle" title="Guardar">
              <i class="fa-solid fa-floppy-disk"></i> Guardar
            </button>
            ${!isNew ? `
              <button class="btn btn-danger btn-sm" id="btn-delete-puzzle" title="Eliminar puzzle">
                <i class="fa-solid fa-trash"></i>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Metadata Row -->
        <div class="puzzle-meta-row">
          <div class="form-group" style="flex:1;">
            <label class="form-label">Dificultad</label>
            <select class="form-select" id="puzzle-difficulty">
              ${DIFFICULTIES.map(d => `<option value="${d.value}" ${puzzle?.difficulty === d.value ? 'selected' : ''}>${d.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">Estado</label>
            <select class="form-select" id="puzzle-status">
              ${STATUSES.map(s => `<option value="${s.value}" ${puzzle?.status === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">Habitacion</label>
            <select class="form-select" id="puzzle-room">
              <option value="">-- Sin asignar --</option>
              ${roomOptions}
            </select>
          </div>
        </div>

        <!-- Description -->
        <div class="form-group">
          <label class="form-label">Descripcion</label>
          <textarea class="form-textarea" id="puzzle-description" rows="3" placeholder="Describe el puzzle, su contexto narrativo y que debe lograr el jugador...">${escapeHtml(puzzle?.description || '')}</textarea>
        </div>

        <!-- Tags -->
        <div class="form-group">
          <label class="form-label">Tags</label>
          <input type="text" class="form-input" id="puzzle-tags" value="${(puzzle?.tags || []).join(', ')}" placeholder="Separados por coma: cocina, inventario, optional">
          <div class="form-hint">Etiquetas para organizar y filtrar puzzles</div>
        </div>

        <div class="form-section-divider"></div>

        <!-- Steps Section -->
        <div class="puzzle-steps-section">
          <div class="puzzle-steps-header">
            <div>
              <h3 class="puzzle-steps-title">
                <i class="fa-solid fa-list-check"></i> Pasos del Puzzle
              </h3>
              <div class="puzzle-steps-subtitle">
                ${steps.length === 0
                  ? 'Agrega pasos para definir como se resuelve el puzzle. Cada paso puede tener multiples caminos alternativos.'
                  : `${steps.length} paso${steps.length !== 1 ? 's' : ''} definidos. Arrastra mentalmente el orden logico.`
                }
              </div>
            </div>
            <button class="btn btn-primary btn-sm" id="btn-add-step">
              <i class="fa-solid fa-plus"></i> Agregar Paso
            </button>
          </div>

          <div class="puzzle-steps-list" id="puzzle-steps-list">
            ${renderStepsList(steps)}
          </div>
        </div>

        <div class="form-section-divider"></div>

        <!-- Reward Section -->
        <div class="puzzle-reward-section">
          <h3 class="puzzle-reward-title">
            <i class="fa-solid fa-gift"></i> Recompensa al Completar
          </h3>
          <div class="puzzle-meta-row" style="margin-top:12px;">
            <div class="form-group" style="flex:1;">
              <label class="form-label">Tipo de Recompensa</label>
              <select class="form-select" id="puzzle-reward-type">
                <option value="">-- Sin recompensa --</option>
                <option value="item" ${puzzle?.reward?.type === 'item' ? 'selected' : ''}>Item</option>
                <option value="flag" ${puzzle?.reward?.type === 'flag' ? 'selected' : ''}>Flag</option>
                <option value="dialogue" ${puzzle?.reward?.type === 'dialogue' ? 'selected' : ''}>Dialogo</option>
              </select>
            </div>
            <div class="form-group" style="flex:2;">
              <label class="form-label">Slug / Nombre</label>
              <input type="text" class="form-input" id="puzzle-reward-slug" value="${escapeHtml(puzzle?.reward?.slug || '')}" placeholder="Ej: llave_cocina, puzzle_resuelto">
            </div>
            <div class="form-group" style="flex:2;">
              <label class="form-label">Descripcion de la Recompensa</label>
              <input type="text" class="form-input" id="puzzle-reward-desc" value="${escapeHtml(puzzle?.reward?.description || '')}" placeholder="Ej: El jugador recibe la llave de la cocina">
            </div>
          </div>
        </div>
      </div>
    `);

    // Bind events
    document.getElementById('btn-save-puzzle').addEventListener('click', () => savePuzzle(puzzleId));
    if (!isNew) {
      document.getElementById('btn-delete-puzzle').addEventListener('click', () => deletePuzzle(puzzleId));
    }
    document.getElementById('btn-add-step').addEventListener('click', () => addStep());

    // Bind step events
    bindStepEvents();

  } catch (err) {
    console.error('Puzzle form error:', err);
    renderWorkspace(`
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-triangle-exclamation" style="font-size:48px;"></i></div>
        <div class="empty-state-title">Error al cargar el puzzle</div>
        <div class="empty-state-text">${escapeHtml(err.message)}</div>
      </div>
    `);
  }
}

// ============================================
// Render Steps List
// ============================================

function renderStepsList(steps) {
  if (steps.length === 0) {
    return `
      <div class="puzzle-steps-empty">
        <i class="fa-solid fa-shoe-prints" style="font-size:24px;"></i>
        <span>No hay pasos todavia. Agrega el primer paso del puzzle.</span>
      </div>
    `;
  }

  return steps.map((step, idx) => {
    const stepType = STEP_TYPES.find(t => t.value === step.type) || STEP_TYPES[0];
    const altPaths = step.alternativePaths || [];
    const hasAlt = altPaths.length > 0;

    return `
      <div class="puzzle-step-card" data-step-idx="${idx}">
        <div class="puzzle-step-header">
          <div class="puzzle-step-number">Paso ${idx + 1}</div>
          <div class="puzzle-step-type" style="color:${stepType.color}">
            <i class="fa-solid ${stepType.icon}"></i> ${stepType.label}
          </div>
          <div class="puzzle-step-actions">
            <button class="btn btn-ghost btn-sm puzzle-step-edit-btn" data-idx="${idx}" title="Editar paso">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn btn-ghost btn-sm puzzle-step-delete-btn" data-idx="${idx}" title="Eliminar paso" style="color:var(--danger);">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>

        <div class="puzzle-step-body">
          <div class="puzzle-step-name">${escapeHtml(step.name || 'Paso sin nombre')}</div>
          ${step.description ? `<div class="puzzle-step-desc">${escapeHtml(step.description)}</div>` : ''}

          ${step.requiredItems?.length > 0 ? `
            <div class="puzzle-step-reqs">
              <span class="puzzle-req-label"><i class="fa-solid fa-box-open"></i> Items necesarios:</span>
              ${step.requiredItems.map(item => `<span class="puzzle-req-tag">${escapeHtml(item)}</span>`).join('')}
            </div>
          ` : ''}

          ${step.requiredFlags?.length > 0 ? `
            <div class="puzzle-step-reqs">
              <span class="puzzle-req-label"><i class="fa-solid fa-flag"></i> Flags necesarios:</span>
              ${step.requiredFlags.map(flag => `<span class="puzzle-req-tag puzzle-req-tag-flag">${escapeHtml(flag)}</span>`).join('')}
            </div>
          ` : ''}

          ${step.resultItem ? `
            <div class="puzzle-step-result">
              <i class="fa-solid fa-arrow-right-from-bracket"></i> Resultado: <strong>${escapeHtml(step.resultItem)}</strong>
            </div>
          ` : ''}

          ${step.hints?.length > 0 ? `
            <div class="puzzle-step-hints">
              <span class="puzzle-req-label"><i class="fa-solid fa-lightbulb"></i> Pistas:</span>
              ${step.hints.map(h => `<span class="puzzle-hint-tag">${escapeHtml(h)}</span>`).join('')}
            </div>
          ` : ''}

          ${hasAlt ? `
            <div class="puzzle-step-alt-paths">
              <div class="puzzle-alt-header">
                <i class="fa-solid fa-code-branch"></i> Caminos Alternativos (${altPaths.length})
              </div>
              ${altPaths.map((alt, altIdx) => `
                <div class="puzzle-alt-path">
                  <div class="puzzle-alt-path-header">
                    <i class="fa-solid fa-route"></i>
                    <span class="puzzle-alt-path-name">${escapeHtml(alt.name || `Camino alternativo ${altIdx + 1}`)}</span>
                    <button class="btn btn-ghost btn-sm puzzle-alt-edit-btn" data-step="${idx}" data-alt="${altIdx}" title="Editar camino">
                      <i class="fa-solid fa-pen" style="font-size:10px;"></i>
                    </button>
                    <button class="btn btn-ghost btn-sm puzzle-alt-delete-btn" data-step="${idx}" data-alt="${altIdx}" title="Eliminar camino" style="color:var(--danger);">
                      <i class="fa-solid fa-trash" style="font-size:10px;"></i>
                    </button>
                  </div>
                  ${alt.description ? `<div class="puzzle-alt-path-desc">${escapeHtml(alt.description)}</div>` : ''}
                  ${alt.requiredItems?.length > 0 ? `
                    <div class="puzzle-alt-path-reqs">
                      Items: ${alt.requiredItems.map(i => `<span class="puzzle-req-tag">${escapeHtml(i)}</span>`).join('')}
                    </div>
                  ` : ''}
                  ${alt.requiredFlags?.length > 0 ? `
                    <div class="puzzle-alt-path-reqs">
                      Flags: ${alt.requiredFlags.map(f => `<span class="puzzle-req-tag puzzle-req-tag-flag">${escapeHtml(f)}</span>`).join('')}
                    </div>
                  ` : ''}
                  ${alt.note ? `<div class="puzzle-alt-path-note"><i class="fa-solid fa-info-circle"></i> ${escapeHtml(alt.note)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>

        ${idx < steps.length - 1 ? `
          <div class="puzzle-step-connector">
            <div class="puzzle-step-connector-line"></div>
            <i class="fa-solid fa-chevron-down puzzle-step-connector-arrow"></i>
            <div class="puzzle-step-connector-line"></div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// ============================================
// Bind Step Events
// ============================================

function bindStepEvents() {
  // Edit step buttons
  document.querySelectorAll('.puzzle-step-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      editStep(parseInt(btn.dataset.idx));
    });
  });

  // Delete step buttons
  document.querySelectorAll('.puzzle-step-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      const yes = await confirm('Eliminar este paso y todos sus caminos alternativos?');
      if (!yes) return;
      removeStep(idx);
    });
  });

  // Edit alt path buttons
  document.querySelectorAll('.puzzle-alt-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      editAltPath(parseInt(btn.dataset.step), parseInt(btn.dataset.alt));
    });
  });

  // Delete alt path buttons
  document.querySelectorAll('.puzzle-alt-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const stepIdx = parseInt(btn.dataset.step);
      const altIdx = parseInt(btn.dataset.alt);
      const yes = await confirm('Eliminar este camino alternativo?');
      if (!yes) return;
      removeAltPath(stepIdx, altIdx);
    });
  });
}

// ============================================
// Get current steps from form
// ============================================

function getCurrentSteps() {
  const listEl = document.getElementById('puzzle-steps-list');
  if (!listEl) return [];
  const puzzle = getCurrentPuzzleFromForm();
  return puzzle.steps || [];
}

function getCurrentPuzzleFromForm() {
  // Reconstruct from DOM — each step card has its data
  const stepCards = document.querySelectorAll('.puzzle-step-card');
  const steps = [];

  stepCards.forEach((card, idx) => {
    // Extract step data from the hidden data stored in the card
    const stepData = card._stepData;
    if (stepData) {
      steps.push(stepData);
    }
  });

  return { steps };
}

// ============================================
// Add / Edit / Remove Steps (modals)
// ============================================

function addStep() {
  showStepModal(null, (stepData) => {
    const puzzleData = getCurrentPuzzleFromForm();
    puzzleData.steps.push(stepData);
    refreshStepsUI(puzzleData.steps);
  });
}

function editStep(idx) {
  const puzzleData = getCurrentPuzzleFromForm();
  const step = puzzleData.steps[idx];
  if (!step) return;

  showStepModal(step, (updatedStep) => {
    puzzleData.steps[idx] = updatedStep;
    refreshStepsUI(puzzleData.steps);
  });
}

function removeStep(idx) {
  const puzzleData = getCurrentPuzzleFromForm();
  puzzleData.steps.splice(idx, 1);
  refreshStepsUI(puzzleData.steps);
}

function addAltPath(stepIdx) {
  const puzzleData = getCurrentPuzzleFromForm();
  const step = puzzleData.steps[stepIdx];
  if (!step) return;

  showAltPathModal(null, (altData) => {
    if (!step.alternativePaths) step.alternativePaths = [];
    step.alternativePaths.push(altData);
    refreshStepsUI(puzzleData.steps);
  });
}

function editAltPath(stepIdx, altIdx) {
  const puzzleData = getCurrentPuzzleFromForm();
  const step = puzzleData.steps[stepIdx];
  if (!step || !step.alternativePaths) return;

  const alt = step.alternativePaths[altIdx];
  if (!alt) return;

  showAltPathModal(alt, (updatedAlt) => {
    step.alternativePaths[altIdx] = updatedAlt;
    refreshStepsUI(puzzleData.steps);
  });
}

function removeAltPath(stepIdx, altIdx) {
  const puzzleData = getCurrentPuzzleFromForm();
  const step = puzzleData.steps[stepIdx];
  if (!step || !step.alternativePaths) return;
  step.alternativePaths.splice(altIdx, 1);
  refreshStepsUI(puzzleData.steps);
}

// ============================================
// Refresh Steps UI
// ============================================

function refreshStepsUI(steps) {
  const listEl = document.getElementById('puzzle-steps-list');
  const headerEl = document.querySelector('.puzzle-steps-subtitle');
  if (!listEl) return;

  listEl.innerHTML = renderStepsList(steps);

  if (headerEl) {
    headerEl.textContent = steps.length === 0
      ? 'Agrega pasos para definir como se resuelve el puzzle.'
      : `${steps.length} paso${steps.length !== 1 ? 's' : ''} definidos.`;
  }

  // Store step data in DOM for retrieval
  const stepCards = listEl.querySelectorAll('.puzzle-step-card');
  stepCards.forEach((card, idx) => {
    card._stepData = steps[idx];
  });

  bindStepEvents();

  // Add "Agregar camino alternativo" button to each step that has alt paths or is being edited
  stepCards.forEach((card, idx) => {
    const bodyEl = card.querySelector('.puzzle-step-body');
    if (!bodyEl) return;

    const altBtn = document.createElement('button');
    altBtn.className = 'puzzle-add-alt-btn';
    altBtn.innerHTML = '<i class="fa-solid fa-code-branch"></i> Agregar camino alternativo';
    altBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      addAltPath(idx);
    });
    bodyEl.appendChild(altBtn);
  });
}

// ============================================
// Step Modal
// ============================================

function showStepModal(existingStep, onSave) {
  const step = existingStep || {
    name: '',
    description: '',
    type: 'combinar',
    requiredItems: [],
    requiredFlags: [],
    resultItem: '',
    hints: [],
    alternativePaths: []
  };

  const typeOptions = STEP_TYPES.map(t =>
    `<option value="${t.value}" ${step.type === t.value ? 'selected' : ''}>${t.label}</option>`
  ).join('');

  const modalBody = `
    <div class="puzzle-step-form">
      <div class="form-group">
        <label class="form-label">Nombre del Paso</label>
        <input type="text" class="form-input" id="modal-step-name" value="${escapeHtml(step.name)}" placeholder="Ej: Poner ingrediente en el vaso">
      </div>
      <div class="form-group">
        <label class="form-label">Tipo de Accion</label>
        <select class="form-select" id="modal-step-type">${typeOptions}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Descripcion</label>
        <textarea class="form-textarea" id="modal-step-desc" rows="2" placeholder="Describe que debe hacer el jugador...">${escapeHtml(step.description)}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Items Necesarios</label>
          <input type="text" class="form-input" id="modal-step-items" value="${(step.requiredItems || []).join(', ')}" placeholder="Separados por coma: vaso, fernet">
        </div>
        <div class="form-group">
          <label class="form-label">Flags Necesarios</label>
          <input type="text" class="form-input" id="modal-step-flags" value="${(step.requiredFlags || []).join(', ')}" placeholder="Separados por coma: puerta_abierta">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Item Resultado</label>
          <input type="text" class="form-input" id="modal-step-result" value="${escapeHtml(step.resultItem || '')}" placeholder="Ej: vaso_con_fernet">
          <div class="form-hint">El item u objeto que se obtiene/produce al completar este paso</div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Pistas para el Jugador</label>
        <input type="text" class="form-input" id="modal-step-hints" value="${(step.hints || []).join(', ')}" placeholder="Separadas por coma: Fijate en la alacena, Habla con el bartender">
      </div>
    </div>
  `;

  const modalFooter = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" id="modal-step-save"><i class="fa-solid fa-check"></i> Guardar Paso</button>
  `;

  // showModal and closeModal are already imported at the top of this file

  showModal(existingStep ? `Editar Paso` : `Nuevo Paso`, modalBody, modalFooter);

  document.getElementById('modal-step-save').addEventListener('click', () => {
    const name = document.getElementById('modal-step-name').value.trim();
    if (!name) {
      showToast('El nombre del paso es obligatorio', 'error');
      return;
    }

    const itemsRaw = document.getElementById('modal-step-items').value;
    const flagsRaw = document.getElementById('modal-step-flags').value;
    const hintsRaw = document.getElementById('modal-step-hints').value;

    const stepData = {
      name,
      type: document.getElementById('modal-step-type').value,
      description: document.getElementById('modal-step-desc').value.trim(),
      requiredItems: itemsRaw ? itemsRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
      requiredFlags: flagsRaw ? flagsRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
      resultItem: document.getElementById('modal-step-result').value.trim(),
      hints: hintsRaw ? hintsRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
      alternativePaths: step.alternativePaths || []
    };

    onSave(stepData);
    closeModal();
  });
}

// ============================================
// Alternative Path Modal
// ============================================

function showAltPathModal(existingAlt, onSave) {
  const alt = existingAlt || {
    name: '',
    description: '',
    requiredItems: [],
    requiredFlags: [],
    note: ''
  };

  const modalBody = `
    <div class="puzzle-alt-form">
      <div class="form-group">
        <label class="form-label">Nombre del Camino</label>
        <input type="text" class="form-input" id="modal-alt-name" value="${escapeHtml(alt.name)}" placeholder="Ej: Poner fernet primero">
      </div>
      <div class="form-group">
        <label class="form-label">Descripcion</label>
        <textarea class="form-textarea" id="modal-alt-desc" rows="2" placeholder="Describe esta variante del paso...">${escapeHtml(alt.description)}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Items Necesarios</label>
          <input type="text" class="form-input" id="modal-alt-items" value="${(alt.requiredItems || []).join(', ')}" placeholder="Separados por coma: fernet, vaso">
        </div>
        <div class="form-group">
          <label class="form-label">Flags Necesarios</label>
          <input type="text" class="form-input" id="modal-alt-flags" value="${(alt.requiredFlags || []).join(', ')}" placeholder="Separados por coma">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Nota del Disenador</label>
        <input type="text" class="form-input" id="modal-alt-note" value="${escapeHtml(alt.note || '')}" placeholder="Notas internas: ambos caminos llevan al mismo resultado">
        <div class="form-hint">Nota visible solo para el disenador, no para el jugador</div>
      </div>
    </div>
  `;

  const modalFooter = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" id="modal-alt-save"><i class="fa-solid fa-check"></i> Guardar Camino</button>
  `;

  showModal(existingAlt ? 'Editar Camino Alternativo' : 'Nuevo Camino Alternativo', modalBody, modalFooter);

  document.getElementById('modal-alt-save').addEventListener('click', () => {
    const name = document.getElementById('modal-alt-name').value.trim();
    if (!name) {
      showToast('El nombre del camino es obligatorio', 'error');
      return;
    }

    const itemsRaw = document.getElementById('modal-alt-items').value;
    const flagsRaw = document.getElementById('modal-alt-flags').value;

    const altData = {
      name,
      description: document.getElementById('modal-alt-desc').value.trim(),
      requiredItems: itemsRaw ? itemsRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
      requiredFlags: flagsRaw ? flagsRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
      note: document.getElementById('modal-alt-note').value.trim()
    };

    onSave(altData);
    closeModal();
  });
}

// ============================================
// Save Puzzle
// ============================================

async function savePuzzle(puzzleId) {
  const name = document.getElementById('puzzle-name').value.trim();
  if (!name) {
    showToast('El nombre del puzzle es obligatorio', 'error');
    return;
  }

  // Get steps from DOM
  const puzzleData = getCurrentPuzzleFromForm();

  const tagsRaw = document.getElementById('puzzle-tags').value;
  const tags = tagsRaw ? tagsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

  const rewardType = document.getElementById('puzzle-reward-type').value;
  const rewardSlug = document.getElementById('puzzle-reward-slug').value.trim();
  const rewardDesc = document.getElementById('puzzle-reward-desc').value.trim();

  const data = {
    name,
    description: document.getElementById('puzzle-description').value.trim(),
    difficulty: document.getElementById('puzzle-difficulty').value,
    status: document.getElementById('puzzle-status').value,
    room: document.getElementById('puzzle-room').value,
    tags,
    steps: puzzleData.steps,
    reward: rewardType ? {
      type: rewardType,
      slug: rewardSlug,
      description: rewardDesc
    } : null
  };

  try {
    if (puzzleId) {
      await update('puzzles', puzzleId, data);
      showToast('Puzzle actualizado correctamente', 'success');
    } else {
      const newId = await create('puzzles', data);
      showToast('Puzzle creado correctamente', 'success');
      // Navigate to edit mode
      window.location.hash = 'puzzles/' + newId;
      return;
    }
    renderPuzzlesList();
  } catch (err) {
    console.error('Save puzzle error:', err);
    showToast('Error al guardar: ' + err.message, 'error');
  }
}

// ============================================
// Delete Puzzle
// ============================================

async function deletePuzzle(puzzleId) {
  const yes = await confirm('Eliminar este puzzle y todos sus pasos? Esta accion no se puede deshacer.');
  if (!yes) return;

  try {
    await remove('puzzles', puzzleId);
    showToast('Puzzle eliminado', 'success');
    window.location.hash = 'puzzles';
  } catch (err) {
    console.error('Delete puzzle error:', err);
    showToast('Error al eliminar: ' + err.message, 'error');
  }
}
