// ============================================
// Export Module — JSON for Visionaire
// ============================================
import { getAll, getNodes } from './db.js';
import { showModal, closeModal, showToast, highlightJson } from './ui.js';

/**
 * Generate the full export JSON and show a preview
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

    // Build the export JSON
    const exportData = {
      gameMeta: {
        name: "31 de Diciembre",
        version: "1.0",
        exportedAt: new Date().toISOString(),
        startRoomId: rooms.find(r => r.exits?.length > 0)?.id || (rooms[0]?.id || null)
      },
      rooms: rooms.map(room => ({
        id: room.id,
        name: room.name,
        description: room.description || "",
        imageUrl: room.imageUrl || null,
        exits: (room.exits || []).map(exit => ({
          direction: exit.direction,
          target: exit.targetRoomId || null,
          condition: exit.conditionFlag || null
        }))
      })),
      characters: characters.map(char => ({
        id: char.id,
        name: char.name,
        role: char.role || "",
        bio: char.bio || "",
        avatarUrl: char.avatarUrl || null,
        startingRoom: char.initialRoomId || null,
        defaultDialogue: char.defaultDialogueId || null
      })),
      conditions: flags.map(flag => ({
        id: flag.id,
        name: flag.name,
        defaultValue: flag.state || false
      })),
      items: items.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description || "",
        iconUrl: item.iconUrl || null,
        combinableWith: item.isCombinable
          ? (item.combinations || []).map(c => ({
              combineWithItemId: c.combineWithItemId,
              resultItemId: c.resultItemId || null,
              resultFlagId: c.resultFlagId || null
            }))
          : []
      })),
      triggers: events.map(event => ({
        id: event.id,
        name: event.eventName,
        conditionToFire: {
          type: event.triggerCondition?.type || "FlagChange",
          flag: event.triggerCondition?.flagId || event.triggerCondition?.roomId || event.triggerCondition?.targetId || null,
          value: event.triggerCondition?.value ?? true
        },
        actions: (event.actions || []).map(action => {
          const base = { type: action.type };
          if (action.type === 'MoveCharacter') {
            base.target = action.target || null;
            base.destination = action.destination || null;
          } else if (action.type === 'SetFlag') {
            base.target = action.target || null;
            base.value = action.value ?? true;
          } else if (action.type === 'UnlockExit') {
            base.target = action.target || null;
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
      dialogues: dialogues.map(dlg => {
        const nodes = dialogueNodesMap[dlg.id] || [];
        // Find root node (no parent, or the first one)
        const rootNode = nodes[0] || null;

        return {
          id: dlg.id,
          name: dlg.name,
          character: dlg.characterId || null,
          description: dlg.description || "",
          rootNodeId: rootNode?.id || null,
          nodes: nodes.map(node => ({
            id: node.id,
            speaker: node.speakerId || null,
            text: node.text || "",
            responses: (node.playerResponses || []).map(resp => ({
              text: resp.text || "",
              conditionRequired: resp.conditionFlag || null,
              actionOnSelect: resp.actionOnSelect || null,
              nextNode: resp.nextNodeId || "__end__"
            }))
          }))
        };
      })
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const highlighted = highlightJson(exportData);

    // Show preview modal
    const body = `
      <div style="margin-bottom:12px;">
        <span class="text-xs text-muted">
          &#128230; ${rooms.length} habitaciones, ${characters.length} personajes, ${items.length} items, ${flags.length} flags, ${events.length} triggers, ${dialogues.length} diálogos
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
