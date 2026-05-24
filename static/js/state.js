/**
 * State - Global application state and initialization
 */

// Global state variables
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
let currentProjectId = localStorage.getItem('currentProjectId');

// Modal state
let authMode = 'login';
let isAuthUIInitialized = false;
let isCustomObjectUIInitialized = false;

// Main application state
let appState = {
  canvasObjects: [],
  customObjects: [],
  selectedObject: null,
  zoom: 1,
  isDraggingCanvas: false,
  draggingObject: null,
  rotatingObject: null,
  rotationStart: null,
  dragOffset: { x: 0, y: 0 },
  previewObject: null,
  placingItem: null, // { item, width, height }
  projectName: 'Untitled Project',
  walls: [],
  detectedRooms: [],
  selectedRoomIndex: null,
  pressedMoveKeys: new Set(),
  keyboardMoveIntervalId: null,
  isMeasureMode: false,
  isMeasureDeleteMode: false,
  measureStartPoint: null,
  measurePreviewEndPoint: null,
  measureLines: [],
  userProjects: [], // Список проектов пользователя
  currentProjectIndex: -1, // Индекс текущего проекта в списке
  workspaceDirty: false,
};

/**
 * Initialize the application
 */
async function init() {
  setupEventListeners();
  renderSidebar();

  // При каждом открытии сайта — пустой холст, без автозагрузки проекта.
  appState.canvasObjects = [];
  appState.walls = [];
  appState.projectName = 'Untitled Project';
  const nameInput = document.getElementById('projectName');
  if (nameInput) nameInput.value = appState.projectName;

  currentProjectId = null;
  localStorage.removeItem('currentProjectId');
  localStorage.removeItem('currentProjectOwnerUserId');

  markWorkspaceClean();

  if (authToken && currentUser) {
    updateAuthUI();
    await loadUserProjects();
  } else {
    updateAuthUI();
  }
  renderCanvas();
}

/**
 * Mark workspace as clean (no unsaved changes)
 */
function markWorkspaceClean() {
  appState.workspaceDirty = false;
}

/**
 * Mark workspace as dirty (has unsaved changes)
 */
function markWorkspaceDirty() {
  appState.workspaceDirty = true;
}

/**
 * Save important state to localStorage
 */
function saveToLocalStorage(options = {}) {
  localStorage.setItem('projectName', appState.projectName);
  if (!options.skipDirtyMark) {
    appState.workspaceDirty = true;
  }
}

/**
 * Reset entire workspace state
 */
function resetWorkspaceState() {
  appState.canvasObjects = [];
  appState.walls = [];
  appState.selectedObject = null;
  appState.previewObject = null;
  appState.placingItem = null;
  appState.draggingObject = null;
  appState.rotatingObject = null;
  appState.rotationStart = null;
  appState.detectedRooms = [];
  appState.selectedRoomIndex = null;
  appState.measureLines = [];
  appState.measureStartPoint = null;
  appState.measurePreviewEndPoint = null;
  appState.isMeasureDeleteMode = false;
  appState.projectName = 'Untitled Project';
  const pn = document.getElementById('projectName');
  if (pn) pn.value = appState.projectName;
  currentProjectId = null;
  localStorage.removeItem('currentProjectId');
  localStorage.removeItem('currentProjectOwnerUserId');
  appState.currentProjectIndex = -1;
  const lightingOverlay = document.getElementById('lighting-overlay');
  if (lightingOverlay) lightingOverlay.remove();
  const toggleLighting = document.getElementById('toggleLighting');
  if (toggleLighting) toggleLighting.textContent = 'Показать освещение';
  saveToLocalStorage({ skipDirtyMark: true });
  markWorkspaceClean();
  updateInspector();
  renderCanvas();
}

/**
 * Reset layout when switching accounts
 */
function resetLayoutForNewAccount() {
  currentProjectId = null;
  localStorage.removeItem('currentProjectId');
  localStorage.removeItem('currentProjectOwnerUserId');
  localStorage.removeItem('canvasObjects');
  localStorage.removeItem('projectName');
  appState.canvasObjects = [];
  appState.walls = [];
  appState.selectedObject = null;
  appState.previewObject = null;
  appState.placingItem = null;
  appState.draggingObject = null;
  appState.rotatingObject = null;
  appState.rotationStart = null;
  appState.detectedRooms = [];
  appState.selectedRoomIndex = null;
  appState.measureLines = [];
  appState.measureStartPoint = null;
  appState.measurePreviewEndPoint = null;
  appState.isMeasureDeleteMode = false;
  appState.projectName = 'Untitled Project';
  const pn = document.getElementById('projectName');
  if (pn) pn.value = appState.projectName;
  appState.currentProjectIndex = -1;
  const lightingOverlay = document.getElementById('lighting-overlay');
  if (lightingOverlay) lightingOverlay.remove();
  const toggleLighting = document.getElementById('toggleLighting');
  if (toggleLighting) toggleLighting.textContent = 'Показать освещение';
  markWorkspaceClean();
  updateInspector();
  renderCanvas();
}

/**
 * Get normalized project name from input
 */
function getNormalizedProjectName() {
  const input = document.getElementById('projectName');
  const raw = (input?.value ?? appState.projectName ?? '').trim();
  return raw || 'Untitled Project';
}

/**
 * Remember current project owner for validation
 */
function rememberCurrentProjectOwner() {
  if (currentUser && currentUser.id != null) {
    localStorage.setItem('currentProjectOwnerUserId', String(currentUser.id));
  }
}

/**
 * Validate project ID for current user
 */
function validateProjectIdForCurrentUser() {
  if (!currentUser || !currentProjectId) return;
  const owner = localStorage.getItem('currentProjectOwnerUserId');
  if (owner != null && owner !== '' && String(owner) !== String(currentUser.id)) {
    currentProjectId = null;
    localStorage.removeItem('currentProjectId');
    localStorage.removeItem('currentProjectOwnerUserId');
  }
}

/**
 * Show confirmation dialog for unsaved changes
 */
async function confirmUnsavedBeforeLeave(actionHint) {
  if (!appState.workspaceDirty) return true;
  const hint = actionHint ? ` ${actionHint}` : '';
  const wantSave = window.confirm(
    `Есть несохранённые изменения.${hint}\n\n` +
    'ОК — сохранить в облако и продолжить\n' +
    'Отмена — не сохранять (далее будет подтверждение)'
  );
  if (wantSave) {
    try {
      await saveProjectToServer();
      markWorkspaceClean();
      await loadUserProjects();
      return true;
    } catch (e) {
      alert('Не удалось сохранить: ' + e.message);
      return false;
    }
  }
  return window.confirm(
    'Продолжить без сохранения? Изменения на холсте будут потеряны.\n\n' +
    'ОК — да\n' +
    'Отмена — отменить операцию'
  );
}

/**
 * Create a new workspace
 */
async function newWorkspace() {
  if (!(await confirmUnsavedBeforeLeave('перед созданием нового пространства'))) return;
  resetWorkspaceState();
}
