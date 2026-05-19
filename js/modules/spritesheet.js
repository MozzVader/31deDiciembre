// ============================================
// Módulo: Sprite Sheet Viewer / Tester
// ============================================
import { renderWorkspace, setBreadcrumbs, escapeHtml } from '../ui.js';

// ============================================
// State
// ============================================
let animInterval = null;
let currentFrame = 0;
let spriteImage = null;
let frameWidth = 0;
let frameHeight = 0;

// Direction labels (common in adventure games: down, left, right, up)
const DIRECTION_LABELS = ['Abajo', 'Izquierda', 'Derecha', 'Arriba'];

// ============================================
// Render — Main View
// ============================================

export function renderSpriteSheetViewer() {
  setBreadcrumbs([{ label: 'Sprite Viewer' }]);

  // Reset state
  stopAnimation();
  currentFrame = 0;
  spriteImage = null;

  renderWorkspace(`
    <div class="workspace-header">
      <div>
        <h1 class="workspace-title">Sprite Sheet Viewer</h1>
        <p class="workspace-subtitle">Probá tus spritesheets de personajes como animación en tiempo real</p>
      </div>
    </div>

    <div class="sprite-container">
      <!-- Upload Area -->
      <div class="sprite-upload-area" id="sprite-upload-area">
        <div class="sprite-upload-icon"><i class="fa-solid fa-image"></i></div>
        <div class="sprite-upload-text">Arrastrá tu spritesheet acá o hacé clic para seleccionar</div>
        <div class="sprite-upload-hint">PNG, JPG, GIF — se procesa localmente, no se sube a ningún lado</div>
        <input type="file" id="sprite-file-input" accept="image/*" style="display:none;">
      </div>

      <!-- Viewer (hidden until image loaded) -->
      <div class="sprite-viewer" id="sprite-viewer" style="display:none;">
        <!-- Controls -->
        <div class="sprite-controls-bar">
          <div class="sprite-controls-group">
            <label class="form-label" style="margin-bottom:0;">Columnas</label>
            <input type="number" class="form-input" id="sprite-cols" value="4" min="1" max="32" style="width:60px;">
          </div>
          <div class="sprite-controls-group">
            <label class="form-label" style="margin-bottom:0;">Filas</label>
            <input type="number" class="form-input" id="sprite-rows" value="4" min="1" max="32" style="width:60px;">
          </div>
          <div class="sprite-controls-group">
            <label class="form-label" style="margin-bottom:0;">FPS</label>
            <input type="number" class="form-input" id="sprite-fps" value="12" min="1" max="60" style="width:60px;">
          </div>
          <div class="sprite-controls-group">
            <label class="form-label" style="margin-bottom:0;">Zoom</label>
            <select class="form-select" id="sprite-zoom">
              <option value="1">1x</option>
              <option value="2" selected>2x</option>
              <option value="3">3x</option>
              <option value="4">4x</option>
              <option value="6">6x</option>
              <option value="8">8x</option>
            </select>
          </div>
        </div>

        <!-- Canvas + Info -->
        <div class="sprite-main-area">
          <div class="sprite-canvas-wrap">
            <canvas id="sprite-canvas" width="64" height="64"></canvas>
          </div>

          <div class="sprite-info-panel">
            <div class="sprite-info-row">
              <span class="sprite-info-label">Archivo</span>
              <span class="sprite-info-value" id="sprite-file-name">—</span>
            </div>
            <div class="sprite-info-row">
              <span class="sprite-info-label">Tamaño</span>
              <span class="sprite-info-value" id="sprite-img-size">—</span>
            </div>
            <div class="sprite-info-row">
              <span class="sprite-info-label">Frame</span>
              <span class="sprite-info-value" id="sprite-frame-size">—</span>
            </div>
            <div class="sprite-info-row">
              <span class="sprite-info-label">Frames</span>
              <span class="sprite-info-value" id="sprite-total-frames">—</span>
            </div>
            <div class="sprite-info-row">
              <span class="sprite-info-label">Frame actual</span>
              <span class="sprite-info-value" id="sprite-current-frame">0</span>
            </div>
          </div>
        </div>

        <!-- Playback Controls -->
        <div class="sprite-playback">
          <div class="sprite-playback-left">
            <button class="btn btn-ghost btn-sm" id="sprite-btn-prev" title="Frame anterior"><i class="fa-solid fa-backward-step"></i></button>
            <button class="btn btn-primary btn-sm" id="sprite-btn-play" title="Reproducir / Pausar"><i class="fa-solid fa-play"></i></button>
            <button class="btn btn-ghost btn-sm" id="sprite-btn-next" title="Frame siguiente"><i class="fa-solid fa-forward-step"></i></button>
            <button class="btn btn-ghost btn-sm" id="sprite-btn-reset" title="Volver al frame 0"><i class="fa-solid fa-rotate-left"></i></button>
          </div>
          <div class="sprite-playback-center">
            <input type="range" id="sprite-frame-slider" min="0" max="0" value="0" style="width:100%;">
          </div>
          <div class="sprite-playback-right">
            <button class="btn btn-ghost btn-sm" id="sprite-btn-change" title="Cambiar imagen"><i class="fa-solid fa-folder-open"></i> Cambiar</button>
          </div>
        </div>

        <!-- Direction Selector -->
        <div class="sprite-directions" id="sprite-directions">
          <span class="sprite-dir-label">Direccion (fila):</span>
          <div class="sprite-dir-buttons" id="sprite-dir-buttons"></div>
        </div>

        <!-- Full Sheet Preview -->
        <div class="sprite-sheet-preview-section">
          <div class="sprite-dir-label">Vista previa del sheet completo</div>
          <div class="sprite-sheet-preview-wrap" id="sprite-sheet-preview-wrap">
            <canvas id="sprite-sheet-canvas"></canvas>
          </div>
        </div>
      </div>
    </div>
  `);

  // Bind events
  setupSpriteViewer();
}

// ============================================
// Setup — Event Bindings
// ============================================

function setupSpriteViewer() {
  const uploadArea = document.getElementById('sprite-upload-area');
  const fileInput = document.getElementById('sprite-file-input');

  // Click to upload
  uploadArea?.addEventListener('click', () => fileInput?.click());

  // Drag & drop
  uploadArea?.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('sprite-upload-drag');
  });
  uploadArea?.addEventListener('dragleave', () => {
    uploadArea.classList.remove('sprite-upload-drag');
  });
  uploadArea?.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('sprite-upload-drag');
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) loadImageFile(file);
  });

  // File input change
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadImageFile(file);
  });

  // Grid controls — reconfigure on change
  ['sprite-cols', 'sprite-rows', 'sprite-fps'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => reconfigure());
  });

  // Zoom
  document.getElementById('sprite-zoom')?.addEventListener('change', () => applyZoom());

  // Playback buttons
  document.getElementById('sprite-btn-play')?.addEventListener('click', togglePlayPause);
  document.getElementById('sprite-btn-prev')?.addEventListener('click', prevFrame);
  document.getElementById('sprite-btn-next')?.addEventListener('click', nextFrame);
  document.getElementById('sprite-btn-reset')?.addEventListener('click', resetFrame);
  document.getElementById('sprite-frame-slider')?.addEventListener('input', onSliderChange);

  // Change image
  document.getElementById('sprite-btn-change')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) loadImageFile(file);
    });
    input.click();
  });
}

// ============================================
// Image Loading
// ============================================

function loadImageFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      spriteImage = img;

      // Show viewer, hide upload area
      document.getElementById('sprite-upload-area').style.display = 'none';
      document.getElementById('sprite-viewer').style.display = '';

      // File info
      document.getElementById('sprite-file-name').textContent = file.name;
      document.getElementById('sprite-img-size').textContent = `${img.width} × ${img.height} px`;

      // Reset to frame 0 and reconfigure
      currentFrame = 0;
      reconfigure();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ============================================
// Grid Configuration
// ============================================

function reconfigure() {
  if (!spriteImage) return;
  stopAnimation();

  const cols = parseInt(document.getElementById('sprite-cols').value) || 4;
  const rows = parseInt(document.getElementById('sprite-rows').value) || 4;

  frameWidth = spriteImage.width / cols;
  frameHeight = spriteImage.height / rows;
  const totalFrames = cols * rows;

  // Update info
  document.getElementById('sprite-frame-size').textContent = `${Math.round(frameWidth)} × ${Math.round(frameHeight)} px`;
  document.getElementById('sprite-total-frames').textContent = totalFrames;
  document.getElementById('sprite-current-frame').textContent = currentFrame;

  // Update slider
  const slider = document.getElementById('sprite-frame-slider');
  slider.max = totalFrames - 1;
  slider.value = currentFrame;

  // Draw first frame
  drawFrame(currentFrame);

  // Draw full sheet preview
  drawSheetPreview(cols, rows);

  // Build direction buttons
  buildDirectionButtons(rows);

  // Auto-play
  startAnimation();
  updatePlayButton();
}

// ============================================
// Canvas Drawing
// ============================================

function drawFrame(frameIndex) {
  if (!spriteImage) return;

  const cols = parseInt(document.getElementById('sprite-cols').value) || 4;
  const rows = parseInt(document.getElementById('sprite-rows').value) || 4;
  const zoom = parseInt(document.getElementById('sprite-zoom').value) || 2;

  const canvas = document.getElementById('sprite-canvas');
  const ctx = canvas.getContext('2d');

  const w = Math.round(spriteImage.width / cols);
  const h = Math.round(spriteImage.height / rows);
  const cw = w * zoom;
  const ch = h * zoom;

  canvas.width = cw;
  canvas.height = ch;

  const row = Math.floor(frameIndex / cols);
  const col = frameIndex % cols;

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(spriteImage, col * w, row * h, w, h, 0, 0, cw, ch);

  // Update info
  document.getElementById('sprite-current-frame').textContent = frameIndex;
  document.getElementById('sprite-frame-slider').value = frameIndex;
}

function drawSheetPreview(cols, rows) {
  if (!spriteImage) return;

  const canvas = document.getElementById('sprite-sheet-canvas');
  const ctx = canvas.getContext('2d');

  // Scale down to fit in preview (max 600px wide)
  const maxW = 600;
  const scale = Math.min(1, maxW / spriteImage.width);

  canvas.width = Math.round(spriteImage.width * scale);
  canvas.height = Math.round(spriteImage.height * scale);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spriteImage, 0, 0, canvas.width, canvas.height);

  // Draw grid lines
  const fw = canvas.width / cols;
  const fh = canvas.height / rows;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;

  for (let c = 1; c < cols; c++) {
    ctx.beginPath();
    ctx.moveTo(c * fw, 0);
    ctx.lineTo(c * fw, canvas.height);
    ctx.stroke();
  }
  for (let r = 1; r < rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * fh);
    ctx.lineTo(canvas.width, r * fh);
    ctx.stroke();
  }
}

// ============================================
// Zoom
// ============================================

function applyZoom() {
  drawFrame(currentFrame);
}

// ============================================
// Animation Playback
// ============================================

function startAnimation() {
  stopAnimation();
  const fps = parseInt(document.getElementById('sprite-fps').value) || 12;
  const cols = parseInt(document.getElementById('sprite-cols').value) || 4;
  const rows = parseInt(document.getElementById('sprite-rows').value) || 4;
  const totalFrames = cols * rows;

  animInterval = setInterval(() => {
    currentFrame = (currentFrame + 1) % totalFrames;
    drawFrame(currentFrame);
  }, 1000 / fps);
}

function stopAnimation() {
  if (animInterval) {
    clearInterval(animInterval);
    animInterval = null;
  }
}

function togglePlayPause() {
  if (animInterval) {
    stopAnimation();
  } else {
    startAnimation();
  }
  updatePlayButton();
}

function updatePlayButton() {
  const btn = document.getElementById('sprite-btn-play');
  if (!btn) return;
  btn.innerHTML = animInterval
    ? '<i class="fa-solid fa-pause"></i>'
    : '<i class="fa-solid fa-play"></i>';
}

function prevFrame() {
  if (!spriteImage) return;
  const cols = parseInt(document.getElementById('sprite-cols').value) || 4;
  const rows = parseInt(document.getElementById('sprite-rows').value) || 4;
  const totalFrames = cols * rows;
  currentFrame = (currentFrame - 1 + totalFrames) % totalFrames;
  drawFrame(currentFrame);
}

function nextFrame() {
  if (!spriteImage) return;
  const cols = parseInt(document.getElementById('sprite-cols').value) || 4;
  const rows = parseInt(document.getElementById('sprite-rows').value) || 4;
  const totalFrames = cols * rows;
  currentFrame = (currentFrame + 1) % totalFrames;
  drawFrame(currentFrame);
}

function resetFrame() {
  if (!spriteImage) return;
  currentFrame = 0;
  drawFrame(currentFrame);
}

function onSliderChange(e) {
  if (!spriteImage) return;
  stopAnimation();
  currentFrame = parseInt(e.target.value);
  drawFrame(currentFrame);
  updatePlayButton();
}

// ============================================
// Direction Buttons
// ============================================

function buildDirectionButtons(rows) {
  const container = document.getElementById('sprite-dir-buttons');
  if (!container) return;

  const cols = parseInt(document.getElementById('sprite-cols').value) || 4;
  const numDirs = Math.min(rows, 4);

  if (numDirs <= 1) {
    // No point showing direction buttons for 1 row
    container.parentElement.style.display = 'none';
    return;
  }

  container.parentElement.style.display = '';
  container.innerHTML = '';

  for (let r = 0; r < numDirs; r++) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm sprite-dir-btn';
    btn.textContent = DIRECTION_LABELS[r] || `Fila ${r + 1}`;
    btn.addEventListener('click', () => playRow(r, cols, numDirs));
    container.appendChild(btn);
  }

  // "Todas" button
  const allBtn = document.createElement('button');
  allBtn.className = 'btn btn-sm btn-ghost sprite-dir-btn';
  allBtn.textContent = 'Todas';
  allBtn.addEventListener('click', () => {
    currentFrame = 0;
    startAnimation();
    updatePlayButton();
  });
  container.appendChild(allBtn);
}

function playRow(rowIndex, cols) {
  if (!spriteImage) return;
  stopAnimation();
  currentFrame = rowIndex * cols;

  const totalFrames = cols; // only this row's frames
  const fps = parseInt(document.getElementById('sprite-fps').value) || 12;

  animInterval = setInterval(() => {
    const startFrame = rowIndex * cols;
    const currentInRow = currentFrame - startFrame;
    currentFrame = startFrame + ((currentInRow + 1) % totalFrames);
    drawFrame(currentFrame);
  }, 1000 / fps);

  updatePlayButton();
  drawFrame(currentFrame);
}
