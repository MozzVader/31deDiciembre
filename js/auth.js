// ============================================
// Auth Module — Email / Password
// ============================================
import { auth } from './db.js';
import { resetAuth } from './db.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// DOM references
const authScreen = document.getElementById('auth-screen');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authName = document.getElementById('auth-name');
const authError = document.getElementById('auth-error');
const authSubmit = document.getElementById('auth-submit');
const authToggle = document.getElementById('auth-toggle');
const authToggleText = document.getElementById('auth-toggle-text');
const authForgot = document.getElementById('auth-forgot');
const authApp = document.getElementById('app');

let isRegisterMode = false;

/**
 * Show the auth screen, hide the app
 */
export function showAuth() {
  authScreen.style.display = 'flex';
  authApp.style.display = 'none';
}

/**
 * Hide the auth screen, show the app
 */
export function hideAuth() {
  authScreen.style.display = 'none';
  authApp.style.display = 'flex';
}

/**
 * Toggle between login and register mode
 */
authToggle.addEventListener('click', () => {
  isRegisterMode = !isRegisterMode;
  authError.textContent = '';

  if (isRegisterMode) {
    authTitle.textContent = 'Crear Cuenta';
    authSubtitle.textContent = 'Registrate para empezar a diseñar tu aventura';
    authName.parentElement.style.display = 'block';
    authSubmit.textContent = 'Registrarme';
    authToggleText.textContent = '¿Ya tenés cuenta?';
    authForgot.style.display = 'none';
  } else {
    authTitle.textContent = 'Iniciar Sesión';
    authSubtitle.textContent = 'Entrá a tu toolbox de diseño de aventuras';
    authName.parentElement.style.display = 'none';
    authSubmit.textContent = 'Entrar';
    authToggleText.textContent = '¿No tenés cuenta?';
    authForgot.style.display = 'block';
  }
});

/**
 * Forgot password
 */
authForgot.addEventListener('click', async () => {
  const email = authEmail.value.trim();
  if (!email) {
    authError.textContent = 'Escribí tu email para recibir el link de recuperación.';
    return;
  }
  try {
    authSubmit.disabled = true;
    authSubmit.textContent = 'Enviando...';
    await sendPasswordResetEmail(auth, email);
    authError.style.color = 'var(--success)';
    authError.textContent = 'Te enviamos un email para restablecer tu contraseña. Revisá tu casilla.';
    authSubmit.disabled = false;
    authSubmit.textContent = 'Entrar';
  } catch (err) {
    authError.style.color = 'var(--danger)';
    const messages = {
      'auth/user-not-found': 'No existe una cuenta con ese email.',
      'auth/invalid-email': 'Email inválido.',
      'auth/too-many-requests': 'Muchos intentos. Probá de nuevo más tarde.'
    };
    authError.textContent = messages[err.code] || err.message;
    authSubmit.disabled = false;
    authSubmit.textContent = 'Entrar';
  }
});

/**
 * Handle form submit (login or register)
 */
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.textContent = '';
  authError.style.color = 'var(--danger)';

  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (!email || !password) {
    authError.textContent = 'Completá email y contraseña.';
    return;
  }

  if (password.length < 6) {
    authError.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    return;
  }

  authSubmit.disabled = true;
  authError.textContent = '';

  try {
    if (isRegisterMode) {
      // Register
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      // Login
      await signInWithEmailAndPassword(auth, email, password);
    }
    // onAuthStateChanged in db.js will handle the rest
  } catch (err) {
    console.error('Auth error:', err);
    const messages = {
      'auth/email-already-in-use': 'Ya existe una cuenta con ese email.',
      'auth/invalid-email': 'Email inválido.',
      'auth/weak-password': 'La contraseña es muy débil (mínimo 6 caracteres).',
      'auth/user-not-found': 'No existe una cuenta con ese email.',
      'auth/wrong-password': 'Contraseña incorrecta.',
      'auth/invalid-credential': 'Email o contraseña incorrectos.',
      'auth/too-many-requests': 'Muchos intentos. Probá de nuevo más tarde.',
      'auth/network-request-failed': 'Error de conexión. Verificá tu internet.'
    };
    authError.textContent = messages[err.code] || `Error: ${err.message}`;
    authSubmit.disabled = false;
  }
});

/**
 * Logout handler
 */
export function setupLogout() {
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth);
        resetAuth();
        showAuth();
        authEmail.value = '';
        authPassword.value = '';
        authSubmit.disabled = false;
        authError.textContent = '';
      } catch (err) {
        console.error('Logout error:', err);
      }
    });
  }
}
