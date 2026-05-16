// ============================================
// Módulo: Diálogos (The Forest)
// ============================================
import { getAll, create, update, remove, getOne, getNodes, createNode, updateNode, removeNode } from '../db.js';
import { renderWorkspace, setBreadcrumbs, updateBadge, showToast, confirm, escapeHtml, createSelect, showModal, closeModal } from '../ui.js';

export async function renderDialoguesList() {
  setBreadcrumbs([{ label: 'Diálogos' }]);
  const dialogues = await getAll('dialogues');
  updateBadge('dialogues', dialogues.length);

  const characters = await getAll('characters');
  const charMap = {};
  characters.forEach(c => charMap[c.id] = c.name);

  if (dialogues.length === 0) {
    renderWorkspace(`
      <div class="workspace-header">
        <div>
          <h1 class="workspace-title">Diálogos</h1>
          <p class="workspace-subtitle">El bosque donde viven las conversaciones</p>
        </div>
        <button class="btn btn-primary" onclick="window.location.hash='dialogues/new'">+ Nuevo Diálogo</button>
      </div>
      <div class="empty-state">
        <div class="empty-state-icon">&#128172;</div>
        <div class="empty-state-title">No hay diálogos todavía</div>
        <div class="empty-state-text">Acá va la chicha. Creá árboles de diálogo con nodos anidados — estilo Notion, sin caer en el infierno de canvas y flechitas.</div>
        <button class="btn btn-primary" onclick="window.location.hash='dialogues/new'">+ Crear Diálogo</button>
      </div>
    `);
    return;
  }

  const cards = dialogues.map(dlg => {
    const mainChar = dlg.characterId ? (charMap[dlg.characterId] || '?') : '—';
    return `
      <div class="card" onclick="window.location.hash='dialogues/${dlg.id}'">
        <div class="card-header">
          <div style="font-size:28px;">&#128172;</div>
          <div class="card-body">
            <div class="card-title">${escapeHtml(dlg.name)}</div>
            <div class="card-description">${escapeHtml(dlg.description || 'Sin descripción')}</div>
          </div>
        </div>
        <div class="card-meta">
          <span class="card-badge">&#129489; ${escapeHtml(mainChar)}</span>
        </div>
      </div>
    `;
  }).join('');

  renderWorkspace(`
    <div class="workspace-header">
      <div>
        <h1 class="workspace-title">Diálogos</h1>
        <p class="workspace-subtitle">${dialogues.length} árbol${dialogues.length !== 1 ? 'es' : ''} de diálogo</p>
      </div>
      <button class="btn btn-primary" onclick="window.location.hash='dialogues/new'">+ Nuevo Diálogo</button>
    </div>
    <div class="card-grid">${cards}</div>
  `);
}

// ============================================
// Dialogue Detail (Tree View + Node Editor)
// ============================================

export async function renderDialogueDetail(dialogueId) {
  const dialogue = await getOne('dialogues', dialogueId);
  if (!dialogue) {
    showToast('Diálogo no encontrado', 'error');
    window.location.hash = 'dialogues';
    return;
  }

  setBreadcrumbs([
    { label: 'Diálogos', route: 'dialogues' },
    { label: dialogue.name || 'Diálogo' }
  ]);

  const nodes = await getNodes(dialogueId);
  const characters = await getAll('characters');
  const flags = await getAll('flags');

  // Build node tree from flat list
  const nodeMap = {};
  nodes.forEach(n => { nodeMap[n.id] = { ...n, children: [], responses: n.playerResponses || [] }; });
  const rootNodes = nodes.filter(n => !n.parentNodeId);

  const treeHtml = rootNodes.map(node => renderNodeTree(node, nodeMap, characters, flags)).join('');

  renderWorkspace(`
    <div class="detail-header">
      <button class="detail-back" onclick="window.location.hash='dialogues'">&#9664; Volver</button>
      <h1 class="detail-title">${escapeHtml(dialogue.name)}</h1>
      <div class="detail-actions">
        <button class="btn btn-ghost btn-sm" id="btn-edit-dialogue">Editar Info</button>
        <button class="btn btn-ghost btn-sm" id="btn-add-root-node">+ Nodo Raíz</button>
        <button class="btn btn-danger btn-sm" id="btn-delete-dialogue">Eliminar</button>
      </div>
    </div>

    ${dialogue.description ? `<p class="text-sm text-muted mb-4">${escapeHtml(dialogue.description)}</p>` : ''}

    <div class="flex gap-4 mb-6">
      <div>
        <span class="text-xs text-muted">Personaje Principal:</span>
        <span class="text-sm font-mono" style="color:var(--accent);margin-left:6px;">
          ${characters.find(c => c.id === dialogue.characterId)?.name || '—'}
        </span>
      </div>
      <div>
        <span class="text-xs text-muted">Total Nodos:</span>
        <span class="text-sm font-mono" style="color:var(--warning);margin-left:6px;">${nodes.length}</span>
      </div>
    </div>

    <div id="dialogue-tree">
      ${rootNodes.length === 0
        ? `<div class="empty-state" style="padding:40px;">
             <div class="empty-state-icon">&#127795;</div>
             <div class="empty-state-title">Árbol vacío</div>
             <div class="empty-state-text">Agregá un nodo raíz para empezar a construir este diálogo.</div>
             <button class="btn btn-primary" onclick="window.openNodeEditor('${dialogueId}', null)">+ Agregar Nodo Raíz</button>
           </div>`
        : treeHtml
      }
    </div>
  `);

  // Event handlers
  document.getElementById('btn-add-root-node').onclick = () => openNodeEditor(dialogueId, null);
  document.getElementById('btn-edit-dialogue').onclick = () => openDialogueInfoEditor(dialogueId, dialogue, characters);
  document.getElementById('btn-delete-dialogue').onclick = async () => {
    const ok = await confirm(`¿Eliminás el diálogo "${dialogue.name}" y todos sus nodos?`);
    if (ok) {
      // Delete all nodes first
      for (const node of nodes) {
        await removeNode(dialogueId, node.id);
      }
      await remove('dialogues', dialogueId);
      showToast('Diálogo eliminado', 'success');
      window.location.hash = 'dialogues';
    }
  };
}

function renderNodeTree(node, nodeMap, characters, flags) {
  const speaker = characters.find(c => c.id === node.speakerId);
  const speakerName = speaker?.name || (node.speakerId === '__player__' ? 'Jugador' : node.speakerId || '?');

  const responsesHtml = (node.responses || []).map(resp => {
    const conditionHtml = resp.conditionFlag
      ? `<span class="dialogue-response-condition">${escapeHtml(resp.conditionFlag)}</span>`
      : '';

    const nextNode = resp.nextNodeId ? nodeMap[resp.nextNodeId] : null;
    const nextLabel = nextNode ? nextNode.text?.slice(0, 40) : (resp.nextNodeId === '__end__' ? 'Fin' : '?');

    return `
      <div class="dialogue-response" onclick="event.stopPropagation(); window.editNodeResponse('${resp.id || ''}')">
        <span class="dialogue-response-arrow">&#10148;</span>
        <span class="dialogue-response-text">"${escapeHtml(resp.text)}"</span>
        ${conditionHtml}
        <span class="text-xs text-muted">${escapeHtml(nextLabel)}${nextLabel !== 'Fin' ? '...' : ''}</span>
      </div>
    `;
  }).join('');

  // Find children (nodes whose parentNodeId is this node)
  const children = (node.children || []);
  const childrenHtml = children.map(child => renderNodeTree(child, nodeMap, characters, flags)).join('');

  return `
    <div class="dialogue-node" data-node-id="${node.id}">
      <div class="dialogue-node-card" onclick="window.openNodeEditor('${node.id.split('/')[0]}', '${node.id}')" style="cursor:pointer;">
        <div class="dialogue-node-header">
          <span class="dialogue-node-speaker">&#128483; ${escapeHtml(speakerName)}</span>
          <span class="dialogue-node-id">${node.id.split('/').pop()}</span>
        </div>
        <div class="dialogue-node-text">"${escapeHtml(node.text || '')}"</div>
        ${node.responses?.length ? `
          <div class="dialogue-node-responses">
            ${responsesHtml}
            <button class="dynamic-array-add" style="border:none;padding:6px;margin-top:4px;" onclick="event.stopPropagation(); window.addResponseToNode('${node.id}')">+ Agregar Respuesta</button>
          </div>
        ` : ''}
      </div>
      ${childrenHtml}
    </div>
  `;
}

// ============================================
// Node Editor (Modal)
// ============================================

window.openNodeEditor = async function(dialogueId, nodeId) {
  const characters = await getAll('characters');
  const flags = await getAll('flags');

  let node = null;
  if (nodeId) {
    const allNodes = await getNodes(dialogueId);
    node = allNodes.find(n => n.id === nodeId);
  }

  const isNew = !node;
  const responses = node?.playerResponses || [];
  const parentOptions = nodeId
    ? [{ id: '', name: '(Nodo raíz)' }]
    : [{ id: '', name: '(Nodo raíz)' }];

  if (isNew && nodeId === null) {
    // Root node
  }

  const speakerOpts = [
    { id: '__player__', name: 'Jugador' },
    ...characters
  ];

  const responsesHtml = responses.map((resp, i) => `
    <div class="dynamic-array-item" data-response-index="${i}">
      <div class="dynamic-array-item-header">
        <span class="dynamic-array-item-title">Respuesta #${i + 1}</span>
        <button type="button" class="dynamic-array-remove" onclick="this.closest('.dynamic-array-item').remove()">&times;</button>
      </div>
      <div class="form-group">
        <label class="form-label">Texto del botón</label>
        <input type="text" class="form-input response-text" placeholder='Ej: "Acá tenés."' value="${escapeHtml(resp.text || '')}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Condición (Flag)</label>
          ${createSelect(flags, resp.conditionFlag || '', '— Sin condición —')}
        </div>
        <div class="form-group">
          <label class="form-label">Acción al seleccionar</label>
          <input type="text" class="form-input response-action" placeholder="Ej: setFlag:has_fernet" value="${escapeHtml(resp.actionOnSelect || '')}">
        </div>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Próximo Nodo</label>
        <input type="text" class="form-input response-next" placeholder="ID del próximo nodo, o '__end__' para terminar" value="${escapeHtml(resp.nextNodeId || '')}">
        <div class="form-hint">Escribí el ID de otro nodo para conectar, o "__end__" para finalizar el diálogo.</div>
      </div>
    </div>
  `).join('');

  const body = `
    <div class="form-group">
      <label class="form-label">Quién habla</label>
      ${createSelect(speakerOpts, node?.speakerId || '', '— Seleccionar —')}
    </div>
    <div class="form-group">
      <label class="form-label">Texto</label>
      <textarea class="form-textarea" id="node-editor-text" placeholder="Lo que se lee en pantalla...">${escapeHtml(node?.text || '')}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Respuestas del Jugador</label>
      <div class="form-hint">Las opciones que ve el jugador. Cada una puede llevar a un nodo diferente.</div>
      <div class="dynamic-array" id="responses-editor-container">
        ${responsesHtml}
      </div>
      <button type="button" class="dynamic-array-add mt-2" onclick="window.addResponseEditor()">+ Agregar Respuesta</button>
    </div>
  `;

  showModal(isNew ? 'Nuevo Nodo' : 'Editar Nodo', body, `
    <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" id="node-editor-save">${isNew ? 'Crear' : 'Guardar'}</button>
  `);

  document.getElementById('node-editor-save').onclick = async () => {
    const speakerSelect = document.querySelector('#modal .form-select');
    const text = document.getElementById('node-editor-text').value.trim();
    const speakerId = speakerSelect?.value || '';

    // Collect responses
    const respContainer = document.getElementById('responses-editor-container');
    const respItems = respContainer.querySelectorAll('.dynamic-array-item');
    const playerResponses = [];
    respItems.forEach(item => {
      const text = item.querySelector('.response-text')?.value.trim();
      if (text) {
        const selects = item.querySelectorAll('.form-select');
        playerResponses.push({
          text,
          conditionFlag: selects[0]?.value || null,
          actionOnSelect: item.querySelector('.response-action')?.value.trim() || null,
          nextNodeId: item.querySelector('.response-next')?.value.trim() || '__end__'
        });
      }
    });

    const data = { speakerId, text, playerResponses };

    try {
      if (isNew) {
        const newNodeId = await createNode(dialogueId, data);
        showToast('Nodo creado', 'success');
      } else {
        await updateNode(dialogueId, nodeId, data);
        showToast('Nodo actualizado', 'success');
      }
      closeModal();
      renderDialogueDetail(dialogueId);
    } catch (err) {
      console.error(err);
      showToast('Error: ' + err.message, 'error');
    }
  };
};

window.addResponseEditor = function() {
  const container = document.getElementById('responses-editor-container');
  const count = container.querySelectorAll('.dynamic-array-item').length;
  const lastItem = container.querySelector('.dynamic-array-item:last-child');
  const flagSelectHtml = lastItem?.querySelector('.form-select')?.innerHTML || '';

  container.insertAdjacentHTML('beforeend', `
    <div class="dynamic-array-item" data-response-index="${count}">
      <div class="dynamic-array-item-header">
        <span class="dynamic-array-item-title">Respuesta #${count + 1}</span>
        <button type="button" class="dynamic-array-remove" onclick="this.closest('.dynamic-array-item').remove()">&times;</button>
      </div>
      <div class="form-group">
        <label class="form-label">Texto del botón</label>
        <input type="text" class="form-input response-text" placeholder='Ej: "Acá tenés."'>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Condición (Flag)</label>
          <select class="form-select">${flagSelectHtml}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Acción al seleccionar</label>
          <input type="text" class="form-input response-action" placeholder="Ej: setFlag:has_fernet">
        </div>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Próximo Nodo</label>
        <input type="text" class="form-input response-next" placeholder="ID del próximo nodo, o '__end__'">
      </div>
    </div>
  `);
};

// ============================================
// Dialogue Info Editor (Create/Edit dialogue)
// ============================================

export async function renderDialogueForm(dialogueId = null) {
  const isNew = !dialogueId;
  setBreadcrumbs([
    { label: 'Diálogos', route: 'dialogues' },
    { label: isNew ? 'Nuevo Diálogo' : 'Editar' }
  ]);

  let dialogue = null;
  if (!isNew) {
    dialogue = await getOne('dialogues', dialogueId);
    if (!dialogue) {
      showToast('Diálogo no encontrado', 'error');
      window.location.hash = 'dialogues';
      return;
    }
  }

  const characters = await getAll('characters');

  renderWorkspace(`
    <div class="detail-header">
      <button class="detail-back" onclick="window.location.hash='dialogues'">&#9664; Volver</button>
      <h1 class="detail-title">${isNew ? 'Nuevo Diálogo' : escapeHtml(dialogue.name)}</h1>
    </div>
    <div class="form-container" style="max-width:560px;">
      <form id="dialogue-form">
        <div class="form-group">
          <label class="form-label">Nombre del Diálogo</label>
          <input type="text" class="form-input" id="dlg-name" placeholder='Ej: "Charla con Kiosquero"' value="${escapeHtml(dialogue?.name || '')}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Personaje Principal</label>
          ${createSelect(characters, dialogue?.characterId || '', '— Seleccionar —')}
          <div class="form-hint">El personaje que inicia este diálogo. El jugador puede responder.</div>
        </div>
        <div class="form-group">
          <label class="form-label">Descripción</label>
          <textarea class="form-textarea" id="dlg-description" placeholder="Contexto de este diálogo para el dev">${escapeHtml(dialogue?.description || '')}</textarea>
        </div>
        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary btn-lg">${isNew ? 'Crear Diálogo' : 'Guardar Cambios'}</button>
          ${!isNew ? `<button class="btn btn-danger" type="button" id="btn-delete-dlg">Eliminar</button>` : ''}
        </div>
      </form>
    </div>
  `);

  document.getElementById('dialogue-form').onsubmit = async (e) => {
    e.preventDefault();
    const selects = document.querySelectorAll('#dialogue-form .form-select');
    const data = {
      name: document.getElementById('dlg-name').value.trim(),
      characterId: selects[0]?.value || null,
      description: document.getElementById('dlg-description').value.trim()
    };

    if (!data.name) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }

    try {
      if (isNew) {
        const id = await create('dialogues', data);
        showToast('Diálogo creado. Ahora agregá nodos.', 'success');
        window.location.hash = `dialogues/${id}`;
      } else {
        await update('dialogues', dialogueId, data);
        showToast('Diálogo actualizado', 'success');
        window.location.hash = `dialogues/${dialogueId}`;
      }
    } catch (err) {
      console.error(err);
      showToast('Error: ' + err.message, 'error');
    }
  };

  if (!isNew) {
    document.getElementById('btn-delete-dlg').onclick = async () => {
      const ok = await confirm(`¿Eliminás "${dialogue.name}"?`);
      if (ok) {
        await remove('dialogues', dialogueId);
        showToast('Diálogo eliminado', 'success');
        window.location.hash = 'dialogues';
      }
    };
  }
}

async function openDialogueInfoEditor(dialogueId, dialogue, characters) {
  const speakerOpts = characters;
  const body = `
    <div class="form-group">
      <label class="form-label">Nombre</label>
      <input type="text" class="form-input" id="edit-dlg-name" value="${escapeHtml(dialogue.name)}">
    </div>
    <div class="form-group">
      <label class="form-label">Personaje Principal</label>
      ${createSelect(speakerOpts, dialogue.characterId || '', '— Seleccionar —')}
    </div>
    <div class="form-group">
      <label class="form-label">Descripción</label>
      <textarea class="form-textarea" id="edit-dlg-desc">${escapeHtml(dialogue.description || '')}</textarea>
    </div>
  `;

  showModal('Editar Diálogo', body, `
    <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" id="edit-dlg-save">Guardar</button>
  `);

  document.getElementById('edit-dlg-save').onclick = async () => {
    const name = document.getElementById('edit-dlg-name').value.trim();
    const charSelect = document.querySelector('#modal .form-select');
    const description = document.getElementById('edit-dlg-desc').value.trim();

    if (!name) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }

    await update('dialogues', dialogueId, {
      name,
      characterId: charSelect?.value || null,
      description
    });
    showToast('Diálogo actualizado', 'success');
    closeModal();
    renderDialogueDetail(dialogueId);
  };
}

window.addResponseToNode = async function(nodeId) {
  // Find the dialogueId from the current hash
  const parts = window.location.hash.slice(1).split('/');
  const dialogueId = parts[1];
  if (!dialogueId) return;

  const allNodes = await getNodes(dialogueId);
  const node = allNodes.find(n => n.id === nodeId);
  if (!node) return;

  const responses = node.playerResponses || [];
  responses.push({
    text: 'Nueva respuesta...',
    conditionFlag: null,
    actionOnSelect: null,
    nextNodeId: '__end__'
  });

  await updateNode(dialogueId, nodeId, { playerResponses: responses });
  showToast('Respuesta agregada (editá el nodo para completarla)', 'info');
  renderDialogueDetail(dialogueId);
};

window.editNodeResponse = async function(respId) {
  showToast('Editá el nodo padre para modificar las respuestas', 'info');
};
