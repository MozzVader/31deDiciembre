# 31 de Diciembre — Adventure Design Toolbox

SPA para diseñar y planificar aventuras gráficas. Hecha con HTML, CSS y vanilla JS. Hospedada en GitHub Pages con Firestore como base de datos.

## Setup

1. Creá un proyecto en [Firebase Console](https://console.firebase.google.com)
2. Habilitá **Firestore Database** y **Authentication** (modo anónimo)
3. Copiá las credenciales de tu Web App en `js/config.js`
4. Hacé deploy a GitHub Pages

## Configuración Firebase

Editá `js/config.js` con los datos de tu proyecto:

```js
export const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

export const PROJECT_ID = "31deDiciembre";
```

## Estructura del Proyecto

```
31deDiciembre/
├── index.html          # Entry point
├── css/
│   └── styles.css      # Dark mode stylesheet
├── js/
│   ├── config.js       # Firebase config (editá esto!)
│   ├── db.js           # Firestore CRUD layer
│   ├── ui.js           # UI utilities (toasts, modals, etc.)
│   ├── router.js       # Hash-based SPA router
│   ├── app.js          # Main entry + route registration
│   ├── export.js       # JSON export for Visionaire
│   └── modules/
│       ├── rooms.js    # Habitaciones
│       ├── characters.js # Personajes
│       ├── items.js    # Inventario & Flags
│       ├── timeline.js # Cronología / Triggers
│       ├── dialogues.js # Diálogos
│       └── notes.js    # Notas sueltas (Markdown)
└── README.md
```

## Secciones

| Módulo | Descripción |
|--------|-------------|
| Habitaciones | Espacios físicos con salidas y condiciones |
| Personajes | NPCs con bio, ubicación y diálogos |
| Inventario & Flags | Items combinables + variables de estado |
| Cronología | Timeline de eventos y triggers |
| Diálogos | Árboles de diálogo con nodos anidados |
| Notas Sueltas | Editor Markdown para ideas rápidas |

## Exportar

El botón **"Exportar JSON"** genera un JSON listo para traducir a Visionaire Studio.

## Firestore Rules (recomendado para desarrollo)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/{projectId}/{document=**} {
      allow read, write: if true;
    }
  }
}
```

---

Hecho a las 3 AM con Fernet y Ganas.
