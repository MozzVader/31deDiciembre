<p align="center">
  <img src="https://img.shields.io/badge/version-1.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/license-CC%20BY--NC--ND%204.0-lightgrey?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/status-en%20desarrollo-orange?style=for-the-badge" alt="Status">
  <img src="https://img.shields.io/badge/commits-19-green?style=for-the-badge" alt="Commits">
  <img src="https://img.shields.io/badge/LOC-5.400%2B-blueviolet?style=for-the-badge" alt="Lines of Code">
</p>

<h1 align="center">31 de Diciembre — Adventure Design Toolbox</h1>

<p align="center">
  <strong>SPA para diseñar y planificar aventuras gráficas.</strong><br>
  Hecha con HTML, CSS y vanilla JS. Hospedada en GitHub Pages con Firestore como backend.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Firebase-FFCA28?style=flat&logo=firebase&logoColor=black" alt="Firebase">
  <img src="https://img.shields.io/badge/Firestore-4285F4?style=flat&logo=googlecloud&logoColor=white" alt="Firestore">
  <img src="https://img.shields.io/badge/GitHub%20Pages-222222?style=flat&logo=github&logoColor=white" alt="GitHub Pages">
  <img src="https://img.shields.io/badge/Visionaire%20Studio-9B59B6?style=flat&logo=gamepad&logoColor=white" alt="Visionaire">
</p>

---

## Vista general

Una toolbox pensada por y para desarrollores de aventuras gráficas. Permite modelar todos los elementos del juego — habitaciones, personajes, inventario, diálogos, triggers y notas — y exportar todo a un JSON estructurado listo para traducir a Visionaire Studio.

**Zero framework, zero build step.** Vanilla JS con ES modules, Firebase Auth + Firestore, y deploy directo a GitHub Pages.

## Módulos

| Icono | Módulo | Descripción |
|:-----:|--------|-------------|
| 🏠 | **Habitaciones** | Espacios físicos con salidas direccionales y condiciones de desbloqueo |
| 👥 | **Personajes** | NPCs con bio, rol y ubicación inicial en el mapa |
| 🎯 | **Inventario & Flags** | Items combinables con sistema `consumesSelf` / `consumesTarget` + variables de estado |
| ⏱️ | **Cronología** | Timeline de eventos con triggers condicionales y acciones |
| 💬 | **Diálogos** | Árboles de diálogo con nodos, respuestas del jugador y condiciones |
| 📝 | **Notas Sueltas** | Editor Markdown con toolbar WYSIWYG, preview en vivo y badges de estado |

### Sistema de Slugs

Cada entidad tiene un **slug** auto-generado y editable manualmente, usado como identificador estable en todo el sistema y en el JSON de exportación:

| Prefijo | Entidad | Ejemplo |
|---------|---------|---------|
| `room_` | Habitación | `room_bar_los_angeles` |
| `char_` | Personaje | `char_diego` |
| `item_` | Item | `item_fernet` |
| `event_` | Trigger | `event_inicio_juego` |
| `dlg_` | Diálogo | `dlg_monologo_inicial` |
| `node_` | Nodo de diálogo | `node_uffff_31_de_diciembre` |

## Export

El botón **"Exportar JSON"** genera un JSON completo con todas las entidades referenciadas por slug, listo para traducir a la estructura de Visionaire Studio.

```json
{
  "gameMeta": { "name": "...", "version": "1.0", "startRoomSlug": "..." },
  "rooms": [{ "slug": "...", "name": "...", "exits": [...] }],
  "characters": [{ "slug": "...", "startingRoomSlug": "..." }],
  "conditions": [{ "slug": "...", "defaultValue": false }],
  "items": [{ "slug": "...", "combinations": [...] }],
  "triggers": [{ "slug": "...", "conditionToFire": {...}, "actions": [...] }],
  "dialogues": [{ "slug": "...", "nodes": [{ "slug": "...", "playerResponses": [...] }] }]
}
```

## Setup

1. Cloná el repo
2. Creá un proyecto en [Firebase Console](https://console.firebase.google.com)
3. Habilitá **Firestore Database** y **Authentication** (email/password)
4. Copiá las credenciales de tu Web App en `js/config.js`
5. Hacé deploy a GitHub Pages

### Configuración Firebase

```js
// js/config.js
export const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

export const PROJECT_ID = "TU_PROJECT_ID";
```

### Firestore Rules (desarrollo)

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

## Estructura

```
31deDiciembre/
├── index.html              # Entry point
├── css/
│   └── styles.css          # Dark mode stylesheet
├── js/
│   ├── config.js           # Firebase credentials
│   ├── db.js               # Firestore CRUD + helpers
│   ├── ui.js               # Toasts, modals, render helpers
│   ├── router.js           # Hash-based SPA router
│   ├── app.js              # Main entry + route registration
│   ├── export.js           # Slug-based JSON export
│   └── modules/
│       ├── rooms.js        # Habitaciones
│       ├── characters.js   # Personajes
│       ├── items.js        # Inventario & Flags
│       ├── timeline.js     # Cronología / Triggers
│       ├── dialogues.js    # Diálogos + nodos
│       └── notes.js        # Notas Markdown con WYSIWYG
└── assets/                 # Imágenes estáticas
```

## Licencia

Este proyecto está licenciado bajo **Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0)**.

<p align="center">
  <img src="https://img.shields.io/badge/CC%20BY--NC--ND%204.0-EE3B24?style=for-the-badge" alt="CC BY-NC-ND 4.0">
</p>

> **Podés:** Compartir — copiar y redistribuir el material en cualquier medio o formato.<br>
> **Debés:** Dar crédito, no usar con fines comerciales y no modificar el contenido.

Ver el archivo [LICENSE](LICENSE) para más detalles.

---

<p align="center">
  <sub>Hecho a las 3 AM con Fernet y Ganas. 🧉</sub>
</p>
