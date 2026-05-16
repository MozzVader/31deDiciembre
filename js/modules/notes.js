// ============================================
// Módulo: Notas Sueltas (Markdown Notes)
// ============================================
import { getAll, create, update, remove, getOne } from '../db.js';
import { renderWorkspace, setBreadcrumbs, showToast, confirm, escapeHtml } from '../ui.js';

let autoSaveTimer = null;

export async function renderNotesList() {
  setBreadcrumbs([{ label: 'Notas Sueltas' }]);
  const notes = await getAll('notes');

  if (notes.length === 0) {
    renderWorkspace(`
      <div class="workspace-header">
        <div>
          <h1 class="workspace-title">Notas Sueltas</h1>
          <p class="workspace-subtitle">Para anotar ideas a las 3 AM</p>
        </div>
        <button class="btn btn-primary" onclick="window.location.hash='notes/new'">+ Nueva Nota</button>
      </div>
      <div class="empty-state">
        <div class="empty-state-icon">&#128221;</div>
        <div class="empty-state-title">No hay notas todavía</div>
        <div class="empty-state-text">Un dump de ideas sin estructura. Markdown friendly. Para cuando te despiertás a las 3 AM con una idea genial.</div>
        <button class="btn btn-primary" onclick="window.location.hash='notes/new'">+ Crear Nota</button>
      </div>
    `);
    return;
  }

  const cards = notes.map(note => {
    const preview = (note.content || '').slice(0, 120).replace(/[#*_`]/g, '');
    const date = note.updatedAt ? new Date(note.updatedAt.seconds * 1000).toLocaleDateString('es-AR') : '';
    return `
      <div class="card" onclick="window.location.hash='notes/${note.id}'">
        <div class="card-title">${escapeHtml(note.title || 'Sin título')}</div>
        <div class="card-description">${escapeHtml(preview)}</div>
        <div class="card-meta">
          <span>${date}</span>
        </div>
      </div>
    `;
  }).join('');

  renderWorkspace(`
    <div class="workspace-header">
      <div>
        <h1 class="workspace-title">Notas Sueltas</h1>
        <p class="workspace-subtitle">${notes.length} nota${notes.length !== 1 ? 's' : ''}</p>
      </div>
      <button class="btn btn-primary" onclick="window.location.hash='notes/new'">+ Nueva Nota</button>
    </div>
    <div class="card-grid">${cards}</div>
  `);
}

export async function renderNoteEditor(noteId = null) {
  const isNew = !noteId;
  setBreadcrumbs([
    { label: 'Notas Sueltas', route: 'notes' },
    { label: isNew ? 'Nueva Nota' : 'Editar' }
  ]);

  let note = null;
  if (!isNew) {
    note = await getOne('notes', noteId);
    if (!note) {
      showToast('Nota no encontrada', 'error');
      window.location.hash = 'notes';
      return;
    }
  }

  const content = note?.content || '';
  const title = note?.title || '';

  renderWorkspace(`
    <div class="detail-header">
      <button class="detail-back" onclick="window.location.hash='notes'">&#9664; Volver</button>
      <input type="text" class="form-input" id="note-title" placeholder="Título de la nota..." value="${escapeHtml(title)}" style="font-size:18px;font-weight:700;background:transparent;border:1px solid transparent;padding:4px 8px;max-width:400px;">
      <div class="detail-actions">
        <span class="text-xs text-muted" id="note-saved-status">Sin guardar</span>
        <button class="btn btn-ghost btn-sm" id="btn-save-note">Guardar</button>
        ${!isNew ? `<button class="btn btn-danger btn-sm" id="btn-delete-note">Eliminar</button>` : ''}
      </div>
    </div>

    <div class="notes-container">
      <div class="notes-editor">
        <textarea id="note-editor" placeholder="# Escribí acá...

## Subtítulos
- Listas
- **Negrita** e *cursiva*
- \`código\`

> Citar cosas

[Links](https://example.com)">${escapeHtml(content)}</textarea>
      </div>
      <div class="notes-divider"></div>
      <div class="notes-preview" id="note-preview">
        ${renderMarkdown(content)}
      </div>
    </div>
  `);

  // Live preview
  const editor = document.getElementById('note-editor');
  const preview = document.getElementById('note-preview');

  editor.oninput = () => {
    preview.innerHTML = renderMarkdown(editor.value);
    document.getElementById('note-saved-status').textContent = 'Sin guardar...';
    document.getElementById('note-saved-status').style.color = 'var(--warning)';

    // Auto-save debounce
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => saveNote(noteId), 2000);
  };

  // Save button
  document.getElementById('btn-save-note').onclick = () => saveNote(noteId);

  // Delete
  if (!isNew) {
    document.getElementById('btn-delete-note').onclick = async () => {
      const ok = await confirm('¿Eliminás esta nota?');
      if (ok) {
        await remove('notes', noteId);
        showToast('Nota eliminada', 'success');
        window.location.hash = 'notes';
      }
    };
  }

  async function saveNote(currentId) {
    const data = {
      title: document.getElementById('note-title').value.trim() || 'Sin título',
      content: editor.value
    };

    try {
      if (isNew || !currentId) {
        const id = await create('notes', data);
        showToast('Nota creada', 'success');
        // Update URL without re-rendering
        window.history.replaceState(null, '', '#notes/' + id);
        document.getElementById('note-saved-status').textContent = 'Guardado';
        document.getElementById('note-saved-status').style.color = 'var(--success)';
      } else {
        await update('notes', currentId, data);
        document.getElementById('note-saved-status').textContent = 'Guardado';
        document.getElementById('note-saved-status').style.color = 'var(--success)';
      }
    } catch (err) {
      console.error(err);
      showToast('Error al guardar: ' + err.message, 'error');
    }
  }

  // Trigger initial render
  preview.innerHTML = renderMarkdown(content);
}

function renderMarkdown(text) {
  if (!text) return '<p style="color:var(--text-muted);font-style:italic;">Escribí algo en el editor de la izquierda...</p>';

  // Use marked.js if available
  if (typeof marked !== 'undefined') {
    try {
      return marked.parse(text);
    } catch (e) {
      // Fallback to basic rendering
    }
  }

  // Basic markdown fallback
  let html = escapeHtml(text);
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;
  return html;
}
