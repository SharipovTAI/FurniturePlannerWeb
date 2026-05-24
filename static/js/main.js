/**
 * Main - Application initialization and event setup
 */

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  setupCanvasEventListeners();
  setupInspectorEventListeners();
  setupKeyboardEventListeners();
  setupAuthUI();
  setupCustomObjectUI();

  const measureToolBtn = document.getElementById('measureToolBtn');
  const measureClearBtn = document.getElementById('measureClearBtn');
  const clearMeasureLines = () => {
    appState.measureStartPoint = null;
    appState.measurePreviewEndPoint = null;
    appState.measureLines = [];
    appState.isMeasureDeleteMode = false;
    measureClearBtn.classList.remove('active-tool');
  };

  measureClearBtn.addEventListener('click', () => {
    if (!appState.isMeasureMode) return;
    appState.isMeasureDeleteMode = !appState.isMeasureDeleteMode;
    appState.measureStartPoint = null;
    appState.measurePreviewEndPoint = null;
    measureClearBtn.classList.toggle('active-tool', appState.isMeasureDeleteMode);
    renderCanvas();
  });

  measureToolBtn.addEventListener('click', () => {
    appState.isMeasureMode = !appState.isMeasureMode;
    appState.isMeasureDeleteMode = false;
    measureToolBtn.classList.toggle('active-tool', appState.isMeasureMode);
    measureClearBtn.classList.toggle('visible', appState.isMeasureMode);
    measureClearBtn.classList.remove('active-tool');
    if (appState.isMeasureMode) {
      appState.measureStartPoint = null;
      appState.measurePreviewEndPoint = null;
      appState.selectedObject = null;
      updateInspector();
    } else {
      clearMeasureLines();
    }
    renderCanvas();
  });

  document.getElementById('saveBtn').addEventListener('click', saveProject);
  document.getElementById('newWorkspaceBtn').addEventListener('click', () => {
    newWorkspace();
  });
  document.getElementById('moreBtn').addEventListener('click', async () => {
    const choice = prompt('Enter action:\n1. Download project\n2. Load project');
    if (choice === '1') downloadProject();
    else if (choice === '2') {
      const id = prompt('Enter project ID:');
      if (id) {
        if (!(await confirmUnsavedBeforeLeave(`перед загрузкой проекта #${id}`))) return;
        await loadProject(id);
      }
    }
  });

  document.getElementById('createRoomBtn').addEventListener('click', () => {
    const width = parseInt(prompt('Введите ширину комнаты (см, как на холсте):', '600'), 10);
      const height = parseInt(prompt('Введите высоту комнаты (см, как на холсте):', '400'), 10);
      if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
        createStandardRoom(width, height);
      } else {
        alert('Некорректные размеры. Используйте положительные числа.');
      }
  });

  // Project navigation
  document.getElementById('menuBtn').addEventListener('click', showProjectList);
  document.getElementById('undoBtn').addEventListener('click', previousProject);
  document.getElementById('redoBtn').addEventListener('click', nextProject);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  init();
});

// Load custom objects if already authenticated
if (authToken) {
  loadCustomObjects();
}
