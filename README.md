<p align="center">
  <img src="https://img.shields.io/badge/version-1.4-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/license-CC%20BY--NC--ND%204.0-lightgrey?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/status-en%20desarrollo-orange?style=for-the-badge" alt="Status">
  <img src="https://img.shields.io/badge/commits-43-green?style=for-the-badge" alt="Commits">
  <img src="https://img.shields.io/badge/LOC-9.400%2B-blueviolet?style=for-the-badge" alt="Lines of Code">
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

Una toolbox pensada por y para desarrolladores de aventuras gráficas. Permite modelar todos los elementos del juego — habitaciones con hotspots interactivos, personajes, inventario con combinaciones e interacciones, diálogos en árbol, triggers condicionales y notas — y exportar todo a un JSON estructurado listo para traducir a Visionaire Studio.

**Zero framework, zero build step.** Vanilla JS con ES modules, Firebase Auth + Firestore, y deploy directo a GitHub Pages.

## Autenticación

El sistema incluye registro y login con Firebase Authentication:

- **Registro** con email, contraseña y nombre
- **Login** con email y contraseña
- **Recuperación de contraseña** via email
- **Logout** desde el sidebar
- Email del usuario visible en el topbar una vez autenticado

Todo el flujo de autenticación se maneja en un screen dedicado antes de acceder al editor.

## Módulos

| Icono | Módulo | Descripción |
|:-----:|--------|-------------|
| 🏠 | **Dashboard** | Página de inicio con resumen del proyecto, estadísticas clickeables y últimas ediciones |
| 🗺️ | **Habitaciones** | Espacios físicos con salidas direccionales, condiciones de desbloqueo y sistema completo de hotspots interactivos |
| 👥 | **Personajes** | NPCs con bio, rol, ubicación inicial, avatar y diálogo por defecto |
| 🎯 | **Inventario & Flags** | Items combinables con sistema `consumesSelf` / `consumesTarget`, interacciones propias y variables de estado |
| ⏱️ | **Cronología** | Timeline de eventos con triggers condicionales y acciones contextuales |
| 💬 | **Diálogos** | Árboles de diálogo con nodos, respuestas del jugador, condiciones y acciones |
| 📝 | **Notas Sueltas** | Editor Markdown con toolbar WYSIWYG, preview en vivo, auto-save, badges de estado y To-Do list integrada |
| 🎬 | **Sprite Viewer** | Visor/probador de spritesheets con controles de grilla, velocidad, zoom y selector de dirección |
| 🏆 | **Hitos del Proyecto** | Línea temporal vertical con milestones categorizados (Arte, Código, Diseño, Historia, General) |

### Dashboard

Página de inicio por defecto al abrir el proyecto. Incluye:

- **Nombre del proyecto** editable inline (clic para editar, Enter para guardar)
- **Fecha de creación** editable con date picker (se guarda una vez y queda fija)
- **Última modificación** calculada automáticamente a partir de la entidad más recientemente editada
- **Tarjetas de estadísticas**: contadores clickeables para cada módulo (habitaciones, personajes, items, flags, triggers, diálogos, notas, nodos) que navegan al módulo correspondiente
- **Últimas ediciones**: listado de las 8 entidades más recientemente modificadas, con badges de tipo coloridos y enlaces directos

### Habitaciones — Hotspots

Cada habitación puede contener múltiples **hotspots** (objetos de escena interactivos). Cada hotspot es una tarjeta colapsable que incluye:

- **Nombre, slug y descripción** del objeto
- **Item conectado** — vincula el hotspot a un item del inventario para trazabilidad
- **Interacciones** — tipos disponibles: Examinar, Usar, Abrir, Cerrar, Usar Item En Este, Recoger, Hablar
- Cada interacción puede tener **condición (flag)** e **item requerido** como prerequisitos
- **Acciones por interacción**: Iniciar Diálogo, Agregar Item, Remover Item, Setear Flag, Cambiar Estado del Hotspot

### Inventario — Interacciones de Items

Además del sistema de combinaciones (item A + item B → resultado), cada item puede tener sus propias interacciones:

- **Tipos**: Examinar (click derecho), Usar (click izquierdo), Abrir, Cerrar, Recoger, Dar
- Cada interacción soporta **condición (flag)** y **acciones** (Iniciar Diálogo, Agregar/Remover Item, Setear Flag)
- Separación clara entre combinaciones (dos items → resultado) e interacciones (acciones sobre un item individual)

### Cronología — Triggers y Acciones

El timeline soporta **5 tipos de triggers** que disparan eventos automáticamente:

| Trigger | Descripción |
|---------|-------------|
| `FlagChange` | Se dispara cuando un flag cambia a un valor específico |
| `RoomEnter` | Se dispara al entrar a una habitación |
| `ItemPickup` | Se dispara al recoger un item |
| `DialogueEnd` | Se dispara al finalizar un diálogo |
| `AutoStart` | Se dispara al inicio del juego (sin target) |

Y **6 tipos de acciones** con dropdowns contextuales que cambian según el tipo:

| Acción | Parámetros |
|--------|-----------|
| `MoveCharacter` | Personaje → Habitación destino |
| `SetFlag` | Flag → Valor |
| `UnlockExit` | Habitación → Dirección |
| `GiveItem` | Item al jugador |
| `RemoveItem` | Item del jugador |
| `StartDialogue` | Diálogo → Nodo inicial (opcional) |

### Diálogos

Árboles de diálogo con nodos anidados:

- Cada nodo tiene **texto del speaker**, **ID del hablante** (personaje) y respuestas del jugador
- Cada respuesta puede tener **condición (flag)** para mostrarla u ocultarla
- **Acción al seleccionar** una respuesta: Iniciar Diálogo, Setear Flag, etc.
- Navegación entre nodos mediante el campo "Ir al Nodo"

### Notas Sueltas

Editor de notas con funcionalidades avanzadas, dividido en dos secciones:

**Tarjetas de notas** (arriba):
- **Toolbar WYSIWYG**: negrita, cursiva, links, imágenes, code blocks, listas
- **Preview en vivo** que renderiza Markdown en tiempo real
- **Auto-save** con debounce de 2 segundos
- **Exportar como .md** — descarga directa del archivo Markdown
- **Badges de estado**: Nueva → En Progreso → Completada (clic para ciclar)

**To-Do List** (abajo):
- **Agregar tareas**: input inline + Enter
- **Check/Uncheck**: clic en el checkbox, las completadas van al final con tachado
- **Editar inline**: doble clic en el texto para editar, Enter para guardar, Escape para cancelar
- **Eliminar**: botón × que aparece al pasar el mouse
- **Barra de progreso** con contador X/Y completadas
- **Limpiar**: botón para eliminar todas las tareas completadas de una
- Tareas almacenadas en Firestore (subcolección `todos`)

### Sprite Viewer

Herramienta para probar spritesheets de personajes en tiempo real:

- **Upload de imagen** desde disco (drag & drop o selector), se procesa localmente sin persistir
- **Controles configurables**: columnas, filas, FPS (1-60) y zoom (1x a 8x)
- **Play/Pause**, frame anterior/siguiente, reset y slider para navegar frames
- **Selector de dirección**: botones para reproducir una fila individual (Abajo, Izquierda, Derecha, Arriba) o "Todas" para reproducir el sheet completo
- **Vista previa del sheet** con grilla superpuesta y escala automática
- **Panel de info**: nombre del archivo, tamaño de imagen, tamaño de frame, total de frames, frame actual

### Hitos del Proyecto

Línea temporal vertical para registrar los momentos importantes del desarrollo:

- **Timeline visual** con línea vertical, nodos circulares coloridos y cards con fecha, título, descripción e imagen
- **5 categorías** con colores e íconos: Arte, Código, Diseño, Historia, General
- **Imagen adjunta** opcional (upload desde disco o URL) — ideal para screenshots del estado del juego
- Ordenado por fecha descendente (más reciente primero)
- CRUD completo: crear, editar, eliminar hitos

## Features de UX

### Quick Create Inline (+)

Desde cualquier dropdown que referencie otra entidad (flags, items, diálogos, nodos), un botón **"+"** permite crear la entidad al vuelo sin abandonar el formulario actual. La nueva entidad se guarda en Firestore, se agrega al dropdown y se auto-selecciona.

### Combobox — Dropdowns con Búsqueda Integrada

Todos los dropdowns principales se reemplazan por **comboboxes custom** con búsqueda integrada:

- Escritura en tiempo real para filtrar opciones
- Navegación con teclado (flechas ↑↓, Enter, Escape, Tab)
- Resaltado del texto coincidente en cada opción
- Auto-inicialización vía MutationObserver tras contenido dinámico

### Imágenes

- **Habitaciones**: imagen de fondo con upload desde disco (FileReader → base64), URL o botón para limpiar. Thumbnails en la grilla de tarjetas.
- **Personajes**: avatar circular con el mismo sistema de upload/URL/clear.
- **Hitos**: imagen adjunta opcional con upload desde disco o URL.
- **Sprite Viewer**: imagen cargada localmente desde disco, no se persiste.

### Slugs

Cada entidad tiene un **slug** auto-generado y editable manualmente, usado como identificador estable en todo el sistema y en el JSON de exportación:

| Prefijo | Entidad | Ejemplo |
|---------|---------|---------|
| `room_` | Habitación | `room_bar_los_angeles` |
| `char_` | Personaje | `char_diego` |
| `item_` | Item | `item_fernet` |
| `event_` | Trigger | `event_inicio_juego` |
| `dlg_` | Diálogo | `dlg_monologo_inicial` |
| `node_` | Nodo de diálogo | `node_uffff_31_de_diciembre` |
| `hotspot_` | Hotspot | `hotspot_cubetera` |

## Export

El botón **"Exportar JSON"** abre un modal con:

- **Preview** del JSON con syntax highlighting
- **Descarga** como archivo timestamped (`31deDiciembre_design_<timestamp>.json`)
- **Copiar al portapapeles**
- Resumen de entidades exportadas (X habitaciones, Y personajes, Z items, etc.)

El JSON incluye todas las entidades referenciadas por slug, con hotspots, interacciones de items, nodos de diálogo con condiciones y acciones:

```json
{
  "gameMeta": { "name": "...", "version": "1.0", "startRoomSlug": "..." },
  "rooms": [{
    "slug": "room_bar_los_angeles",
    "name": "Bar Los Ángeles",
    "exits": [...],
    "hotspots": [{
      "slug": "hotspot_cubetera",
      "name": "Cubetera",
      "interactions": [{
        "type": "examine",
        "conditionSlug": "flag_cubetera_vista",
        "actions": [{ "type": "startDialogue", "dialogueSlug": "dlg_cubetera", "nodeSlug": "node_inicio" }]
      }]
    }]
  }],
  "characters": [{ "slug": "...", "name": "...", "startingRoomSlug": "...", "defaultDialogueSlug": "..." }],
  "conditions": [{ "slug": "...", "defaultValue": false }],
  "items": [{
    "slug": "...",
    "combinations": [{ "targetItemSlug": "...", "resultItemSlug": "...", "consumesSelf": false, "consumesTarget": true }],
    "interactions": [{ "type": "examine", "conditionSlug": "...", "actions": [...] }]
  }],
  "triggers": [{ "slug": "...", "triggerType": "FlagChange", "conditionToFire": {...}, "actions": [...] }],
  "dialogues": [{ "slug": "...", "nodes": [{ "slug": "...", "speakerId": "...", "text": "...", "playerResponses": [{ "text": "...", "conditionSlug": "...", "actionOnSelect": {...} }] }] }]
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
│   ├── auth.js             # Login, registro, recovery de contraseña
│   ├── ui.js               # Toasts, modals, combobox, quick create, breadcrumbs
│   ├── router.js           # Hash-based SPA router
│   ├── app.js              # Main entry + route registration
│   ├── export.js           # Slug-based JSON export con preview/download/copy
│   └── modules/
│       ├── rooms.js        # Habitaciones + hotspots + interacciones + acciones
│       ├── characters.js   # Personajes con avatar, bio y diálogo por defecto
│       ├── items.js        # Inventario + combinaciones + interacciones + flags
│       ├── timeline.js     # Cronología / Triggers / Acciones contextuales
│       ├── dialogues.js    # Diálogos + nodos + condiciones + acciones
│       ├── notes.js        # Notas Markdown + To-Do list integrada
│       ├── dashboard.js    # Página de inicio con resumen y estadísticas
│       ├── spritesheet.js  # Visor/probador de spritesheets animados
│       └── milestones.js   # Hitos del proyecto (timeline vertical de desarrollo)
└── assets/
    └── favicon.svg
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
