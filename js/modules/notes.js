// ============================================
// Módulo: Notas Sueltas (Markdown Notes)
// ============================================
import { getAll, create, update, remove, getOne } from '../db.js';
import { renderWorkspace, setBreadcrumbs, showToast, confirm, escapeHtml } from '../ui.js';

let autoSaveTimer = null;

const STATUS_CYCLE = ['nueva', 'en_progreso', 'completada'];
const STATUS_LABELS = {
  nueva: '<i class="fa-solid fa-file"></i> Nueva',
  en_progreso: '<i class="fa-solid fa-wrench"></i> En progreso',
  completada: '<i class="fa-solid fa-circle-check"></i> Completada'
};

// Cambiar estado de una nota desde la card (click en badge)
window.cycleNoteStatus = async function(noteId, currentStatus) {
  const idx = STATUS_CYCLE.indexOf(currentStatus);
  const nextStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
  await update('notes', noteId, { status: nextStatus });
  showToast(`${STATUS_LABELS[nextStatus]}`, 'success');
  renderNotesList(); // re-render para ver el cambio
};

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
        <div class="empty-state-icon"><i class="fa-solid fa-pen-to-square" style="font-size:48px;"></i></div>
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
    const status = note.status || 'nueva';
    return `
      <div class="card" onclick="window.location.hash='notes/${note.id}'">
        <div class="card-meta" style="margin-top:0;margin-bottom:8px;">
          <span class="card-badge note-status-${status} note-status-badge"
                onclick="event.stopPropagation(); cycleNoteStatus('${note.id}', '${status}')"
                title="Click para cambiar estado">
            ${STATUS_LABELS[status] || STATUS_LABELS.nueva}
          </span>
          <span>${date}</span>
        </div>
        <div class="card-title">${escapeHtml(note.title || 'Sin título')}</div>
        <div class="card-description">${escapeHtml(preview)}</div>
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
  let isNew = !noteId;
  let currentNoteId = noteId; // mutable — se actualiza tras el primer create
  setBreadcrumbs([
    { label: 'Notas Sueltas', route: 'notes' },
    { label: isNew ? 'Nueva Nota' : 'Editar' }
  ]);

  let note = null;
  if (!isNew) {
    note = await getOne('notes', currentNoteId);
    if (!note) {
      showToast('Nota no encontrada', 'error');
      window.location.hash = 'notes';
      return;
    }
  }

  const content = note?.content || '';
  const title = note?.title || '';
  const status = note?.status || 'nueva';

  renderWorkspace(`
    <div class="detail-header">
      <button class="detail-back" onclick="window.location.hash='notes'"><i class="fa-solid fa-arrow-left"></i> Volver</button>
      <input type="text" class="form-input" id="note-title" placeholder="Título de la nota..." value="${escapeHtml(title)}" style="font-size:18px;font-weight:700;background:transparent;border:1px solid transparent;padding:4px 8px;max-width:400px;">
      <div class="detail-actions">
        <select id="note-status" class="form-select" style="font-size:12px;padding:4px 8px;border-radius:8px;">
          ${STATUS_CYCLE.map(s => `<option value="${s}" ${status === s ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}
        </select>
        <span class="text-xs text-muted" id="note-saved-status">Sin guardar</span>
        <button class="btn btn-ghost btn-sm" id="btn-export-md" title="Descargar .md"><i class="fa-solid fa-file-export"></i> Export MD</button>
        <button class="btn btn-ghost btn-sm" id="btn-save-note">Guardar</button>
        ${!isNew ? `<button class="btn btn-danger btn-sm" id="btn-delete-note">Eliminar</button>` : ''}
      </div>
    </div>

    <div class="notes-container">
      <div class="notes-editor">
        <div class="md-toolbar" id="md-toolbar">
          <button type="button" class="md-btn" data-action="h1" title="Título 1">H1</button>
          <button type="button" class="md-btn" data-action="h2" title="Título 2">H2</button>
          <button type="button" class="md-btn" data-action="h3" title="Título 3">H3</button>
          <span class="md-sep"></span>
          <button type="button" class="md-btn" data-action="bold" title="Negrita"><b>B</b></button>
          <button type="button" class="md-btn" data-action="italic" title="Cursiva"><i>I</i></button>
          <button type="button" class="md-btn" data-action="strike" title="Tachado"><s>S</s></button>
          <span class="md-sep"></span>
          <button type="button" class="md-btn" data-action="ul" title="Lista desordenada"><i class="fa-solid fa-list-ul"></i></button>
          <button type="button" class="md-btn" data-action="ol" title="Lista ordenada">1. Lista</button>
          <button type="button" class="md-btn" data-action="check" title="Tarea"><i class="fa-solid fa-square-check"></i></button>
          <span class="md-sep"></span>
          <button type="button" class="md-btn" data-action="code" title="Código inline (backtick)">&lt;code&gt;</button>
          <button type="button" class="md-btn" data-action="codeblock" title="Bloque de código (triple backtick)"><i class="fa-solid fa-code"></i></button>
          <span class="md-sep"></span>
          <button type="button" class="md-btn" data-action="link" title="Link"><i class="fa-solid fa-link"></i></button>
          <button type="button" class="md-btn" data-action="quote" title="Cita"><i class="fa-solid fa-quote-left"></i></button>
          <button type="button" class="md-btn" data-action="hr" title="Línea horizontal"><i class="fa-solid fa-minus"></i></button>
        </div>
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

  // WYSIWYG Toolbar
  const toolbar = document.getElementById('md-toolbar');
  if (toolbar) {
    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('.md-btn');
      if (!btn) return;
      e.preventDefault();
      insertMarkdown(btn.dataset.action);
      editor.focus();
    });
  }

  function insertMarkdown(action) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const sel = editor.value.substring(start, end);
    const before = editor.value.substring(0, start);
    const after = editor.value.substring(end);
    let insertion = '';
    let cursorOffset = 0;

    switch (action) {
      case 'h1':
        insertion = lineWrap(before, sel, after, '# '); break;
      case 'h2':
        insertion = lineWrap(before, sel, after, '## '); break;
      case 'h3':
        insertion = lineWrap(before, sel, after, '### '); break;
      case 'bold':
        insertion = wrapSelection(sel || 'negrita', '**', '**');
        cursorOffset = sel ? insertion.length : 2; break;
      case 'italic':
        insertion = wrapSelection(sel || 'cursiva', '*', '*');
        cursorOffset = sel ? insertion.length : 1; break;
      case 'strike':
        insertion = wrapSelection(sel || 'tachado', '~~', '~~');
        cursorOffset = sel ? insertion.length : 2; break;
      case 'ul':
        insertion = lineWrap(before, sel, after, '- '); break;
      case 'ol':
        insertion = lineWrap(before, sel, after, '1. '); break;
      case 'check':
        insertion = lineWrap(before, sel, after, '- [ ] '); break;
      case 'code':
        insertion = wrapSelection(sel || 'codigo', '`', '`');
        cursorOffset = sel ? insertion.length : 1; break;
      case 'codeblock': {
        if (sel) {
          // Hay texto seleccionado: envolver en bloque
          insertion = '\n```\n' + sel + '\n```\n';
          editor.selectionStart = start + 4; // después de ```\n
          editor.selectionEnd = start + 4 + sel.length;
        } else {
          // Sin selección: abrir bloque con placeholder de lenguaje
          insertion = '\n```lang\n\n```\n';
          // Seleccionar "lang" para que el usuario escriba el nombre o lo borre
          const langStart = before.length + 4; // después de \n```
          editor.selectionStart = langStart;
          editor.selectionEnd = langStart + 3; // "lang"
        }
        editor.value = before + insertion + after;
        editor.dispatchEvent(new Event('input'));
        return;
      }
      case 'link':
        insertion = '[' + (sel || 'texto') + '](url)';
        cursorOffset = sel ? insertion.length - 1 : 1; break;
      case 'quote':
        insertion = lineWrap(before, sel, after, '> '); break;
      case 'hr':
        insertion = '\n---\n';
        cursorOffset = insertion.length; break;
    }

    editor.value = before + insertion + after;

    // Restore selection
    if (sel) {
      // Si había selección, seleccionar todo el texto insertado
      editor.selectionStart = start;
      editor.selectionEnd = start + insertion.length;
    } else {
      // Sin selección: buscar placeholder y seleccionarlo para que el usuario escriba
      const phMatch = insertion.match(/(negrita|cursiva|tachado|codigo|texto)/);
      if (phMatch) {
        const phStart = before.length + insertion.indexOf(phMatch[1]);
        editor.selectionStart = phStart;
        editor.selectionEnd = phStart + phMatch[1].length;
      } else {
        // Sin placeholder (headings, listas, hr): cursor al final
        editor.selectionStart = editor.selectionEnd = start + insertion.length;
      }
    }

    // Trigger preview update
    editor.dispatchEvent(new Event('input'));
  }

  function wrapSelection(text, prefix, suffix) {
    return prefix + text + suffix;
  }

  function lineWrap(before, sel, after, prefix) {
    // If at start of line or line is empty, just prepend
    const lineStart = before.lastIndexOf('\n') + 1;
    const currentLine = before.substring(lineStart);
    if (currentLine.trim() === '' || lineStart === before.length) {
      return prefix + (sel || 'texto');
    }
    // Otherwise add a newline first
    return '\n' + prefix + (sel || 'texto');
  }

  // Status badge
  const statusSelect = document.getElementById('note-status');
  if (statusSelect) {
    statusSelect.onchange = async () => {
      // Solo actualizar el status en Firestore sin esperar auto-save
      if (currentNoteId) {
        await update('notes', currentNoteId, { status: statusSelect.value });
        showToast('Estado actualizado', 'success');
      }
    };
  }

  editor.oninput = () => {
    preview.innerHTML = renderMarkdown(editor.value);
    document.getElementById('note-saved-status').textContent = 'Sin guardar...';
    document.getElementById('note-saved-status').style.color = 'var(--warning)';

    // Auto-save debounce
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => saveNote(), 2000);
  };

  // Export MD button
  document.getElementById('btn-export-md').onclick = () => {
    const noteTitle = document.getElementById('note-title').value.trim() || 'sin-titulo';
    const filename = noteTitle
      .toLowerCase()
      .replace(/[^a-z0-9áéíóúñ\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-') + '.md';
    const blob = new Blob([editor.value], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Descargado: ${filename}`, 'success');
  };

  // Save button
  document.getElementById('btn-save-note').onclick = () => saveNote();

  // Delete
  if (!isNew) {
    document.getElementById('btn-delete-note').onclick = async () => {
      const ok = await confirm('¿Eliminás esta nota?');
      if (ok) {
        await remove('notes', currentNoteId);
        showToast('Nota eliminada', 'success');
        window.location.hash = 'notes';
      }
    };
  }

  async function saveNote() {
    const data = {
      title: document.getElementById('note-title').value.trim() || 'Sin título',
      content: editor.value,
      status: document.getElementById('note-status')?.value || 'nueva'
    };

    try {
      if (isNew || !currentNoteId) {
        const id = await create('notes', data);
        currentNoteId = id; // <— clave: actualizar la referencia
        isNew = false;       // <— ya no es nueva
        showToast('Nota creada', 'success');
        // Update URL without re-rendering
        window.history.replaceState(null, '', '#notes/' + id);
        document.getElementById('note-saved-status').textContent = 'Guardado';
        document.getElementById('note-saved-status').style.color = 'var(--success)';
      } else {
        await update('notes', currentNoteId, data);
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

  let html;

  // Use marked.js if available
  if (typeof marked !== 'undefined') {
    try {
      html = marked.parse(text);
    } catch (e) {
      html = null;
    }
  }

  // Basic markdown fallback
  if (!html) {
    html = escapeHtml(text);
    // Fenced code blocks: ```lang\ncode\n```
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const label = lang ? `<div class="code-block-lang">${lang}</div>` : '';
      return `${label}<pre><code>${code.trim()}</code></pre>`;
    });
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
  }

  // Post-process: add language labels to code blocks rendered by marked.js
  if (html && typeof marked !== 'undefined') {
    html = html.replace(/<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g,
      '<div class="code-block-lang">$1</div><pre><code class="language-$1">$2</code></pre>');
  }

  return html;
}
