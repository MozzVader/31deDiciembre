// ============================================
// App — Main Entry Point
// ============================================
import { initRouter, registerRoute } from './router.js';
import { renderRoomsList, renderRoomForm } from './modules/rooms.js';
import { renderCharactersList, renderCharacterForm } from './modules/characters.js';
import { renderItemsView, renderFlagsView, renderItemForm, renderFlagForm } from './modules/items.js';
import { renderTimelineList, renderTimelineForm } from './modules/timeline.js';
import { renderDialoguesList, renderDialogueDetail, renderDialogueForm } from './modules/dialogues.js';
import { renderNotesList, renderNoteEditor } from './modules/notes.js';
import { exportProject } from './export.js';
import { setActiveNav, closeModal } from './ui.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { auth } from './db.js';
import { showAuth, hideAuth, setupLogout } from './auth.js';

// ============================================
// Auth State Management
// ============================================
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is logged in — show app
    hideAuth();
    // Show user email in topbar
    updateUserDisplay(user);
    // Initialize router only after first auth
    if (!window._routerInitialized) {
      window._routerInitialized = true;
      initRouter();
    }
  } else {
    // No user — show login
    showAuth();
  }
});

function updateUserDisplay(user) {
  let userEl = document.getElementById('topbar-user');
  if (!userEl) {
    // Insert user info into topbar actions
    const topbarActions = document.getElementById('topbar-actions');
    userEl = document.createElement('div');
    userEl.id = 'topbar-user';
    userEl.className = 'topbar-user';
    topbarActions.insertBefore(userEl, topbarActions.firstChild);
  }
  userEl.innerHTML = `<span class="topbar-user-email" title="${user.email}">${user.email}</span>`;
}

// ============================================
// Register Routes
// ============================================

// Rooms
registerRoute('rooms', ({ action }) => {
  if (action === 'new') {
    renderRoomForm(null);
  } else if (action) {
    renderRoomForm(action);
  } else {
    renderRoomsList();
  }
});

// Characters
registerRoute('characters', ({ action }) => {
  if (action === 'new') {
    renderCharacterForm(null);
  } else if (action) {
    renderCharacterForm(action);
  } else {
    renderCharactersList();
  }
});

// Items & Flags
registerRoute('items', ({ action, subaction }) => {
  if (action === 'new') {
    renderItemForm(null);
  } else if (action === 'flags') {
    if (subaction === 'new') {
      renderFlagForm(null);
    } else if (subaction) {
      renderFlagForm(subaction);
    } else {
      renderFlagsView();
    }
  } else if (action) {
    renderItemForm(action);
  } else {
    renderItemsView();
  }
});

// Timeline
registerRoute('timeline', ({ action }) => {
  if (action === 'new') {
    renderTimelineForm(null);
  } else if (action) {
    renderTimelineForm(action);
  } else {
    renderTimelineList();
  }
});

// Dialogues
registerRoute('dialogues', ({ action }) => {
  if (action === 'new') {
    renderDialogueForm(null);
  } else if (action) {
    renderDialogueDetail(action);
  } else {
    renderDialoguesList();
  }
});

// Notes
registerRoute('notes', ({ action }) => {
  if (action === 'new') {
    renderNoteEditor(null);
  } else if (action) {
    renderNoteEditor(action);
  } else {
    renderNotesList();
  }
});

// ============================================
// Sidebar Navigation
// ============================================
document.querySelectorAll('.nav-item[data-route]').forEach(item => {
  item.addEventListener('click', () => {
    const route = item.dataset.route;
    window.location.hash = route;
  });
});

// ============================================
// Export Button
// ============================================
document.getElementById('btn-export').addEventListener('click', exportProject);

// ============================================
// Modal Close Handlers
// ============================================
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ============================================
// Logout
// ============================================
setupLogout();

// ============================================
// NOTE: Router initializes AFTER auth check
// (see onAuthStateChanged above)
// ============================================
