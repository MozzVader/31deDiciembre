// ============================================
// Export Module — JSON for Visionaire
// ============================================
import { getAll, getNodes } from './db.js';
import { showModal, closeModal, showToast, highlightJson } from './ui.js';

/**
 * Generate the full export JSON and show a preview.
 * Uses slug-based references instead of Firestore IDs.
 */
export async function exportProject() {
  showToast('Generando JSON de exportación...', 'info');

  try {
    // Fetch everything in parallel
    const [rooms, characters, items, flags, events, dialogues] = await Promise.all([
      getAll('rooms'),
      getAll('characters'),
      getAll('items'),
      getAll('flags'),
      getAll('timeline'),
      getAll('dialogues')
    ]);

    // Fetch all dialogue nodes
    const dialogueNodesMap = {};
    for (const dlg of dialogues) {
      const nodes = await getNodes(dlg.id);
      dialogueNodesMap[dlg.id] = nodes;
    }

    // ============================================
    // Build ID → Slug maps for resolving references
    // ============================================
    const roomSlugMap = {};    // Firestore ID → slug
    const charSlugMap = {};    // Firestore ID → slug
    const flagSlugMap = {};    // Firestore ID → name (flag name IS the slug)

    rooms.forEach(r => { roomSlugMap[r.id] = r.slug || r.id; });
    characters.forEach(c => { charSlugMap[c.id] = c.slug || c.id; });
    flags.forEach(f => { flagSlugMap[f.id] = f.name; });

    // ============================================
    // Build the export JSON — slug-based
    // ============================================
    const exportData = {
      gameMeta: {
        name: "31 de Diciembre: Astronauta en la vereda",
        version: "1.0",
        startRoomSlug: rooms.find(r => r.exits?.length > 0)
          ? (rooms.find(r => r.exits?.length > 0).slug || null)
          : (rooms[0]?.slug || null)
      },

      rooms: rooms.map(room => ({
        slug: room.slug || room.id,
        name: room.name,
        description: room.description || "",
        exits: (room.exits || []).map(exit => ({
          direction: exit.direction,
          targetSlug: roomSlugMap[exit.targetRoomId] || null,
          conditionSlug: exit.conditionFlag || null
        }))
      })),

      characters: characters.map(char => ({
        slug: char.slug || char.id,
        name: char.name,
        role: char.role || "",
        startingRoomSlug: roomSlugMap[char.initialRoomId] || null
      })),

      conditions: flags.map(flag => ({
        slug: flag.name,
        defaultValue: flag.state || false
      })),

      items: items.map(item => ({
        slug: item.slug || item.id,
        name: item.name,
        description: item.description || ""
      })),

      triggers: events.map(event => ({
        slug: event.slug || event.id,
        name: event.eventName,
        conditionToFire: {
          type: event.triggerCondition?.type || "FlagChange",
          flag: event.triggerCondition?.flagId
            ? (flagSlugMap[event.triggerCondition.flagId] || event.triggerCondition.flagId)
            : (event.triggerCondition?.targetId || null),
          value: event.triggerCondition?.value ?? true
        },
        actions: (event.actions || []).map(action => {
          const base = { type: action.type };
          if (action.type === 'MoveCharacter') {
            base.target = action.target ? (charSlugMap[action.target] || action.target) : null;
            base.destination = action.destination ? (roomSlugMap[action.destination] || action.destination) : null;
          } else if (action.type === 'SetFlag') {
            base.target = action.target ? (flagSlugMap[action.target] || action.target) : null;
            base.value = action.value ?? true;
          } else if (action.type === 'UnlockExit') {
            base.target = action.target ? (roomSlugMap[action.target] || action.target) : null;
            base.exitDirection = action.exitDirection || null;
          } else if (action.type === 'GiveItem' || action.type === 'RemoveItem') {
            base.itemId = action.itemId || action.target || null;
          } else if (action.type === 'StartDialogue') {
            base.dialogueId = action.dialogueId || action.target || null;
          } else {
            base.target = action.target || null;
            base.value = action.value || null;
          }
          return base;
        })
      })),

      dialogues: []
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const highlighted = highlightJson(exportData);

    // Show preview modal
    const body = `
      <div style="margin-bottom:12px;">
        <span class="text-xs text-muted">
          &#128230; ${rooms.length} habitaciones, ${characters.length} personajes, ${items.length} items, ${flags.length} flags, ${events.length} triggers
        </span>
      </div>
      <div class="json-preview" id="json-preview-content">${highlighted}</div>
    `;

    const footer = `
      <button class="btn btn-ghost" onclick="closeModal()">Cerrar</button>
      <button class="btn btn-primary" id="btn-download-json">&#128229; Descargar JSON</button>
      <button class="btn btn-success" id="btn-copy-json">&#128203; Copiar al Portapapeles</button>
    `;

    showModal('Exportar a JSON — Visionaire Bible', body, footer);

    // Download
    document.getElementById('btn-download-json').onclick = () => {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `31deDiciembre_design_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('JSON descargado', 'success');
    };

    // Copy
    document.getElementById('btn-copy-json').onclick = () => {
      navigator.clipboard.writeText(jsonStr).then(() => {
        showToast('Copiado al portapapeles', 'success');
      }).catch(() => {
        showToast('No se pudo copiar', 'error');
      });
    };

  } catch (err) {
    console.error('Export error:', err);
    showToast('Error al exportar: ' + err.message, 'error');
  }
}
