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
    const itemSlugMap = {};    // Firestore ID → slug
    const flagSlugMap = {};    // Firestore ID → name (flag name IS the slug)
    const dlgSlugMap = {};     // Firestore ID → slug

    rooms.forEach(r => { roomSlugMap[r.id] = r.slug || r.id; });
    characters.forEach(c => { charSlugMap[c.id] = c.slug || c.id; });
    items.forEach(i => { itemSlugMap[i.id] = i.slug || i.id; });
    flags.forEach(f => { flagSlugMap[f.id] = f.name; });
    dialogues.forEach(d => { dlgSlugMap[d.id] = d.slug || d.id; });

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
        })),
        hotspots: (room.hotspots || []).map(hs => ({
          slug: hs.slug || '',
          name: hs.name || '',
          description: hs.description || "",
          connectedItemSlug: hs.connectedItemSlug || null,
          interactions: (hs.interactions || []).map(int => ({
            type: int.type || 'examine',
            requiredItemSlug: int.requiredItemSlug || null,
            conditionSlug: int.conditionSlug || null,
            actions: (int.actions || []).map(act => {
              const a = { type: act.type };
              if (act.type === 'StartDialogue') {
                a.dialogueSlug = act.dialogueSlug || null;
                if (act.nodeSlug) a.nodeSlug = act.nodeSlug;
              } else if (act.type === 'AddItem' || act.type === 'RemoveItem') {
                a.itemSlug = act.itemSlug || null;
              } else if (act.type === 'SetFlag') {
                a.flagSlug = act.flagSlug || null;
                a.value = act.value ?? true;
              } else if (act.type === 'ChangeHotspotState') {
                a.hotspotSlug = act.hotspotSlug || null;
                a.newState = act.newState || null;
              }
              return a;
            })
          }))
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

      items: items.map(item => {
        const combos = (item.combinations || []).map(c => ({
          withItemSlug: itemSlugMap[c.withItemSlug] || itemSlugMap[c.combineWithItemId] || c.withItemSlug || null,
          resultItemSlug: itemSlugMap[c.resultItemSlug] || itemSlugMap[c.resultItemId] || c.resultItemSlug || null,
          consumesSelf: c.consumesSelf ?? false,
          consumesTarget: c.consumesTarget ?? true,
          resultDialogueSlug: c.resultDialogueSlug || null
        })).filter(c => c.withItemSlug);

        const interactions = (item.interactions || []).map(int => ({
          type: int.type || 'examine',
          actions: (int.actions || []).map(act => {
            const a = { type: act.type };
            if (act.type === 'StartDialogue') {
              a.dialogueSlug = act.dialogueSlug || null;
              if (act.nodeSlug) a.nodeSlug = act.nodeSlug;
            } else if (act.type === 'AddItem' || act.type === 'RemoveItem') {
              a.itemSlug = act.itemSlug || null;
            } else if (act.type === 'SetFlag') {
              a.flagSlug = act.flagSlug || null;
              a.value = act.value ?? true;
            }
            return a;
          })
        }));

        const exported = {
          slug: item.slug || item.id,
          name: item.name,
          description: item.description || ""
        };

        if (combos.length > 0) {
          exported.combinations = combos;
        }
        if (interactions.length > 0) {
          exported.interactions = interactions;
        }

        return exported;
      }),

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
            base.itemSlug = action.itemId || action.target
              ? (itemSlugMap[action.itemId || action.target] || action.itemId || action.target)
              : null;
          } else if (action.type === 'StartDialogue') {
            base.dialogueSlug = action.dialogueId || action.target
              ? (dlgSlugMap[action.dialogueId || action.target] || action.dialogueId || action.target)
              : null;
            base.nodeSlug = action.nodeSlug || null;
          } else {
            base.target = action.target || null;
            base.value = action.value || null;
          }
          return base;
        })
      })),

      dialogues: dialogues.map(dlg => {
        const nodes = dialogueNodesMap[dlg.id] || [];
        const charSlug = dlg.characterId ? (charSlugMap[dlg.characterId] || dlg.characterId) : null;

        // Build nodeSlugMap: Firestore node ID → slug (for resolving nextNodeSlug)
        const nodeSlugMap = {};
        nodes.forEach(n => { nodeSlugMap[n.id] = n.slug || n.id; });

        return {
          slug: dlg.slug || dlg.id,
          name: dlg.name,
          characterSlug: charSlug,
          description: dlg.description || "",
          nodes: nodes.map(node => ({
            slug: node.slug || node.id,
            speakerId: node.speakerId === '__player__' ? '__player__' : (charSlugMap[node.speakerId] || node.speakerId),
            text: node.text || "",
            playerResponses: (node.playerResponses || []).map(resp => ({
              text: resp.text || "",
              conditionFlag: resp.conditionFlag || null,
              actionOnSelect: resp.actionOnSelect || null,
              nextNodeSlug: nodeSlugMap[resp.nextNodeId] || resp.nextNodeSlug || resp.nextNodeId || "__end__"
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
          <i class="fa-solid fa-box"></i> ${rooms.length} habitaciones, ${characters.length} personajes, ${items.length} items, ${flags.length} flags, ${events.length} triggers, ${dialogues.length} diálogos
        </span>
      </div>
      <div class="json-preview" id="json-preview-content">${highlighted}</div>
    `;

    const footer = `
      <button class="btn btn-ghost" onclick="closeModal()">Cerrar</button>
      <button class="btn btn-primary" id="btn-download-json"><i class="fa-solid fa-download"></i> Descargar JSON</button>
      <button class="btn btn-success" id="btn-copy-json"><i class="fa-solid fa-clipboard"></i> Copiar al Portapapeles</button>
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
