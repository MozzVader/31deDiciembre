// ============================================
// Firestore Database Layer
// ============================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  orderBy,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { firebaseConfig, PROJECT_ID } from './config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Track auth state — resolves when a user is logged in
let currentUser = null;
let authResolver = null;
let authReady = new Promise((resolve) => {
  authResolver = resolve;
});

// Listen for auth state changes (driven by auth.js module)
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    authResolver(user);
  }
});

// Wait for auth before any DB operation
export async function ensureAuth() {
  await authReady;
  if (!currentUser) {
    throw new Error('No autenticado. Iniciá sesión para continuar.');
  }
  return currentUser;
}

// Get current user
export function getCurrentUser() {
  return currentUser;
}

// Reset auth state (for logout)
export function resetAuth() {
  currentUser = null;
  authReady = new Promise((resolve) => {
    authResolver = resolve;
  });
}

// Helper: get the project document reference
function projectRef() {
  return doc(db, 'projects', PROJECT_ID);
}

// Helper: get a subcollection reference
function subcolRef(subcollection) {
  return collection(db, 'projects', PROJECT_ID, subcollection);
}

// Helper: get a specific document in a subcollection
function subdocRef(subcollection, docId) {
  return doc(db, 'projects', PROJECT_ID, subcollection, docId);
}

// Helper: get a node subcollection for dialogues
function nodesRef(dialogueId) {
  return collection(db, 'projects', PROJECT_ID, 'dialogues', dialogueId, 'nodes');
}

function nodeDocRef(dialogueId, nodeId) {
  return doc(db, 'projects', PROJECT_ID, 'dialogues', dialogueId, 'nodes', nodeId);
}

// ============================================
// Generic CRUD Operations
// ============================================

/**
 * Get document count from a subcollection (lightweight, no orderBy)
 */
export async function getCount(subcollection) {
  await ensureAuth();
  const snapshot = await getDocs(subcolRef(subcollection));
  return snapshot.size;
}

/**
 * Get all documents from a subcollection
 */
export async function getAll(subcollection) {
  await ensureAuth();
  const q = query(subcolRef(subcollection), orderBy('createdAt', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Get a single document from a subcollection
 */
export async function getOne(subcollection, docId) {
  await ensureAuth();
  const snap = await getDoc(subdocRef(subcollection, docId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Create a new document in a subcollection
 */
export async function create(subcollection, data) {
  await ensureAuth();
  const docRef = await addDoc(subcolRef(subcollection), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

/**
 * Update an existing document
 */
export async function update(subcollection, docId, data) {
  await ensureAuth();
  await updateDoc(subdocRef(subcollection, docId), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

/**
 * Delete a document
 */
export async function remove(subcollection, docId) {
  await ensureAuth();
  await deleteDoc(subdocRef(subcollection, docId));
}

/**
 * Create a document with a specific ID
 */
export async function createWithId(subcollection, docId, data) {
  await ensureAuth();
  await setDoc(subdocRef(subcollection, docId), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docId;
}

// ============================================
// Project Meta
// ============================================

export async function getProjectMeta() {
  await ensureAuth();
  const snap = await getDoc(projectRef());
  return snap.exists() ? snap.data() : { name: '31 de Diciembre', version: '1.0' };
}

export async function updateProjectMeta(data) {
  await ensureAuth();
  await setDoc(projectRef(), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

// ============================================
// Dialogue Nodes (Nested Subcollection)
// ============================================

export async function getNodes(dialogueId) {
  await ensureAuth();
  const q = query(nodesRef(dialogueId), orderBy('createdAt', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createNode(dialogueId, data) {
  await ensureAuth();
  const docRef = await addDoc(nodesRef(dialogueId), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

export async function updateNode(dialogueId, nodeId, data) {
  await ensureAuth();
  await updateDoc(nodeDocRef(dialogueId, nodeId), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function removeNode(dialogueId, nodeId) {
  await ensureAuth();
  await deleteDoc(nodeDocRef(dialogueId, nodeId));
}

// ============================================
// Utility: Generate a short ID
// ============================================
export function generateId(prefix = '') {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return prefix ? `${prefix}_${id}` : id;
}

// Export db and auth instances for advanced usage
export { db, auth };
