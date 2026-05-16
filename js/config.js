// ============================================
// Firebase Configuration
// ============================================
// IMPORTANTE: Reemplaza estos valores con los datos de tu proyecto Firebase.
// 1. Creá un proyecto en https://console.firebase.google.com
// 2. Agregá una Web App desde la configuración del proyecto
// 3. Habilitá Firestore Database y Firebase Storage
// 4. Copiá la configuración aquí
// ============================================

export const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

// ID del proyecto dentro de Firestore (la colección raíz)
// Esto permite tener múltiples proyectos de aventura en el mismo Firestore
export const PROJECT_ID = "31deDiciembre";
