// ============================================
// Simple Hash Router
// ============================================
import { setActiveNav } from './ui.js';

const routes = {};

/**
 * Register a route handler
 * @param {string} path - Hash path (e.g., 'rooms', 'rooms/new', 'rooms/:id')
 * @param {Function} handler - Callback function(hash)
 */
export function registerRoute(path, handler) {
  routes[path] = handler;
}

/**
 * Parse the current hash into route + params
 */
function parseHash() {
  const hash = window.location.hash.slice(1) || '';
  const parts = hash.split('/');
  return {
    module: parts[0],
    action: parts[1] || null,   // 'new' or an ID
    subaction: parts[2] || null  // For nested actions like 'nodes/new'
  };
}

/**
 * Match a route and call its handler
 */
export function navigate() {
  const { module, action, subaction } = parseHash();
  setActiveNav(module);

  // Try exact match first: module/action
  const exactKey = action ? `${module}/${action}` : module;
  if (routes[exactKey]) {
    routes[exactKey]({ module, action, subaction });
    return;
  }

  // Fallback: module only
  if (routes[module]) {
    routes[module]({ module, action, subaction });
    return;
  }

  // 404 — redirect to dashboard
  console.warn('No route found for:', hash);
  window.location.hash = '';
}

// Listen for hash changes
window.addEventListener('hashchange', navigate);

// Initial navigation
export function initRouter() {
  if (!window.location.hash || window.location.hash === '#') {
    window.location.hash = '';
    navigate();
  } else {
    navigate();
  }
}
