// ============================================
// Módulo: Command Palette — Búsqueda Global
// ============================================
import { getAll } from '../db.js';
import { escapeHtml } from '../ui.js';

// ============================================
// Entity type configs (label, icon, color, route)
// ============================================
const ENTITY_TYPES = {
  rooms:      { label: 'Habitación',  icon: 'fa-map',         color: 'var(--accent)',  nameField: 'name',      route: 'rooms' },
  characters: { label: 'Personaje',   icon: 'fa-users',       color: 'var(--info)',    nameField: 'name',      route: 'characters' },
  items:      { label: 'Item',        icon: 'fa-box-open',    color: 'var(--warning)', nameField: 'name',      route: 'items' },
  flags:      { label: 'Flag',        icon: 'fa-flag',        color: 'var(--danger)',  nameField: 'name',      route: 'items/flags' },
  timeline:   { label: 'Evento',      icon: 'fa-clock',       color: '#c77dff',        nameField: 'eventName', route: 'timeline' },
  dialogues:  { label: 'Diálogo',     icon: 'fa-comments',    color: 'var(--success)', nameField: 'name',      route: 'dialogues' },
  notes:      { label: 'Nota',        icon: 'fa-note-sticky', color: '#818cf8',        nameField: 'title',     route: 'notes' },
  milestones: { label: 'Hito',        icon: 'fa-trophy',      color: '#f472b6',        nameField: 'title',     route: 'milestones' },
  audio:      { label: 'Audio',       icon: 'fa-headphones',  color: '#fb923c',        nameField: 'name',      route: 'audio' },
  puzzles:    { label: 'Puzzle',      icon: 'fa-puzzle-piece',color: '#f472b6',        nameField: 'name',      route: 'puzzles' }
};

// Quick actions
const QUICK_ACTIONS = [
  { id: 'go-dashboard',     label: 'Ir al Dashboard',          icon: 'fa-house',       color: 'var(--accent)',  hash: '#dashboard',     category: 'Navegar' },
  { id: 'go-rooms',         label: 'Ir a Habitaciones',        icon: 'fa-map',         color: 'var(--accent)',  hash: '#rooms',         category: 'Navegar' },
  { id: 'go-visualmap',     label: 'Ir a Mapa Visual',         icon: 'fa-diagram-project', color: '#34d399',        hash: '#visualmap',     category: 'Navegar' },
  { id: 'go-characters',    label: 'Ir a Personajes',          icon: 'fa-users',       color: 'var(--info)',    hash: '#characters',    category: 'Navegar' },
  { id: 'go-items',         label: 'Ir a Inventario & Flags',  icon: 'fa-box-open',    color: 'var(--warning)', hash: '#items',         category: 'Navegar' },
  { id: 'go-timeline',      label: 'Ir a Cronología',          icon: 'fa-clock',       color: '#c77dff',        hash: '#timeline',      category: 'Navegar' },
  { id: 'go-dialogues',     label: 'Ir a Diálogos',            icon: 'fa-comments',    color: 'var(--success)', hash: '#dialogues',     category: 'Navegar' },
  { id: 'go-notes',         label: 'Ir a Notas',               icon: 'fa-note-sticky', color: '#818cf8',        hash: '#notes',         category: 'Navegar' },
  { id: 'go-spritesheet',   label: 'Ir a Sprite Viewer',       icon: 'fa-film',        color: '#fbbf24',        hash: '#spritesheet',   category: 'Navegar' },
  { id: 'go-milestones',    label: 'Ir a Hitos',               icon: 'fa-trophy',      color: '#f472b6',        hash: '#milestones',    category: 'Navegar' },
  { id: 'go-audio',         label: 'Ir a Biblioteca de Audio', icon: 'fa-headphones',  color: '#fb923c',        hash: '#audio',         category: 'Navegar' },
  { id: 'go-puzzles',       label: 'Ir a Puzzle Designer',     icon: 'fa-puzzle-piece',color: '#f472b6',        hash: '#puzzles',       category: 'Navegar' },
  { id: 'new-room',         label: 'Nueva Habitación',         icon: 'fa-plus',        color: 'var(--accent)',  hash: '#rooms/new',     category: 'Crear' },
  { id: 'new-character',    label: 'Nuevo Personaje',          icon: 'fa-plus',        color: 'var(--info)',    hash: '#characters/new',category: 'Crear' },
  { id: 'new-item',         label: 'Nuevo Item',               icon: 'fa-plus',        color: 'var(--warning)', hash: '#items/new',     category: 'Crear' },
  { id: 'new-event',        label: 'Nuevo Evento',             icon: 'fa-plus',        color: '#c77dff',        hash: '#timeline/new',  category: 'Crear' },
  { id: 'new-dialogue',     label: 'Nuevo Diálogo',            icon: 'fa-plus',        color: 'var(--success)', hash: '#dialogues/new', category: 'Crear' },
  { id: 'new-note',         label: 'Nueva Nota',               icon: 'fa-plus',        color: '#818cf8',        hash: '#notes/new',     category: 'Crear' },
  { id: 'new-milestone',    label: 'Nuevo Hito',               icon: 'fa-plus',        color: '#f472b6',        hash: '#milestones/new',category: 'Crear' },
  { id: 'new-audio',        label: 'Nueva Pista de Audio',      icon: 'fa-plus',        color: '#fb923c',        hash: '#audio/new',     category: 'Crear' },
  { id: 'new-puzzle',       label: 'Nuevo Puzzle',             icon: 'fa-plus',        color: '#f472b6',        hash: '#puzzles/new',   category: 'Crear' },
  { id: 'export-json',      label: 'Exportar JSON',            icon: 'fa-file-export', color: '#a78bfa',        hash: '__export__',     category: 'Acciones' },
];

// ============================================
// State
// ============================================
let isOpen = false;
let allEntities = [];   // cached flat list of all entities
let highlightedIdx = -1;
let filteredResults = [];
let lastFetchTime = 0;
const CACHE_TTL = 30000; // 30s cache

// DOM refs (set on init)
let paletteEl = null;
let inputEl = null;
let listEl = null;
let emptyEl = null;
let footerEl = null;

// ============================================
// Init — creates DOM and binds events
// ============================================
export function initCommandPalette() {
  // Create palette DOM (appended to #app)
  const app = document.getElementById('app');
  if (!app || document.getElementById('command-palette')) return;

  paletteEl = document.createElement('div');
  paletteEl.id = 'command-palette';
  paletteEl.className = 'cmd-palette';
  paletteEl.innerHTML = `
    <div class="cmd-palette-backdrop" id="cmd-backdrop"></div>
    <div class="cmd-palette-dialog" role="dialog" aria-label="Búsqueda rápida">
      <div class="cmd-palette-search">
        <i class="fa-solid fa-magnifying-glass cmd-palette-search-icon"></i>
        <input type="text" id="cmd-input" class="cmd-palette-input" placeholder="Buscar entidades, navegar o crear..." autocomplete="off" spellcheck="false">
        <kbd class="cmd-kbd">ESC</kbd>
      </div>
      <div class="cmd-palette-list" id="cmd-list"></div>
      <div class="cmd-palette-footer" id="cmd-footer">
        <span><kbd class="cmd-kbd-sm">↑↓</kbd> navegar</span>
        <span><kbd class="cmd-kbd-sm">↵</kbd> seleccionar</span>
        <span><kbd class="cmd-kbd-sm">esc</kbd> cerrar</span>
      </div>
    </div>
  `;
  app.appendChild(paletteEl);

  inputEl = document.getElementById('cmd-input');
  listEl = document.getElementById('cmd-list');
  footerEl = document.getElementById('cmd-footer');

  // Backdrop click closes
  document.getElementById('cmd-backdrop').addEventListener('click', close);

  // Input events
  inputEl.addEventListener('input', onInput);
  inputEl.addEventListener('keydown', onKeyDown);

  // Global keyboard shortcut
  document.addEventListener('keydown', onGlobalKey);

  // Add trigger button to topbar
  addTriggerButton();
}

// ============================================
// Add search trigger button in the topbar
// ============================================
function addTriggerButton() {
  const topbarActions = document.getElementById('topbar-actions');
  if (!topbarActions || document.getElementById('cmd-trigger')) return;

  const btn = document.createElement('button');
  btn.id = 'cmd-trigger';
  btn.className = 'cmd-trigger';
  btn.title = 'Búsqueda rápida (Ctrl+K)';
  btn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i><span class="cmd-trigger-text">Buscar...</span><kbd class="cmd-kbd-trigger">⌘K</kbd>`;
  btn.addEventListener('click', open);
  topbarActions.insertBefore(btn, topbarActions.firstChild);
}

// ============================================
// Open / Close
// ============================================
export function open() {
  if (isOpen) return;
  isOpen = true;
  paletteEl.classList.add('visible');
  inputEl.value = '';
  highlightedIdx = -1;
  // Show quick actions by default (empty query)
  renderResults(QUICK_ACTIONS.map(a => ({ ...a, _type: 'action' })));
  // Focus after animation
  requestAnimationFrame(() => inputEl.focus());
}

export function close() {
  if (!isOpen) return;
  isOpen = false;
  paletteEl.classList.remove('visible');
  inputEl.blur();
}

// ============================================
// Global keyboard shortcut handler
// ============================================
function onGlobalKey(e) {
  // Cmd+K or Ctrl+K
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    if (isOpen) close(); else open();
    return;
  }
  // Escape when open
  if (e.key === 'Escape' && isOpen) {
    e.preventDefault();
    close();
  }
}

// ============================================
// Input handler — debounce + fetch + filter
// ============================================
let debounceTimer = null;

function onInput() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const query = inputEl.value.trim().toLowerCase();

    if (!query) {
      // No query — show quick actions
      renderResults(QUICK_ACTIONS.map(a => ({ ...a, _type: 'action' })));
      return;
    }

    // Fetch entities (with cache)
    await ensureDataFresh();

    // Filter entities by name matching query
    const matched = allEntities.filter(e => {
      const name = (e._name || '').toLowerCase();
      return name.includes(query);
    });

    // Also match quick actions
    const matchedActions = QUICK_ACTIONS.filter(a =>
      a.label.toLowerCase().includes(query)
    ).map(a => ({ ...a, _type: 'action' }));

    // Merge: entities first, then actions
    const results = [...matched, ...matchedActions];
    renderResults(results);
  }, 120);
}

// ============================================
// Keyboard navigation within results
// ============================================
function onKeyDown(e) {
  const items = listEl.querySelectorAll('.cmd-palette-item');
  if (!items.length) return;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      highlightedIdx = Math.min(highlightedIdx + 1, items.length - 1);
      updateHighlight(items);
      break;
    case 'ArrowUp':
      e.preventDefault();
      highlightedIdx = Math.max(highlightedIdx - 1, 0);
      updateHighlight(items);
      break;
    case 'Enter':
      e.preventDefault();
      if (highlightedIdx >= 0 && items[highlightedIdx]) {
        selectItem(items[highlightedIdx]);
      }
      break;
  }
}

function updateHighlight(items) {
  items.forEach((item, i) => {
    item.classList.toggle('highlighted', i === highlightedIdx);
    if (i === highlightedIdx) {
      item.scrollIntoView({ block: 'nearest' });
    }
  });
}

// ============================================
// Render results list
// ============================================
function renderResults(results) {
  highlightedIdx = -1;

  if (results.length === 0) {
    listEl.innerHTML = `
      <div class="cmd-palette-empty">
        <i class="fa-solid fa-search" style="font-size:20px;color:var(--text-muted);margin-bottom:8px;display:block;"></i>
        <span>No se encontraron resultados</span>
      </div>
    `;
    return;
  }

  // Group: entities first, then actions
  const entities = results.filter(r => r._type !== 'action');
  const actions = results.filter(r => r._type === 'action');

  let html = '';

  // Show "Entidades" section if we have entity results
  if (entities.length > 0) {
    const query = inputEl.value.trim().toLowerCase();
    html += `<div class="cmd-palette-group-label">Entidades</div>`;
    html += entities.map((e, i) => {
      const cfg = ENTITY_TYPES[e._collection];
      const nameHtml = query ? highlightMatch(e._name || 'Sin nombre', query) : escapeHtml(e._name || 'Sin nombre');
      const hash = cfg.route + '/' + e.id;
      return `
        <div class="cmd-palette-item" data-hash="${hash}" data-idx="${i}">
          <div class="cmd-palette-item-icon" style="--icon-color:${cfg.color}">
            <i class="fa-solid ${cfg.icon}"></i>
          </div>
          <div class="cmd-palette-item-content">
            <div class="cmd-palette-item-name">${nameHtml}</div>
            <div class="cmd-palette-item-label">${cfg.label}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Show actions (quick actions)
  if (actions.length > 0) {
    const actionLabel = inputEl.value.trim() ? 'Acciones rápidas' : 'Acciones';
    html += `<div class="cmd-palette-group-label">${actionLabel}</div>`;
    const offset = entities.length;
    html += actions.map((a, i) => {
      return `
        <div class="cmd-palette-item" data-hash="${a.hash}" data-idx="${offset + i}">
          <div class="cmd-palette-item-icon" style="--icon-color:${a.color}">
            <i class="fa-solid ${a.icon}"></i>
          </div>
          <div class="cmd-palette-item-content">
            <div class="cmd-palette-item-name">${escapeHtml(a.label)}</div>
            <div class="cmd-palette-item-label">${a.category || ''}</div>
          </div>
          <i class="fa-solid fa-arrow-right cmd-palette-item-arrow"></i>
        </div>
      `;
    }).join('');
  }

  listEl.innerHTML = html;

  // Bind clicks
  listEl.querySelectorAll('.cmd-palette-item').forEach(item => {
    item.addEventListener('click', () => selectItem(item));
    item.addEventListener('mouseenter', () => {
      // Update highlight to hovered
      const idx = parseInt(item.dataset.idx);
      highlightedIdx = idx;
      const allItems = listEl.querySelectorAll('.cmd-palette-item');
      allItems.forEach((el, i) => el.classList.toggle('highlighted', i === idx));
    });
  });
}

// ============================================
// Select an item — navigate and close
// ============================================
function selectItem(itemEl) {
  const hash = itemEl.dataset.hash;

  if (hash === '__export__') {
    // Trigger export
    const exportBtn = document.getElementById('btn-export');
    if (exportBtn) exportBtn.click();
  } else {
    window.location.hash = hash;
  }

  close();
}

// ============================================
// Highlight matching text
// ============================================
function highlightMatch(text, query) {
  if (!query || !text) return escapeHtml(text);
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query);
  if (idx === -1) return escapeHtml(text);

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);
  return `${escapeHtml(before)}<span class="cmd-highlight">${escapeHtml(match)}</span>${escapeHtml(after)}`;
}

// ============================================
// Data fetching with cache
// ============================================
async function ensureDataFresh() {
  const now = Date.now();
  if (allEntities.length > 0 && now - lastFetchTime < CACHE_TTL) return;

  try {
    const collections = Object.keys(ENTITY_TYPES);
    const results = await Promise.all(
      collections.map(col => getAll(col))
    );

    allEntities = [];
    collections.forEach((col, i) => {
      const docs = results[i];
      const cfg = ENTITY_TYPES[col];
      docs.forEach(doc => {
        allEntities.push({
          id: doc.id,
          _collection: col,
          _type: 'entity',
          _name: doc[cfg.nameField] || doc.name || doc.title || doc.eventName || 'Sin nombre'
        });
      });
    });

    lastFetchTime = now;
  } catch (err) {
    console.error('Command palette fetch error:', err);
  }
}
