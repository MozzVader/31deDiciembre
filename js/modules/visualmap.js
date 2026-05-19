// ============================================
// Modulo: Visual Map — Mapa Visual de Habitaciones
// ============================================
import { getAll, update } from '../db.js';
import { renderWorkspace, setBreadcrumbs, showToast, escapeHtml } from '../ui.js';

// ============================================
// Constants
// ============================================

const CANVAS_W = 4000;
const CANVAS_H = 3000;
const NODE_W = 160;
const NODE_H = 56;
const SHORTEN = 48; // px to shorten line at each end (clears node edge)
const ARROW_SIZE = 12;

// ============================================
// State
// ============================================

let rooms = [];
let roomMap = {};
let scale = 1;
let translateX = 0;
let translateY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let dragState = null; // { roomId, nodeEl, offsetX, offsetY }
let selectedRoomId = null;
let connElements = []; // { sourceId, targetId, lineEl, labelEl, condLineEl }
let layoutApplied = false;

// ============================================
// Main Render
// ============================================

export async function renderVisualMap() {
  setBreadcrumbs([{ label: 'Mapa Visual' }]);
  renderWorkspace('<div class="loading"><div class="spinner"></div></div>');

  try {
    rooms = await getAll('rooms');
    roomMap = {};
    rooms.forEach(r => { roomMap[r.id] = r; });

    // Check if any room has map positions
    const hasPositions = rooms.some(r => r.mapX != null && r.mapY != null);
    layoutApplied = false;

    // Run auto-layout if no rooms have positions (first time)
    let layoutNodes = null;
    if (!hasPositions && rooms.length > 0) {
      layoutNodes = forceDirectedLayout(rooms);
      layoutApplied = true;
      // Save positions
      await saveAllPositions(layoutNodes);
    }

    // Build connection list
    const connections = buildConnections(rooms, roomMap);

    // Stats
    const connectedIds = new Set();
    connections.forEach(c => { connectedIds.add(c.sourceId); connectedIds.add(c.targetId); });
    const isolatedCount = rooms.filter(r => !connectedIds.has(r.id)).length;

    // Build room positions
    const positions = {};
    rooms.forEach(r => {
      const layout = layoutNodes?.find(n => n.id === r.id);
      positions[r.id] = {
        x: r.mapX ?? layout?.x ?? (CANVAS_W / 2 + (Math.random() - 0.5) * 400),
        y: r.mapY ?? layout?.y ?? (CANVAS_H / 2 + (Math.random() - 0.5) * 300)
      };
    });

    // Render the workspace
    renderWorkspace(`
      <div class="map-workspace">
        <!-- Toolbar -->
        <div class="map-toolbar">
          <div class="map-toolbar-left">
            <div class="map-toolbar-title"><i class="fa-solid fa-diagram-project"></i> Mapa Visual</div>
            <div class="map-stats">
              <span><i class="fa-solid fa-map"></i> ${rooms.length} hab.</span>
              <span><i class="fa-solid fa-arrows-left-right"></i> ${connections.length} conex.</span>
              ${isolatedCount > 0 ? `<span class="map-stat-warn"><i class="fa-solid fa-triangle-exclamation"></i> ${isolatedCount} aislada${isolatedCount !== 1 ? 's' : ''}</span>` : ''}
            </div>
          </div>
          <div class="map-toolbar-right">
            <button class="btn btn-ghost btn-sm" id="btn-auto-layout" title="Reorganizar automaticamente">
              <i class="fa-solid fa-wand-magic-sparkles"></i> Auto Layout
            </button>
            <button class="btn btn-ghost btn-sm" id="btn-fit-view" title="Ajustar vista a todo el mapa">
              <i class="fa-solid fa-expand"></i> Ajustar
            </button>
            <div class="map-zoom-controls">
              <button class="btn btn-ghost btn-sm map-zoom-btn" id="btn-zoom-out" title="Alejar"><i class="fa-solid fa-minus"></i></button>
              <span class="map-zoom-level" id="map-zoom-level">100%</span>
              <button class="btn btn-ghost btn-sm map-zoom-btn" id="btn-zoom-in" title="Acercar"><i class="fa-solid fa-plus"></i></button>
            </div>
          </div>
        </div>

        <!-- Viewport -->
        <div class="map-viewport" id="map-viewport">
          <div class="map-canvas" id="map-canvas">
            <svg id="map-svg" width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <marker id="map-arrow" markerWidth="${ARROW_SIZE}" markerHeight="8" refX="${ARROW_SIZE - 1}" refY="4" orient="auto-start-reverse">
                  <path d="M0,1 L${ARROW_SIZE},4 L0,7 L2.5,4 Z" fill="color-mix(in srgb, var(--accent) 60%, transparent)" />
                </marker>
                <marker id="map-arrow-cond" markerWidth="${ARROW_SIZE}" markerHeight="8" refX="${ARROW_SIZE - 1}" refY="4" orient="auto-start-reverse">
                  <path d="M0,1 L${ARROW_SIZE},4 L0,7 L2.5,4 Z" fill="color-mix(in srgb, var(--warning) 70%, transparent)" />
                </marker>
              </defs>
            </svg>
          </div>
        </div>

        <!-- Legend -->
        <div class="map-legend">
          <div class="map-legend-item">
            <span class="map-legend-line" style="background: var(--accent);"></span> Salida
          </div>
          <div class="map-legend-item">
            <span class="map-legend-line" style="background: var(--warning); opacity:0.7; border-top: 2px dashed var(--warning); height:0;"></span> Condicional
          </div>
          <div class="map-legend-item">
            <span class="map-legend-dot" style="background: var(--accent);"></span> Conectada
          </div>
          <div class="map-legend-item">
            <span class="map-legend-dot" style="background: var(--text-muted);"></span> Aislada
          </div>
        </div>

        <!-- Room popup -->
        <div class="map-room-popup" id="map-room-popup" style="display:none;"></div>

        <!-- Help hint -->
        <div class="map-hint">
          <i class="fa-solid fa-circle-info"></i> Arrastra habitaciones para reposicionar &middot; Scroll para zoom &middot; Click en fondo para arrastrar el mapa
        </div>
      </div>
    `);

    // Render nodes
    const canvas = document.getElementById('map-canvas');
    rooms.forEach(room => {
      const pos = positions[room.id];
      const isConnected = connectedIds.has(room.id);
      const exitCount = (room.exits || []).filter(e => e.targetRoomId && roomMap[e.targetRoomId]).length;
      const hotspotCount = (room.hotspots || []).length;

      const nodeEl = document.createElement('div');
      nodeEl.className = `map-node ${isConnected ? 'map-node-connected' : 'map-node-isolated'}`;
      nodeEl.dataset.roomId = room.id;
      nodeEl.style.left = pos.x + 'px';
      nodeEl.style.top = pos.y + 'px';
      nodeEl.innerHTML = `
        <div class="map-node-name">${escapeHtml(room.name || 'Sin nombre')}</div>
        <div class="map-node-meta">
          ${exitCount > 0 ? `<span><i class="fa-solid fa-door-open"></i> ${exitCount}</span>` : ''}
          ${hotspotCount > 0 ? `<span><i class="fa-solid fa-hand-pointer"></i> ${hotspotCount}</span>` : ''}
          ${exitCount === 0 && hotspotCount === 0 ? '<span style="opacity:0.5;">Sin salidas</span>' : ''}
        </div>
      `;
      canvas.appendChild(nodeEl);
    });

    // Render connections (SVG)
    renderSVGConnections(connections, positions, connectedIds);

    // Fit view
    setTimeout(() => fitView(positions), 50);

    // Setup interaction
    setupInteraction(rooms, roomMap, connections, positions, connectedIds);

    // Setup toolbar
    setupToolbar(positions, connections, connectedIds);

  } catch (err) {
    console.error('Visual map error:', err);
    renderWorkspace(`
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-triangle-exclamation" style="font-size:48px;"></i></div>
        <div class="empty-state-title">Error al cargar el mapa</div>
        <div class="empty-state-text">${escapeHtml(err.message)}</div>
      </div>
    `);
  }
}

// ============================================
// Build Connections Array
// ============================================

function buildConnections(rooms, roomMap) {
  const connections = [];
  rooms.forEach(room => {
    (room.exits || []).forEach(exit => {
      if (exit.targetRoomId && roomMap[exit.targetRoomId]) {
        connections.push({
          sourceId: room.id,
          targetId: exit.targetRoomId,
          direction: exit.direction || '',
          conditionFlag: exit.conditionFlag || null
        });
      }
    });
  });
  return connections;
}

// ============================================
// Render SVG Connections
// ============================================

function renderSVGConnections(connections, positions, connectedIds) {
  const svg = document.getElementById('map-svg');
  if (!svg) return;

  // Remove old connection elements (keep defs)
  svg.querySelectorAll('.map-conn-group').forEach(el => el.remove());

  connElements = [];

  // Group connections by pair (for bidirectional offset)
  const pairMap = {};
  connections.forEach(c => {
    const key = [c.sourceId, c.targetId].sort().join('|');
    if (!pairMap[key]) pairMap[key] = [];
    pairMap[key].push(c);
  });

  Object.entries(pairMap).forEach(([key, pairConns]) => {
    const isBidirectional = pairConns.length === 2;

    pairConns.forEach((conn, idx) => {
      const sourcePos = positions[conn.sourceId];
      const targetPos = positions[conn.targetId];
      if (!sourcePos || !targetPos) return;

      // Center of nodes
      const sx = sourcePos.x + NODE_W / 2;
      const sy = sourcePos.y + NODE_H / 2;
      const tx = targetPos.x + NODE_W / 2;
      const ty = targetPos.y + NODE_H / 2;

      // Compute line with shortening
      let { x1, y1, x2, y2 } = shortenLine(sx, sy, tx, ty, SHORTEN);

      // Bidirectional offset
      let offsetX = 0, offsetY = 0;
      if (isBidirectional) {
        const dx = tx - sx;
        const dy = ty - sy;
        const len = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const perpX = -dy / len;
        const perpY = dx / len;
        const offsetAmount = 8;
        // Determine offset direction based on source/target order
        const isForward = conn.sourceId < conn.targetId;
        const sign = isForward ? 1 : -1;
        offsetX = perpX * offsetAmount * sign;
        offsetY = perpY * offsetAmount * sign;
        x1 += offsetX; y1 += offsetY;
        x2 += offsetX; y2 += offsetY;
      }

      const isCond = !!conn.conditionFlag;
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.classList.add('map-conn-group');
      group.dataset.source = conn.sourceId;
      group.dataset.target = conn.targetId;
      group.dataset.direction = conn.direction;

      // Shadow line (for visibility)
      const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      shadow.setAttribute('x1', x1); shadow.setAttribute('y1', y1);
      shadow.setAttribute('x2', x2); shadow.setAttribute('y2', y2);
      shadow.setAttribute('stroke', 'rgba(0,0,0,0.3)');
      shadow.setAttribute('stroke-width', '4');
      group.appendChild(shadow);

      // Main line
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      line.setAttribute('stroke', isCond ? 'color-mix(in srgb, var(--warning) 60%, transparent)' : 'color-mix(in srgb, var(--accent) 50%, transparent)');
      line.setAttribute('stroke-width', '2');
      if (isCond) {
        line.setAttribute('stroke-dasharray', '8,5');
      }
      line.setAttribute('marker-end', isCond ? 'url(#map-arrow-cond)' : 'url(#map-arrow)');
      group.appendChild(line);

      // Direction label
      let labelEl = null;
      if (conn.direction) {
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        // Label background
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const textLen = conn.direction.length * 7 + 10;
        bg.setAttribute('x', midX - textLen / 2);
        bg.setAttribute('y', midY - 10);
        bg.setAttribute('width', textLen);
        bg.setAttribute('height', 16);
        bg.setAttribute('rx', '3');
        bg.setAttribute('fill', 'color-mix(in srgb, var(--bg-primary) 90%, transparent)');
        group.appendChild(bg);

        labelEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        labelEl.setAttribute('x', midX);
        labelEl.setAttribute('y', midY + 3);
        labelEl.setAttribute('text-anchor', 'middle');
        labelEl.setAttribute('fill', isCond ? 'var(--warning)' : 'var(--text-muted)');
        labelEl.setAttribute('font-size', '11');
        labelEl.setAttribute('font-family', 'Inter, sans-serif');
        labelEl.textContent = conn.direction;
        group.appendChild(labelEl);
      }

      svg.appendChild(group);

      connElements.push({
        sourceId: conn.sourceId,
        targetId: conn.targetId,
        direction: conn.direction,
        conditionFlag: conn.conditionFlag,
        groupEl: group,
        lineEl: line,
        shadowEl: shadow,
        labelEl: labelEl,
        isBidirectional,
        offsetX,
        offsetY
      });
    });
  });
}

// ============================================
// Shorten Line
// ============================================

function shortenLine(x1, y1, x2, y2, amount) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: x1 + ux * amount,
    y1: y1 + uy * amount,
    x2: x2 - ux * amount,
    y2: y2 - uy * amount
  };
}

// ============================================
// Update Connections for a Moved Room
// ============================================

function updateConnectionsForRoom(roomId, positions) {
  const pos = positions[roomId];
  if (!pos) return;

  const sx = pos.x + NODE_W / 2;
  const sy = pos.y + NODE_H / 2;

  connElements.forEach(conn => {
    if (conn.sourceId !== roomId && conn.targetId !== roomId) return;

    const otherId = conn.sourceId === roomId ? conn.targetId : conn.sourceId;
    const otherPos = positions[otherId];
    if (!otherPos) return;

    const tx = otherPos.x + NODE_W / 2;
    const ty = otherPos.y + NODE_H / 2;

    let { x1, y1, x2, y2 } = shortenLine(sx, sy, tx, ty, SHORTEN);

    // Apply bidirectional offset
    if (conn.isBidirectional && conn.offsetX !== undefined) {
      x1 += conn.offsetX; y1 += conn.offsetY;
      x2 += conn.offsetX; y2 += conn.offsetY;
    }

    conn.shadowEl.setAttribute('x1', x1); conn.shadowEl.setAttribute('y1', y1);
    conn.shadowEl.setAttribute('x2', x2); conn.shadowEl.setAttribute('y2', y2);
    conn.lineEl.setAttribute('x1', x1); conn.lineEl.setAttribute('y1', y1);
    conn.lineEl.setAttribute('x2', x2); conn.lineEl.setAttribute('y2', y2);

    // Update label position
    if (conn.labelEl) {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const bgEl = conn.groupEl.querySelector('rect');
      if (bgEl) {
        const textLen = conn.direction.length * 7 + 10;
        bgEl.setAttribute('x', midX - textLen / 2);
        bgEl.setAttribute('y', midY - 10);
      }
      conn.labelEl.setAttribute('x', midX);
      conn.labelEl.setAttribute('y', midY + 3);
    }
  });
}

// ============================================
// Force-Directed Layout
// ============================================

function forceDirectedLayout(rooms) {
  if (rooms.length === 0) return [];

  const nodes = rooms.map((r, i) => ({
    id: r.id,
    x: r.mapX ?? CANVAS_W / 2 + (Math.random() - 0.5) * 600,
    y: r.mapY ?? CANVAS_H / 2 + (Math.random() - 0.5) * 400,
    vx: 0,
    vy: 0
  }));

  const nodeMap = {};
  nodes.forEach(n => { nodeMap[n.id] = n; });

  // Build edges
  const edges = [];
  rooms.forEach(room => {
    (room.exits || []).forEach(exit => {
      if (exit.targetRoomId && nodeMap[exit.targetRoomId]) {
        edges.push({ source: room.id, target: exit.targetRoomId });
      }
    });
  });

  const REPULSION = 6000;
  const ATTRACTION = 0.006;
  const CENTER_PULL = 0.003;
  const DAMPING = 0.82;
  const CX = CANVAS_W / 2;
  const CY = CANVAS_H / 2;
  const ITERATIONS = 180;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const forces = {};
    nodes.forEach(n => { forces[n.id] = { fx: 0, fy: 0 }; });

    // Repulsion (all pairs)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 10);
        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        forces[nodes[i].id].fx -= fx;
        forces[nodes[i].id].fy -= fy;
        forces[nodes[j].id].fx += fx;
        forces[nodes[j].id].fy += fy;
      }
    }

    // Attraction (edges)
    edges.forEach(e => {
      const si = nodeMap[e.source];
      const ti = nodeMap[e.target];
      if (!si || !ti) return;
      const dx = ti.x - si.x;
      const dy = ti.y - si.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const idealDist = 280;
      const force = (dist - idealDist) * ATTRACTION;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      forces[si.id].fx += fx;
      forces[si.id].fy += fy;
      forces[ti.id].fx -= fx;
      forces[ti.id].fy -= fy;
    });

    // Center pull
    nodes.forEach(n => {
      forces[n.id].fx += (CX - n.x) * CENTER_PULL;
      forces[n.id].fy += (CY - n.y) * CENTER_PULL;
    });

    // Apply
    nodes.forEach(n => {
      n.vx = (n.vx + forces[n.id].fx) * DAMPING;
      n.vy = (n.vy + forces[n.id].fy) * DAMPING;
      n.x += n.vx;
      n.y += n.vy;
      n.x = Math.max(120, Math.min(CANVAS_W - NODE_W - 120, n.x));
      n.y = Math.max(80, Math.min(CANVAS_H - NODE_H - 80, n.y));
    });
  }

  return nodes;
}

// ============================================
// Save Positions
// ============================================

async function saveRoomPosition(roomId, x, y) {
  try {
    await update('rooms', roomId, { mapX: Math.round(x), mapY: Math.round(y) });
    // Update local data
    const room = roomMap[roomId];
    if (room) { room.mapX = Math.round(x); room.mapY = Math.round(y); }
  } catch (err) {
    console.error('Save position error:', err);
  }
}

let saveDebounce = null;
function debouncedSave(roomId, x, y) {
  if (saveDebounce) clearTimeout(saveDebounce);
  saveDebounce = setTimeout(() => saveRoomPosition(roomId, x, y), 400);
}

async function saveAllPositions(layoutNodes) {
  try {
    await Promise.all(
      layoutNodes.map(n => update('rooms', n.id, { mapX: Math.round(n.x), mapY: Math.round(n.y) }))
    );
    // Update local data
    layoutNodes.forEach(n => {
      const room = roomMap[n.id];
      if (room) { room.mapX = Math.round(n.x); room.mapY = Math.round(n.y); }
    });
    showToast('Posiciones guardadas', 'success');
  } catch (err) {
    console.error('Save all positions error:', err);
  }
}

// ============================================
// Fit View
// ============================================

function fitView(positions) {
  if (rooms.length === 0) return;

  const viewport = document.getElementById('map-viewport');
  if (!viewport) return;
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  rooms.forEach(r => {
    const pos = positions?.[r.id];
    if (!pos) return;
    minX = Math.min(minX, pos.x);
    maxX = Math.max(maxX, pos.x + NODE_W);
    minY = Math.min(minY, pos.y);
    maxY = Math.max(maxY, pos.y + NODE_H);
  });

  if (minX === Infinity) return;

  const padding = 120;
  const contentW = (maxX - minX) + padding * 2;
  const contentH = (maxY - minY) + padding * 2;
  const scaleX = vw / contentW;
  const scaleY = vh / contentH;
  scale = Math.min(scaleX, scaleY, 1.2);
  scale = Math.max(scale, 0.15);

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  translateX = vw / 2 - centerX * scale;
  translateY = vh / 2 - centerY * scale;

  applyTransform();
}

// ============================================
// Apply Transform
// ============================================

function applyTransform() {
  const canvas = document.getElementById('map-canvas');
  if (canvas) {
    canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  }
  const zoomEl = document.getElementById('map-zoom-level');
  if (zoomEl) {
    zoomEl.textContent = Math.round(scale * 100) + '%';
  }
}

// ============================================
// Get Current Positions from DOM
// ============================================

function getPositionsFromDOM() {
  const positions = {};
  document.querySelectorAll('.map-node').forEach(nodeEl => {
    const id = nodeEl.dataset.roomId;
    positions[id] = {
      x: parseInt(nodeEl.style.left) || 0,
      y: parseInt(nodeEl.style.top) || 0
    };
  });
  return positions;
}

// ============================================
// Room Popup
// ============================================

function showRoomPopup(roomId, screenX, screenY) {
  const room = roomMap[roomId];
  if (!room) return;

  const popup = document.getElementById('map-room-popup');
  if (!popup) return;

  const exits = (room.exits || []).filter(e => e.targetRoomId && roomMap[e.targetRoomId]);
  const hotspots = room.hotspots || [];
  const hasConnections = exits.length > 0;

  popup.innerHTML = `
    <div class="map-popup-header">
      <div class="map-popup-title">${escapeHtml(room.name || 'Sin nombre')}</div>
      <button class="btn btn-icon btn-ghost map-popup-close" id="map-popup-close">&times;</button>
    </div>
    ${room.description ? `<div class="map-popup-desc">${escapeHtml(room.description)}</div>` : ''}
    <div class="map-popup-stats">
      <span><i class="fa-solid fa-door-open"></i> ${exits.length} salida${exits.length !== 1 ? 's' : ''}</span>
      <span><i class="fa-solid fa-hand-pointer"></i> ${hotspots.length} hotspot${hotspots.length !== 1 ? 's' : ''}</span>
    </div>
    ${exits.length > 0 ? `
      <div class="map-popup-exits">
        <div class="map-popup-label">Conexiones:</div>
        ${exits.map(e => {
          const target = roomMap[e.targetRoomId];
          return `<div class="map-popup-exit">
            <i class="fa-solid fa-arrow-right"></i>
            <span>${escapeHtml(e.direction || 'Sin nombre')}</span>
            <i class="fa-solid fa-angle-right" style="opacity:0.3;margin:0 4px;"></i>
            <span class="map-popup-exit-target">${escapeHtml(target?.name || '?')}</span>
            ${e.conditionFlag ? `<span class="map-popup-cond"><i class="fa-solid fa-lock"></i></span>` : ''}
          </div>`;
        }).join('')}
      </div>
    ` : ''}
    <div class="map-popup-actions">
      <a href="#rooms/${roomId}" class="btn btn-ghost btn-sm"><i class="fa-solid fa-pen"></i> Editar</a>
    </div>
  `;

  // Position popup near click but within viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pw = 280;
  const ph = popup.scrollHeight || 200;
  let left = screenX + 16;
  let top = screenY - 20;
  if (left + pw > vw - 20) left = screenX - pw - 16;
  if (top + ph > vh - 20) top = vh - ph - 20;
  if (top < 60) top = 60;

  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
  popup.style.display = 'block';

  document.getElementById('map-popup-close').addEventListener('click', () => {
    popup.style.display = 'none';
    selectedRoomId = null;
  });
}

// ============================================
// Setup Interaction (Pan, Zoom, Drag)
// ============================================

function setupInteraction(rooms, roomMap, connections, positions, connectedIds) {
  const viewport = document.getElementById('map-viewport');
  if (!viewport) return;

  // ---- Pan ----
  viewport.addEventListener('mousedown', (e) => {
    if (e.target.closest('.map-node')) return;
    if (e.button !== 0) return;
    isPanning = true;
    panStartX = e.clientX - translateX;
    panStartY = e.clientY - translateY;
    viewport.style.cursor = 'grabbing';

    // Close popup
    const popup = document.getElementById('map-room-popup');
    if (popup) popup.style.display = 'none';
    selectedRoomId = null;
  });

  document.addEventListener('mousemove', (e) => {
    if (isPanning) {
      translateX = e.clientX - panStartX;
      translateY = e.clientY - panStartY;
      applyTransform();
    }

    if (dragState) {
      const rect = viewport.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left - translateX) / scale;
      const canvasY = (e.clientY - rect.top - translateY) / scale;

      const newX = canvasX - dragState.offsetX;
      const newY = canvasY - dragState.offsetY;

      dragState.nodeEl.style.left = newX + 'px';
      dragState.nodeEl.style.top = newY + 'px';

      // Update local positions
      positions[dragState.roomId] = { x: newX, y: newY };

      // Update connections
      updateConnectionsForRoom(dragState.roomId, positions);
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (isPanning) {
      isPanning = false;
      const viewport = document.getElementById('map-viewport');
      if (viewport) viewport.style.cursor = 'grab';
    }

    if (dragState) {
      const x = parseInt(dragState.nodeEl.style.left);
      const y = parseInt(dragState.nodeEl.style.top);
      debouncedSave(dragState.roomId, x, y);
      dragState = null;
    }
  });

  viewport.style.cursor = 'grab';

  // ---- Zoom (wheel) ----
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const prevScale = scale;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    scale = Math.max(0.12, Math.min(2.5, scale * factor));

    // Zoom toward mouse
    translateX = mouseX - (mouseX - translateX) * (scale / prevScale);
    translateY = mouseY - (mouseY - translateY) * (scale / prevScale);

    applyTransform();
  }, { passive: false });

  // ---- Node Drag ----
  viewport.addEventListener('mousedown', (e) => {
    const nodeEl = e.target.closest('.map-node');
    if (!nodeEl || e.button !== 0) return;

    e.stopPropagation();
    const roomId = nodeEl.dataset.roomId;
    const rect = viewport.getBoundingClientRect();

    const canvasX = (e.clientX - rect.left - translateX) / scale;
    const canvasY = (e.clientY - rect.top - translateY) / scale;
    const nodeLeft = parseInt(nodeEl.style.left) || 0;
    const nodeTop = parseInt(nodeEl.style.top) || 0;

    dragState = {
      roomId,
      nodeEl,
      offsetX: canvasX - nodeLeft,
      offsetY: canvasY - nodeTop
    };

    nodeEl.classList.add('map-node-dragging');

    // Highlight
    document.querySelectorAll('.map-node').forEach(n => n.classList.remove('map-node-selected'));
    nodeEl.classList.add('map-node-selected');
    selectedRoomId = roomId;
  });

  document.addEventListener('mouseup', () => {
    if (dragState) {
      dragState.nodeEl.classList.remove('map-node-dragging');
    }
  });

  // ---- Node Click (popup) ----
  viewport.addEventListener('click', (e) => {
    const nodeEl = e.target.closest('.map-node');
    if (!nodeEl) return;

    const roomId = nodeEl.dataset.roomId;
    if (selectedRoomId === roomId) return; // Already selected

    selectedRoomId = roomId;
    document.querySelectorAll('.map-node').forEach(n => n.classList.remove('map-node-selected'));
    nodeEl.classList.add('map-node-selected');

    showRoomPopup(roomId, e.clientX, e.clientY);
  });

  // ---- Close popup on outside click ----
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.map-room-popup') && !e.target.closest('.map-node')) {
      const popup = document.getElementById('map-room-popup');
      if (popup) popup.style.display = 'none';
      selectedRoomId = null;
      document.querySelectorAll('.map-node').forEach(n => n.classList.remove('map-node-selected'));
    }
  });
}

// ============================================
// Setup Toolbar
// ============================================

function setupToolbar(positions, connections, connectedIds) {
  // Auto layout
  document.getElementById('btn-auto-layout')?.addEventListener('click', async () => {
    const nodes = forceDirectedLayout(rooms);
    const nodeMap = {};
    nodes.forEach(n => { nodeMap[n.id] = n; });

    // Update DOM
    document.querySelectorAll('.map-node').forEach(nodeEl => {
      const id = nodeEl.dataset.roomId;
      const node = nodeMap[id];
      if (node) {
        nodeEl.style.left = node.x + 'px';
        nodeEl.style.top = node.y + 'px';
        positions[id] = { x: node.x, y: node.y };
      }
    });

    // Re-render connections
    renderSVGConnections(connections, positions, connectedIds);

    // Save
    await saveAllPositions(nodes);

    // Fit
    setTimeout(() => fitView(positions), 100);
  });

  // Fit view
  document.getElementById('btn-fit-view')?.addEventListener('click', () => {
    const pos = getPositionsFromDOM();
    fitView(pos);
  });

  // Zoom buttons
  document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
    zoomBy(1.2);
  });

  document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
    zoomBy(0.8);
  });
}

function zoomBy(factor) {
  const viewport = document.getElementById('map-viewport');
  if (!viewport) return;
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  const cx = vw / 2;
  const cy = vh / 2;

  const prevScale = scale;
  scale = Math.max(0.12, Math.min(2.5, scale * factor));

  translateX = cx - (cx - translateX) * (scale / prevScale);
  translateY = cy - (cy - translateY) * (scale / prevScale);

  applyTransform();
}
