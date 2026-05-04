// Configuration
const API_URL = '/api';
const SNAP_DISTANCE = 15;
const SNAP_LINE_COLOR = '#FF6B6B';
const CANVAS_CM_PER_UNIT = 1;
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
let currentProjectId = localStorage.getItem('currentProjectId');

/** Нормализует URL файла с сервера (относительный /media/... или абсолютный). */
function resolveCustomImageUrl(filePath) {
  if (filePath == null || filePath === '') return null;
  const s = String(filePath).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return s;
  return '/' + s.replace(/^\/+/, '');
}

function isRenderableCustomImageUrl(url) {
  if (url == null || url === '') return false;
  const s = String(url).trim().split('?')[0].toLowerCase();
  if (s.startsWith('data:image/')) return true;
  return /\.(png|jpe?g|webp|gif|svg)$/.test(s);
}

// Furniture and wall data
const furnitureItems = [
  { type: 'furniture', subtype: 'table', name: 'Стол', width: 100, height: 100, color: '#8B4513' },
  { type: 'furniture', subtype: 'chair', name: 'Стул', width: 50, height: 50, color: '#654321' },
  { type: 'furniture', subtype: 'sofa', name: 'Диван', width: 150, height: 150, color: '#4169E1' },
  { type: 'furniture', subtype: 'cabinet', name: 'Шкаф', width: 80, height: 80, color: '#8B4513' },
  { type: 'furniture', subtype: 'bed', name: 'Кровать', width: 80, height: 160, color: '#FF6347' },
  { type: 'furniture', subtype: 'toilet', name: 'Унитаз', width: 45, height: 65, color: '#cfd8dc' },
  { type: 'furniture', subtype: 'bathtub', name: 'Ванна', width: 170, height: 75, color: '#90caf9' },
  { type: 'furniture', subtype: 'microwave', name: 'Микроволновка', width: 50, height: 35, color: '#424242' },
  { type: 'furniture', subtype: 'stove', name: 'Плита', width: 60, height: 60, color: '#37474f' },
  { type: 'furniture', subtype: 'lamp', name: 'Лампа', width: 30, height: 30, color: '#FFD700' },
];

const wallItems = [
  { type: 'wall', subtype: 'standard', name: 'Стена', width: 240, height: 12, color: '#4f4f4f' },
];

const openingItems = [
  // width: size along wall; thickness is forced to wall thickness on placement
  { type: 'opening', subtype: 'door', name: 'Дверь', width: 80, height: 12, color: '#2d6a4f' },
  { type: 'opening', subtype: 'window', name: 'Окно', width: 60, height: 12, color: '#1d4ed8' },
];

// App state
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

// Modal state
let authMode = 'login';
let isAuthUIInitialized = false;
let isCustomObjectUIInitialized = false;

// Initialize
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

// =============== AUTH ===============
function setupAuthUI() {
  if (isAuthUIInitialized) return;
  isAuthUIInitialized = true;

  const loginBtn = document.getElementById('loginBtn');
  const loginModal = document.getElementById('loginModal');
  const closeBtn = loginModal.querySelector('.close');
  const authForm = document.getElementById('authForm');
  const authToggleBtn = document.getElementById('authToggleBtn');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const authEmailInput = document.getElementById('authEmail');

  loginBtn.addEventListener('click', () => {
    if (authToken && currentUser) return;
    authMode = 'login';
    loginModal.classList.remove('hidden');
  });

  const userNameMenuBtn = document.getElementById('userNameMenuBtn');
  const userMenuDropdown = document.getElementById('userMenuDropdown');
  const logoutBtn = document.getElementById('logoutBtn');

  function closeUserMenu() {
    if (userMenuDropdown) userMenuDropdown.classList.add('hidden');
    if (userNameMenuBtn) userNameMenuBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleUserMenu(e) {
    if (e) e.stopPropagation();
    if (!userMenuDropdown || !userNameMenuBtn) return;
    const isClosed = userMenuDropdown.classList.contains('hidden');
    userMenuDropdown.classList.toggle('hidden', !isClosed);
    userNameMenuBtn.setAttribute('aria-expanded', isClosed ? 'true' : 'false');
  }

  if (userNameMenuBtn) {
    userNameMenuBtn.addEventListener('click', toggleUserMenu);
  }
  if (userMenuDropdown) {
    userMenuDropdown.addEventListener('click', (e) => e.stopPropagation());
  }
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeUserMenu();
      logout();
    });
  }
  document.addEventListener('click', () => closeUserMenu());

  closeBtn.addEventListener('click', () => {
    loginModal.classList.add('hidden');
  });

  authToggleBtn.addEventListener('click', () => {
    authMode = authMode === 'login' ? 'register' : 'login';
    authEmailInput.style.display = authMode === 'register' ? 'block' : 'none';
    authSubmitBtn.textContent = authMode === 'login' ? 'Login' : 'Register';
    authToggleBtn.textContent = authMode === 'login' ? 'Register instead' : 'Login instead';
  });

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('authUsername').value;
    const password = document.getElementById('authPassword').value;
    const email = document.getElementById('authEmail').value;

    try {
      let prev = null;
      try {
        const prevRaw = localStorage.getItem('currentUser');
        prev = prevRaw ? JSON.parse(prevRaw) : null;
      } catch (_) {
        prev = null;
      }

      const endpoint = authMode === 'login' ? 'auth/login/' : 'auth/register/';
      const data = authMode === 'login' 
        ? { username, password }
        : { username, password, email };

      const response = await fetch(`${API_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorMessage = 'Authentication failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.detail || errorMessage;
        } catch (_) {
          // Keep default message when backend does not provide JSON.
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const newUserId = result.user_id;
      const isDifferentUser = prev != null && String(prev.id) !== String(newUserId);

      authToken = result.token;
      currentUser = { id: result.user_id, username: result.username, email: result.email };
      
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('currentUser', JSON.stringify(currentUser));

      if (isDifferentUser) {
        resetLayoutForNewAccount();
      }

      updateAuthUI();
      loginModal.classList.add('hidden');
      document.getElementById('authMessage').textContent = '';
      authForm.reset();

      await loadCustomObjects();
      await loadUserProjects();
    } catch (error) {
      const msg = document.getElementById('authMessage');
      msg.textContent = error.message;
      msg.className = 'error';
    }
  });
}

function updateAuthUI() {
  const loginBtn = document.getElementById('loginBtn');
  const headerAuthLogged = document.getElementById('headerAuthLogged');
  const userNameMenuBtn = document.getElementById('userNameMenuBtn');
  const userMenuDropdown = document.getElementById('userMenuDropdown');

  if (authToken && currentUser) {
    if (loginBtn) loginBtn.classList.add('hidden');
    if (headerAuthLogged) headerAuthLogged.classList.remove('hidden');
    if (userNameMenuBtn) userNameMenuBtn.textContent = currentUser.username;
    if (userMenuDropdown) userMenuDropdown.classList.add('hidden');
    if (userNameMenuBtn) userNameMenuBtn.setAttribute('aria-expanded', 'false');
  } else {
    if (loginBtn) {
      loginBtn.classList.remove('hidden');
      loginBtn.textContent = 'Login';
    }
    if (headerAuthLogged) headerAuthLogged.classList.add('hidden');
    if (userMenuDropdown) userMenuDropdown.classList.add('hidden');
  }
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');

  appState.customObjects = [];
  appState.userProjects = [];
  appState.currentProjectIndex = -1;

  resetWorkspaceState();
  renderSidebar();
  updateAuthUI();
}

// =============== PROJECT MANAGEMENT ===============
function getNormalizedProjectName() {
  const input = document.getElementById('projectName');
  const raw = (input?.value ?? appState.projectName ?? '').trim();
  return raw || 'Untitled Project';
}

function markWorkspaceClean() {
  appState.workspaceDirty = false;
}

function markWorkspaceDirty() {
  appState.workspaceDirty = true;
}

function rememberCurrentProjectOwner() {
  if (currentUser && currentUser.id != null) {
    localStorage.setItem('currentProjectOwnerUserId', String(currentUser.id));
  }
}

function validateProjectIdForCurrentUser() {
  if (!currentUser || !currentProjectId) return;
  const owner = localStorage.getItem('currentProjectOwnerUserId');
  if (owner != null && owner !== '' && String(owner) !== String(currentUser.id)) {
    currentProjectId = null;
    localStorage.removeItem('currentProjectId');
    localStorage.removeItem('currentProjectOwnerUserId');
  }
}

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

async function newWorkspace() {
  if (!(await confirmUnsavedBeforeLeave('перед созданием нового пространства'))) return;
  resetWorkspaceState();
}

async function saveProjectToServer() {
  if (!authToken) {
    throw new Error('Войдите в аккаунт, чтобы сохранять проекты');
  }

  const targetName = getNormalizedProjectName();
  appState.projectName = targetName;
  const projectNameInput = document.getElementById('projectName');
  if (projectNameInput) projectNameInput.value = targetName;

  const projectData = {
    name: targetName,
    description: 'Furniture layout project',
    room_width: 400,
    room_height: 300,
  };

  const projects = await getUserProjects();
  const nameMatch = projects.find((p) => (p.name || '').trim() === targetName);

  let projectId = currentProjectId ? String(currentProjectId) : null;

  if (nameMatch) {
    projectId = String(nameMatch.id);
    currentProjectId = projectId;
    localStorage.setItem('currentProjectId', projectId);
    const putResponse = await fetch(`${API_URL}/projects/${projectId}/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${authToken}`,
      },
      body: JSON.stringify(projectData),
    });
    if (!putResponse.ok) throw new Error('Не удалось обновить проект с таким именем');
  } else if (!projectId) {
    const createResponse = await fetch(`${API_URL}/projects/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${authToken}`,
      },
      body: JSON.stringify(projectData),
    });
    if (!createResponse.ok) throw new Error('Не удалось создать проект');
    const newProject = await createResponse.json();
    projectId = String(newProject.id);
    currentProjectId = projectId;
    localStorage.setItem('currentProjectId', projectId);
  } else {
    const putResponse = await fetch(`${API_URL}/projects/${projectId}/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${authToken}`,
      },
      body: JSON.stringify(projectData),
    });
    if (!putResponse.ok) throw new Error('Не удалось обновить проект');
  }

  const walls = [];
  const furniture = [];

  for (const obj of appState.canvasObjects) {
    if (obj.type === 'wall') {
      walls.push({
        name: obj.name || 'Wall',
        x: obj.x,
        y: obj.y,
        width: obj.width,
        height: obj.height,
        angle: obj.angle || 0,
        bearing: obj.bearing || false,
        color: obj.color,
        z: obj.z || 0,
        visible: obj.visible !== false,
      });
    } else {
      furniture.push({
        name: obj.name,
        subtype: obj.subtype || 'furniture',
        item_type: obj.customId ? 'custom' : 'preset',
        custom_object_id: obj.customId != null ? obj.customId : null,
        x: obj.x,
        y: obj.y,
        z: obj.z || 0,
        width: obj.width,
        height: obj.height,
        angle: obj.angle || 0,
        color: obj.color,
        visible: obj.visible !== false,
        locked: obj.locked || false,
        ignore_overlap: !!obj.ignoreOverlap,
        comment: obj.comment || '',
      });
    }
  }

  const syncResponse = await fetch(`${API_URL}/projects/${projectId}/sync_project/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Token ${authToken}`,
    },
    body: JSON.stringify({ walls, furniture }),
  });

  if (!syncResponse.ok) throw new Error('Не удалось синхронизировать данные проекта');

  rememberCurrentProjectOwner();
}

async function saveProject() {
  if (!authToken) {
    alert('Войдите в аккаунт, чтобы сохранять проекты');
    return;
  }
  try {
    await saveProjectToServer();
    markWorkspaceClean();
    await loadUserProjects();
    alert('Проект сохранён');
  } catch (error) {
    console.error('Error saving project:', error);
    alert('Ошибка сохранения: ' + error.message);
  }
}

async function getUserProjects() {
  if (!authToken) return [];

  try {
    const response = await fetch(`${API_URL}/projects/`, {
      headers: {
        'Authorization': `Token ${authToken}`,
      },
    });

    if (!response.ok) throw new Error('Failed to load projects');
    const projects = await response.json();
    return projects;
  } catch (error) {
    console.error('Error loading projects:', error);
    return [];
  }
}

async function downloadProject() {
  if (!currentProjectId) {
    alert('No project to download');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/projects/${currentProjectId}/download/`, {
      headers: {
        'Authorization': `Token ${authToken}`,
      },
    });

    if (!response.ok) throw new Error('Failed to download project');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${appState.projectName}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Error downloading project:', error);
    alert('Error downloading project');
  }
}

function restoreOpeningFromSavedItem(item, clientId) {
  const walls = appState.canvasObjects.filter(o => o.type === 'wall');
  if (!walls.length) return null;

  const openingItem = {
    type: 'opening',
    subtype: item.subtype,
    name: item.name,
    width: item.width,
    height: item.height,
    color: item.color || '#888888',
  };

  let best = null;
  for (const wall of walls) {
    const local = worldToWallLocal(wall, item.x, item.y);
    const halfLen = wall.width / 2;
    const halfTh = wall.height / 2;
    const onSegment = Math.abs(local.x) <= halfLen + 25;
    const nearLine = Math.abs(local.y) <= Math.max(halfTh + 15, 30);
    if (onSegment && nearLine) {
      const score = Math.abs(local.y) + Math.max(0, Math.abs(local.x) - halfLen) * 2;
      if (!best || score < best.score) best = { wall, localX: local.x, score };
    }
  }
  if (!best) return null;

  const halfWall = best.wall.width / 2;
  const halfOpening = (Number(item.width) || 60) / 2;
  const wallOffset = clamp(best.localX, -halfWall + halfOpening, halfWall - halfOpening);
  const created = createOpeningOnWall(openingItem, best.wall, wallOffset);
  created.id = clientId;
  created.visible = item.visible !== false;
  created.locked = !!item.locked;
  created.comment = item.comment || '';
  if (item.z_index != null) created.z = item.z_index;
  return created;
}

async function loadProject(projectId) {
  if (!authToken) return false;

  try {
    const response = await fetch(`${API_URL}/projects/${projectId}/`, {
      headers: {
        'Authorization': `Token ${authToken}`,
      },
    });

    if (response.status === 404) {
      throw new Error('Проект не найден или у вас нет к нему доступа');
    }
    if (!response.ok) throw new Error('Failed to load project');
    const project = await response.json();

    appState.projectName = project.name;
    document.getElementById('projectName').value = project.name;
    appState.canvasObjects = [];
    appState.walls = [];

    // Стены с сервера лежат в project.walls; канвас использует только canvasObjects.
    for (const wall of project.walls || []) {
      appState.canvasObjects.push({
        id: `w_${wall.id}`,
        type: 'wall',
        name: wall.name || 'Wall',
        x: wall.x,
        y: wall.y,
        width: wall.width,
        height: wall.height,
        angle: wall.angle ?? 0,
        bearing: !!wall.bearing,
        color: wall.color || '#4f4f4f',
        z: wall.z_index ?? 0,
        visible: wall.visible !== false,
        locked: false,
      });
    }

    for (const item of project.furniture_items || []) {
      const clientId = `i_${item.id}`;
      const isOpening = item.subtype === 'door' || item.subtype === 'window';
      if (isOpening) {
        const restored = restoreOpeningFromSavedItem(item, clientId);
        if (restored) {
          appState.canvasObjects.push(restored);
          continue;
        }
      }
      const co = item.custom_object;
      const rawUrl = co && co.file_path != null ? co.file_path : null;
      const customImageUrl = isRenderableCustomImageUrl(resolveCustomImageUrl(rawUrl))
        ? resolveCustomImageUrl(rawUrl)
        : null;
      appState.canvasObjects.push({
        id: clientId,
        name: item.name,
        subtype: item.subtype,
        type: 'furniture',
        x: item.x,
        y: item.y,
        z: item.z_index ?? 0,
        width: item.width,
        height: item.height,
        angle: item.angle ?? 0,
        color: item.color,
        visible: item.visible !== false,
        locked: !!item.locked,
        ignoreOverlap: !!item.ignore_overlap,
        comment: item.comment || '',
        customId: co?.id,
        customImageUrl,
      });
    }

    currentProjectId = String(project.id);
    localStorage.setItem('currentProjectId', currentProjectId);
    rememberCurrentProjectOwner();
    saveToLocalStorage({ skipDirtyMark: true });
    markWorkspaceClean();
    renderCanvas();
    await loadUserProjects();
    return true;
  } catch (error) {
    console.error('Error loading project:', error);
    alert(error.message || 'Не удалось загрузить проект');
    return false;
  }
}

async function loadUserProjects() {
  appState.userProjects = await getUserProjects();
  // Найти индекс текущего проекта
  if (currentProjectId) {
    const cid = String(currentProjectId);
    appState.currentProjectIndex = appState.userProjects.findIndex(p => String(p.id) === cid);
  } else {
    appState.currentProjectIndex = -1;
  }
}

async function switchToProject(index) {
  if (index < 0 || index >= appState.userProjects.length) return;
  
  const project = appState.userProjects[index];
  if (String(project.id) === String(currentProjectId)) return;

  if (!(await confirmUnsavedBeforeLeave(`перед открытием проекта «${project.name}»`))) return;

  const ok = await loadProject(project.id);
  if (ok) appState.currentProjectIndex = index;
}

async function showProjectList() {
  await loadUserProjects();
  
  if (appState.userProjects.length === 0) {
    alert('No projects found. Create a project first.');
    return;
  }

  const projectList = appState.userProjects.map((project, index) => 
    `${index + 1}. ${project.name} ${index === appState.currentProjectIndex ? '(current)' : ''}`
  ).join('\n');

  const choice = prompt(`Select project number:\n${projectList}`);
  if (choice) {
    const index = parseInt(choice) - 1;
    if (index >= 0 && index < appState.userProjects.length) {
      await switchToProject(index);
    }
  }
}

async function previousProject() {
  if (appState.userProjects.length === 0) return;
  const newIndex = appState.currentProjectIndex > 0 ? appState.currentProjectIndex - 1 : appState.userProjects.length - 1;
  await switchToProject(newIndex);
}

async function nextProject() {
  if (appState.userProjects.length === 0) return;
  const newIndex = appState.currentProjectIndex < appState.userProjects.length - 1 ? appState.currentProjectIndex + 1 : 0;
  await switchToProject(newIndex);
}

// =============== CUSTOM OBJECTS ===============
async function setupCustomObjectUI() {
  if (isCustomObjectUIInitialized) return;
  isCustomObjectUIInitialized = true;

  const uploadBtn = document.getElementById('uploadCustomBtn');
  const uploadModal = document.getElementById('uploadModal');
  const closeBtn = uploadModal.querySelector('.close');
  const uploadForm = document.getElementById('uploadForm');

  uploadBtn.addEventListener('click', () => {
    uploadModal.classList.remove('hidden');
  });

  closeBtn.addEventListener('click', () => {
    uploadModal.classList.add('hidden');
  });

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!authToken) {
      alert('Please login to upload custom objects');
      return;
    }

    const name = document.getElementById('uploadName').value;
    const desc = document.getElementById('uploadDesc').value;
    const width = parseFloat(document.getElementById('uploadWidth').value);
    const height = parseFloat(document.getElementById('uploadHeight').value);
    const color = document.getElementById('uploadColor').value;
    const file = document.getElementById('uploadFile').files[0];

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', desc);
      formData.append('width', width);
      formData.append('height', height);
      formData.append('color', color);
      if (file) formData.append('file_path', file);

      const response = await fetch(`${API_URL}/custom-furniture/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${authToken}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload custom object');

      const customObj = await response.json();
      appState.customObjects.push(customObj);
      renderSidebar();

      uploadForm.reset();
      document.getElementById('uploadMessage').textContent = 'Custom object added!';
      document.getElementById('uploadMessage').className = 'success';
      setTimeout(() => {
        uploadModal.classList.add('hidden');
        document.getElementById('uploadMessage').textContent = '';
      }, 2000);
    } catch (error) {
      const msg = document.getElementById('uploadMessage');
      msg.textContent = 'Error: ' + error.message;
      msg.className = 'error';
    }
  });
}

async function deleteCustomFurniture(id) {
  if (!authToken) {
    alert('Войдите в аккаунт, чтобы удалять объекты');
    return;
  }
  if (!confirm('Удалить этот объект из списка? Он будет удалён с сервера; экземпляры на плане тоже исчезнут.')) {
    return;
  }
  try {
    const response = await fetch(`${API_URL}/custom-furniture/${id}/`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Token ${authToken}`,
      },
    });
    if (!response.ok) throw new Error('Не удалось удалить объект');
    appState.customObjects = appState.customObjects.filter(o => o.id !== id);
    const selId = appState.selectedObject?.id;
    appState.canvasObjects = appState.canvasObjects.filter(o => o.customId !== id);
    if (selId != null && !appState.canvasObjects.some(o => o.id === selId)) {
      appState.selectedObject = null;
    }
    renderSidebar();
    renderCanvas();
    updateInspector();
    markWorkspaceDirty();
  } catch (err) {
    alert(err.message || 'Ошибка удаления');
  }
}

async function loadCustomObjects() {
  if (!authToken) return;

  try {
    const response = await fetch(`${API_URL}/custom-furniture/`, {
      headers: {
        'Authorization': `Token ${authToken}`,
      },
    });

    if (response.ok) {
      appState.customObjects = await response.json();
    }
  } catch (error) {
    console.error('Error loading custom objects:', error);
  }
}

// =============== SIDEBAR ===============
function renderSidebar() {
  const furnitureGrid = document.getElementById('sidebar-furniture-grid');
  const wallGrid = document.getElementById('sidebar-wall-grid');
  const customGrid = document.getElementById('sidebar-custom-grid');

  furnitureGrid.innerHTML = '';
  wallGrid.innerHTML = '';
  customGrid.innerHTML = '';

  furnitureItems.forEach(item => furnitureGrid.appendChild(createSidebarItem(item)));
  wallItems.forEach(item => wallGrid.appendChild(createSidebarItem(item)));
  // Doors/windows are shown together with walls.
  openingItems.forEach(item => wallGrid.appendChild(createSidebarItem(item)));
  appState.customObjects.forEach(item => {
    const resolved = resolveCustomImageUrl(item.file_path);
    const customImageUrl = isRenderableCustomImageUrl(resolved) ? resolved : null;
    const sidebarItem = {
      type: 'furniture',
      subtype: 'custom',
      name: item.name,
      width: item.width,
      height: item.height,
      color: item.color,
      customId: item.id,
      customImageUrl,
    };
    const wrap = document.createElement('div');
    wrap.className = 'sidebar-custom-wrap';
    const el = createSidebarItem(sidebarItem);
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'sidebar-custom-delete';
    delBtn.title = 'Удалить объект';
    delBtn.setAttribute('aria-label', 'Удалить объект');
    delBtn.textContent = '×';
    delBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteCustomFurniture(item.id);
    });
    delBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    wrap.appendChild(el);
    wrap.appendChild(delBtn);
    customGrid.appendChild(wrap);
  });
}

function createSidebarItem(item) {
  const el = document.createElement('div');
  el.className = 'item';
  el.draggable = item.type !== 'opening';
  el.textContent = item.name;
  if (window.FurniturePlannerSprites) {
    window.FurniturePlannerSprites.styleSidebarThumb(el, item);
    if (item.type !== 'wall') el.classList.add('item-sprite');
  } else {
    el.style.backgroundColor = item.color;
  }

  if (item.type === 'opening') {
    el.addEventListener('mousedown', (e) => startPlacingOpeningFromSidebar(e, item));
  } else {
    el.addEventListener('dragstart', (e) => handleSidebarDragStart(e, item));
    el.addEventListener('dragend', handleSidebarDragEnd);
  }
  return el;
}

function normalizeObjectDimensions(item) {
  const width = Number(item.width) || 50;
  const height = Number(item.height) || 50;

  return {
    width,
    height,
  };
}

function handleSidebarDragStart(e, item) {
  const dimensions = normalizeObjectDimensions(item);
  const payload = { ...item, ...dimensions };

  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('application/json', JSON.stringify(payload));

  // Sidebar card stays compact, but drag ghost is shown in real object size.
  const dragPreview = document.createElement('div');
  dragPreview.style.position = 'fixed';
  dragPreview.style.top = '-10000px';
  dragPreview.style.left = '-10000px';
  dragPreview.style.width = `${dimensions.width}px`;
  dragPreview.style.height = `${dimensions.height}px`;
  dragPreview.style.backgroundColor = item.color;
  dragPreview.style.border = '2px solid #333';
  dragPreview.style.borderRadius = '4px';
  dragPreview.style.display = 'flex';
  dragPreview.style.alignItems = 'center';
  dragPreview.style.justifyContent = 'center';
  dragPreview.style.color = 'white';
  dragPreview.style.fontWeight = 'bold';
  dragPreview.style.fontSize = '12px';
  dragPreview.style.padding = '4px';
  if (item.type === 'wall') {
    dragPreview.style.backgroundColor = item.color;
    dragPreview.textContent = item.name;
    dragPreview.style.color = 'white';
  } else {
    dragPreview.textContent = '';
    dragPreview.style.color = 'transparent';
    if (window.FurniturePlannerSprites) {
      window.FurniturePlannerSprites.styleDragGhost(dragPreview, item);
    } else {
      dragPreview.style.backgroundColor = item.color;
      dragPreview.textContent = item.name;
      dragPreview.style.color = 'white';
    }
  }
  document.body.appendChild(dragPreview);
  e.dataTransfer.setDragImage(dragPreview, dimensions.width / 2, dimensions.height / 2);
  e.target._dragPreviewEl = dragPreview;
}

function handleSidebarDragEnd(e) {
  if (e.target._dragPreviewEl) {
    e.target._dragPreviewEl.remove();
    e.target._dragPreviewEl = null;
  }
}

function startPlacingOpeningFromSidebar(e, item) {
  e.preventDefault();
  e.stopPropagation();

  const dims = normalizeObjectDimensions(item);
  appState.placingItem = { item, width: dims.width, height: dims.height, lastAttached: null };

  // Initialize preview at current pointer position (if over canvas).
  updateOpeningPlacementPreview(e.clientX, e.clientY);
  renderCanvas();

  const onMove = (ev) => {
    updateOpeningPlacementPreview(ev.clientX, ev.clientY);
    renderCanvas();
  };

  const onUp = (ev) => {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mouseup', onUp, true);
    // Ensure preview state matches the actual release position.
    updateOpeningPlacementPreview(ev.clientX, ev.clientY);
    finalizeOpeningPlacement();
  };

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mouseup', onUp, true);
}

function updateOpeningPlacementPreview(clientX, clientY) {
  if (!appState.placingItem) return;
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  const item = appState.placingItem.item;
  const dimensions = { width: appState.placingItem.width, height: appState.placingItem.height };

  const best = findNearestWallProjection(x, y);
  const attachDistance = 35;
  const detachDistance = 55;
  const wasAttached = Boolean(appState.previewObject?._previewAttachedToWall);
  const shouldAttach = best && (best.distToCenterline <= (wasAttached ? detachDistance : attachDistance));

  if (shouldAttach) {
    const wall = best.wall;
    const width = Number(dimensions.width) || 60;
    const halfWall = wall.width / 2;
    const halfOpening = width / 2;
    const wallOffset = clamp(best.localX, -halfWall + halfOpening, halfWall - halfOpening);
    const pos = wallLocalToWorld(wall, wallOffset, 0);
    appState.previewObject = {
      ...item,
      width,
      height: wall.height,
      x: pos.x,
      y: pos.y,
      angle: wall.angle || 0,
      z: (Number(wall.z) || 0) + 0.2,
      _previewAttachedToWall: true,
      _previewWallId: wall.id,
      _previewWallOffset: wallOffset,
    };
    appState.placingItem.lastAttached = { wallId: wall.id, wallOffset };
  } else {
    appState.previewObject = {
      ...item,
      ...dimensions,
      x,
      y,
      angle: 0,
      z: 0,
      _previewAttachedToWall: false,
      _previewWallId: null,
      _previewWallOffset: null,
    };
  }
}

function finalizeOpeningPlacement() {
  const preview = appState.previewObject;
  const placing = appState.placingItem;
  appState.placingItem = null;

  if (!placing) {
    appState.previewObject = null;
    renderCanvas();
    return;
  }

  // Use current attached preview if available, otherwise fall back to last attached state.
  const attachment = (preview && preview._previewAttachedToWall === true && preview._previewWallId)
    ? { wallId: preview._previewWallId, wallOffset: preview._previewWallOffset || 0 }
    : (placing.lastAttached ? placing.lastAttached : null);

  if (!attachment) {
    appState.previewObject = null;
    renderCanvas();
    return;
  }

  const wall = appState.canvasObjects.find(o => o.type === 'wall' && o.id === attachment.wallId);
  if (!wall) {
    appState.previewObject = null;
    renderCanvas();
    return;
  }

  const opening = createOpeningOnWall(placing.item, wall, attachment.wallOffset || 0);
  if (opening) {
    appState.canvasObjects.push(opening);
    saveToLocalStorage();
  }

  appState.previewObject = null;
  renderCanvas();
}

// =============== CANVAS ===============
function setupCanvasEventListeners() {
  const canvas = document.getElementById('canvas');
  canvas.addEventListener('dragover', handleCanvasDragOver);
  canvas.addEventListener('dragleave', handleCanvasDragLeave);
  canvas.addEventListener('drop', handleCanvasDrop);
  canvas.addEventListener('click', handleCanvasClick);
  canvas.addEventListener('click', handleCanvasMeasureClick, true);
  // document: перетаскивание и вращение не пропадают, если курсор ушёл с холста (инспектор/сайдбар)
  document.addEventListener('mousemove', handleCanvasMouseMove);
  document.addEventListener('mouseup', handleCanvasMouseUp);
}

function getCanvasPointerPosition(e) {
  const canvas = document.getElementById('canvas');
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

function handleCanvasClick(e) {
  // Don't handle if in measure mode or clicking on object
  if (appState.isMeasureMode || e.target !== document.getElementById('canvas')) return;

  const point = getCanvasPointerPosition(e);
  const roomIndex = getRoomIndexAtPoint(point);

  if (roomIndex >= 0) {
    // Clear selection and update room info for clicked room
    appState.selectedObject = null;
    appState.selectedRoomIndex = roomIndex;
    updateInspector();
    updateRoomInfoPanel(roomIndex);
  } else {
    // Clicked outside any room - show overall info
    updateRoomInfoPanel();
  }
}

function handleCanvasMeasureClick(e) {
  if (!appState.isMeasureMode) return;

  e.preventDefault();
  e.stopPropagation();

  const point = getCanvasPointerPosition(e);
  if (appState.isMeasureDeleteMode) {
    const findLineIndexAtPoint = (p) => {
      const HIT_RADIUS = 8;
      const distToSegment = (pt, a, b) => {
        const abx = b.x - a.x;
        const aby = b.y - a.y;
        const abLenSq = abx * abx + aby * aby;
        if (abLenSq === 0) return Math.hypot(pt.x - a.x, pt.y - a.y);
        const t = Math.max(0, Math.min(1, ((pt.x - a.x) * abx + (pt.y - a.y) * aby) / abLenSq));
        const projX = a.x + t * abx;
        const projY = a.y + t * aby;
        return Math.hypot(pt.x - projX, pt.y - projY);
      };

      let bestIndex = -1;
      let bestDist = Infinity;
      for (let i = 0; i < appState.measureLines.length; i++) {
        const line = appState.measureLines[i];
        const d = distToSegment(p, line.start, line.end);
        if (d <= HIT_RADIUS && d < bestDist) {
          bestDist = d;
          bestIndex = i;
        }
      }
      return bestIndex;
    };

    const lineIndex = findLineIndexAtPoint(point);
    if (lineIndex >= 0) {
      appState.measureLines.splice(lineIndex, 1);
      renderCanvas();
    }
    return;
  }

  if (!appState.measureStartPoint) {
    appState.measureStartPoint = point;
    appState.measurePreviewEndPoint = point;
    renderCanvas();
    return;
  }

  appState.measureLines.push({
    start: { ...appState.measureStartPoint },
    end: point,
  });
  appState.measureStartPoint = null;
  appState.measurePreviewEndPoint = null;
  renderCanvas();
}

function handleCanvasDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  document.getElementById('canvas').classList.add('dragging-over');

  // If we are placing an opening with the custom mousedown flow,
  // ignore native dragover previews.
  if (appState.placingItem) return;

  const data = e.dataTransfer.getData('application/json');
  if (data) {
    const item = JSON.parse(data);
    const dimensions = normalizeObjectDimensions(item);
    const rect = document.getElementById('canvas').getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (item.type === 'opening') {
      // "Attach/detach" behavior: near a wall => attach and move only along wall.
      // Far from walls => detach and follow cursor.
      const best = findNearestWallProjection(x, y);
      const attachDistance = 35;
      const detachDistance = 55; // hysteresis (prevents flicker)

      const wasAttached = Boolean(appState.previewObject?._previewAttachedToWall);
      const shouldAttach = best && (best.distToCenterline <= (wasAttached ? detachDistance : attachDistance));

      if (shouldAttach) {
        const wall = best.wall;
        const width = Number(dimensions.width) || 60;
        const halfWall = wall.width / 2;
        const halfOpening = width / 2;
        const wallOffset = clamp(best.localX, -halfWall + halfOpening, halfWall - halfOpening);
        const pos = wallLocalToWorld(wall, wallOffset, 0);
        appState.previewObject = {
          ...item,
          width,
          height: wall.height,
          x: pos.x,
          y: pos.y,
          angle: wall.angle || 0,
          z: (Number(wall.z) || 0) + 0.2,
          _previewAttachedToWall: true,
          _previewWallId: wall.id,
          _previewWallOffset: wallOffset,
        };
      } else {
        appState.previewObject = {
          ...item,
          ...dimensions,
          x,
          y,
          angle: 0,
          z: 0,
          _previewAttachedToWall: false,
          _previewWallId: null,
          _previewWallOffset: null,
        };
      }
    } else {
      appState.previewObject = { ...item, ...dimensions, x, y, angle: 0 };
    }
    renderCanvas();
  }
}

function handleCanvasDragLeave(e) {
  const canvas = document.getElementById('canvas');
  if (!canvas.contains(e.relatedTarget)) {
    canvas.classList.remove('dragging-over');
    appState.previewObject = null;
    renderCanvas();
  }
}

function handleCanvasDrop(e) {
  e.preventDefault();
  const canvas = document.getElementById('canvas');
  canvas.classList.remove('dragging-over');
  // keep previewObject for placement decision below; clear after handling drop

  // If we are placing an opening with the custom mousedown flow,
  // ignore native drop.
  if (appState.placingItem) return;

  const data = e.dataTransfer.getData('application/json');
  if (data) {
    const item = JSON.parse(data);
    const dimensions = normalizeObjectDimensions(item);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newObject = {
      id: Date.now() + Math.random(),
      x,
      y,
      z: appState.canvasObjects.length,
      visible: true,
      angle: 0,
      name: item.name,
      color: item.color,
      type: item.type,
      subtype: item.subtype,
      width: dimensions.width,
      height: dimensions.height,
      locked: false,
      ignoreOverlap: false,
      customId: item.customId,
      customImageUrl: item.customImageUrl || null,
    };

    if (item.type === 'wall') {
      newObject.bearing = false;
    }

    if (item.type === 'opening') {
      // Create ONLY if preview was attached to a wall.
      const preview = appState.previewObject;
      if (!preview || preview._previewAttachedToWall !== true || !preview._previewWallId) {
        alert('Двери/окна можно добавить только когда они прикрепились к стене.');
        renderCanvas();
        appState.previewObject = null;
        return;
      }

      const wall = appState.canvasObjects.find(o => o.type === 'wall' && o.id === preview._previewWallId);
      if (!wall) {
        alert('Стена не найдена для привязки двери/окна.');
        renderCanvas();
        appState.previewObject = null;
        return;
      }

      const opening = createOpeningOnWall(item, wall, preview._previewWallOffset || 0);
      if (!opening) return;
      appState.canvasObjects.push(opening);
      saveToLocalStorage();
      renderCanvas();
      appState.previewObject = null;
      return;
    }

    appState.canvasObjects.push(newObject);
    saveToLocalStorage();
    renderCanvas();
  }

  appState.previewObject = null;
}

function handleCanvasMouseMove(e) {
  if (appState.isMeasureMode && appState.measureStartPoint) {
    appState.measurePreviewEndPoint = getCanvasPointerPosition(e);
    renderCanvas();
  }

  if (!appState.rotatingObject && !appState.draggingObject) {
    return;
  }

  const canvas = document.getElementById('canvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (appState.rotatingObject) {
    const obj = appState.canvasObjects.find(o => o.id === appState.rotatingObject);
    if (obj && !obj.locked) {
      const angleToPointer = Math.atan2(y - obj.y, x - obj.x) * 180 / Math.PI;
      let newAngle = angleToPointer - appState.rotationStart.startAngle + appState.rotationStart.initialAngle;
      if (e.shiftKey) {
        newAngle = snapAngle(newAngle, 45);
      }
      obj.angle = normalizeAngle(newAngle);
      updateInspector();
      renderCanvas();
    }
    return;
  }

  if (appState.draggingObject) {
    const obj = appState.canvasObjects.find(o => o.id === appState.draggingObject);
    if (obj) {
      // Openings are constrained to their wall: allow drag only along wall axis.
      if (obj.type === 'opening') {
        const wall = appState.canvasObjects.find(o => o.type === 'wall' && o.id === obj.wallId);
        if (!wall) {
          renderCanvas();
          return;
        }

        const targetX = x - appState.dragOffset.x;
        const targetY = y - appState.dragOffset.y;
        const local = worldToWallLocal(wall, targetX, targetY);
        const halfWall = wall.width / 2;
        const halfOpening = obj.width / 2;
        obj.wallOffset = clamp(local.x, -halfWall + halfOpening, halfWall - halfOpening);
        updateOpeningWorldPose(obj, wall);
        renderCanvas();
        return;
      }

      const prevX = obj.x;
      const prevY = obj.y;

      obj.x = x - appState.dragOffset.x;
      obj.y = y - appState.dragOffset.y;

      // Apply magnetic snapping (walls snap to wall endpoints, furniture snaps normally)
      if (obj.type === 'wall') {
        const snap = checkWallSnapping(obj);
        if (snap.snapX !== null || snap.snapY !== null) {
          // Calculate endpoints of the wall
          const wallStart = {
            x: obj.x - obj.width / 2 * Math.cos(obj.angle * Math.PI / 180),
            y: obj.y - obj.width / 2 * Math.sin(obj.angle * Math.PI / 180)
          };
          
          const wallEnd = {
            x: obj.x + obj.width / 2 * Math.cos(obj.angle * Math.PI / 180),
            y: obj.y + obj.width / 2 * Math.sin(obj.angle * Math.PI / 180)
          };
          
          // Determine which endpoint is closer to snap point
          const distStart = Math.sqrt(Math.pow(wallStart.x - (snap.snapX || obj.x), 2) + Math.pow(wallStart.y - (snap.snapY || obj.y), 2));
          const distEnd = Math.sqrt(Math.pow(wallEnd.x - (snap.snapX || obj.x), 2) + Math.pow(wallEnd.y - (snap.snapY || obj.y), 2));
          
          const targetPoint = { x: snap.snapX || obj.x, y: snap.snapY || obj.y };
          const snapPoint = distStart < distEnd ? wallStart : wallEnd;
          
          // Move center so that endpoint aligns with target
          obj.x += targetPoint.x - snapPoint.x;
          obj.y += targetPoint.y - snapPoint.y;
        }

        // Recompute attached openings pose so they move with the wall.
        const moved = obj.x !== prevX || obj.y !== prevY;
        if (moved) {
          for (const o of appState.canvasObjects) {
            if (o.type === 'opening' && o.wallId === obj.id) {
              updateOpeningWorldPose(o, obj);
            }
          }
        }
      } else {
        // Furniture snaps normally
        const snap = checkSnapping(obj);
        if (snap.snapX !== null) {
          obj.x = snap.snapX;
        }
        if (snap.snapY !== null) {
          obj.y = snap.snapY;
        }
      }

      renderCanvas();
    }
  }
}

function handleCanvasMouseUp() {
  if (appState.draggingObject || appState.rotatingObject) {
    saveToLocalStorage();
  }
  appState.draggingObject = null;
  appState.rotatingObject = null;
  appState.rotationStart = null;
  appState.dragOffset = { x: 0, y: 0 };
}

// =============== MAGNETIC SNAPPING ===============
function getObjectBounds(obj) {
  const halfWidth = obj.width / 2;
  const halfHeight = obj.height / 2;
  return {
    left: obj.x - halfWidth,
    right: obj.x + halfWidth,
    top: obj.y - halfHeight,
    bottom: obj.y + halfHeight,
    centerX: obj.x,
    centerY: obj.y
  };
}

function checkSnapping(draggedObj) {
  const draggedBounds = getObjectBounds(draggedObj);
  let snapX = null;
  let snapY = null;
  let minDistX = SNAP_DISTANCE;
  let minDistY = SNAP_DISTANCE;

  // Check all other objects for snapping
  for (const otherObj of appState.canvasObjects) {
    if (otherObj.id === draggedObj.id) continue;
    if (otherObj.locked) continue;

    const otherBounds = getObjectBounds(otherObj);

    // Horizontal snapping
    // Left edge to right edge
    const distLeftRight = draggedBounds.left - otherBounds.right;
    if (Math.abs(distLeftRight) < minDistX) {
      minDistX = Math.abs(distLeftRight);
      snapX = otherBounds.right + draggedObj.width / 2;
    }

    // Right edge to left edge
    const distRightLeft = draggedBounds.right - otherBounds.left;
    if (Math.abs(distRightLeft) < minDistX) {
      minDistX = Math.abs(distRightLeft);
      snapX = otherBounds.left - draggedObj.width / 2;
    }

    // Center to center
    const distCenterX = draggedBounds.centerX - otherBounds.centerX;
    if (Math.abs(distCenterX) < minDistX) {
      minDistX = Math.abs(distCenterX);
      snapX = otherBounds.centerX;
    }

    // Vertical snapping
    // Top edge to bottom edge
    const distTopBottom = draggedBounds.top - otherBounds.bottom;
    if (Math.abs(distTopBottom) < minDistY) {
      minDistY = Math.abs(distTopBottom);
      snapY = otherBounds.bottom + draggedObj.height / 2;
    }

    // Bottom edge to top edge
    const distBottomTop = draggedBounds.bottom - otherBounds.top;
    if (Math.abs(distBottomTop) < minDistY) {
      minDistY = Math.abs(distBottomTop);
      snapY = otherBounds.top - draggedObj.height / 2;
    }

    // Center to center
    const distCenterY = draggedBounds.centerY - otherBounds.centerY;
    if (Math.abs(distCenterY) < minDistY) {
      minDistY = Math.abs(distCenterY);
      snapY = otherBounds.centerY;
    }
  }

  return { snapX, snapY };
}

// =============== WALL SNAPPING ===============
function checkWallSnapping(draggedWall) {
  const WALL_SNAP_DISTANCE = 20; // Larger snap distance for wall endpoints
  let snapX = null;
  let snapY = null;
  
  // Get endpoints of dragged wall
  const draggedStart = {
    x: draggedWall.x - draggedWall.width / 2 * Math.cos(draggedWall.angle * Math.PI / 180),
    y: draggedWall.y - draggedWall.width / 2 * Math.sin(draggedWall.angle * Math.PI / 180)
  };
  
  const draggedEnd = {
    x: draggedWall.x + draggedWall.width / 2 * Math.cos(draggedWall.angle * Math.PI / 180),
    y: draggedWall.y + draggedWall.width / 2 * Math.sin(draggedWall.angle * Math.PI / 180)
  };
  
  // Check other walls
  const otherWalls = appState.canvasObjects.filter(obj => obj.type === 'wall' && obj.id !== draggedWall.id);
  
  let minDistStart = WALL_SNAP_DISTANCE;
  let minDistEnd = WALL_SNAP_DISTANCE;
  
  for (const wall of otherWalls) {
    const wallStart = {
      x: wall.x - wall.width / 2 * Math.cos(wall.angle * Math.PI / 180),
      y: wall.y - wall.width / 2 * Math.sin(wall.angle * Math.PI / 180)
    };
    
    const wallEnd = {
      x: wall.x + wall.width / 2 * Math.cos(wall.angle * Math.PI / 180),
      y: wall.y + wall.width / 2 * Math.sin(wall.angle * Math.PI / 180)
    };
    
    // Check dragged wall start against other wall endpoints
    const distToStart = Math.sqrt(Math.pow(draggedStart.x - wallStart.x, 2) + Math.pow(draggedStart.y - wallStart.y, 2));
    if (distToStart < minDistStart) {
      minDistStart = distToStart;
      snapX = wallStart.x;
      snapY = wallStart.y;
    }
    
    const distToEnd = Math.sqrt(Math.pow(draggedStart.x - wallEnd.x, 2) + Math.pow(draggedStart.y - wallEnd.y, 2));
    if (distToEnd < minDistStart) {
      minDistStart = distToEnd;
      snapX = wallEnd.x;
      snapY = wallEnd.y;
    }
    
    // Check dragged wall end against other wall endpoints
    const distEndToStart = Math.sqrt(Math.pow(draggedEnd.x - wallStart.x, 2) + Math.pow(draggedEnd.y - wallStart.y, 2));
    if (distEndToStart < minDistEnd) {
      minDistEnd = distEndToStart;
      snapX = wallStart.x;
      snapY = wallStart.y;
    }
    
    const distEndToEnd = Math.sqrt(Math.pow(draggedEnd.x - wallEnd.x, 2) + Math.pow(draggedEnd.y - wallEnd.y, 2));
    if (distEndToEnd < minDistEnd) {
      minDistEnd = distEndToEnd;
      snapX = wallEnd.x;
      snapY = wallEnd.y;
    }
  }
  
  return { snapX, snapY };
}

// =============== ROOM DETECTION ===============
function detectRooms() {
  const previousSelectedRoom = Number.isInteger(appState.selectedRoomIndex)
    ? appState.detectedRooms?.[appState.selectedRoomIndex]
    : null;
  const previousSignature = previousSelectedRoom ? getRoomSignature(previousSelectedRoom) : null;
  const rooms = [];
  const walls = appState.canvasObjects.filter(obj => obj.type === 'wall');
  
  if (walls.length === 0) return rooms;

  const CONNECT_EPS = 8;

  const wallEndpoints = (w) => {
    const rad = (w.angle || 0) * Math.PI / 180;
    const dx = (w.width / 2) * Math.cos(rad);
    const dy = (w.width / 2) * Math.sin(rad);
    return {
      start: { x: w.x - dx, y: w.y - dy },
      end: { x: w.x + dx, y: w.y + dy },
    };
  };

  const dist2 = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  };

  const isClose = (a, b, eps = CONNECT_EPS) => dist2(a, b) <= eps * eps;

  // We trace chains, allowing connection to either end of next wall (reversing direction if needed).
  const visitedWalls = new Set();

  for (const startWall of walls) {
    if (visitedWalls.has(startWall.id)) continue;

    const chainWalls = [];
    const chainPoints = [];

    const startEP = wallEndpoints(startWall);
    chainWalls.push(startWall);
    chainPoints.push(startEP.start);
    chainPoints.push(startEP.end);

    let currentEnd = startEP.end;
    let closed = false;

    while (chainWalls.length <= walls.length) {
      // Find next wall that connects to currentEnd (either its start or end).
      let next = null;
      let nextEP = null;
      let reverse = false;

      for (const w of walls) {
        if (chainWalls.some(cw => cw.id === w.id)) continue;
        const ep = wallEndpoints(w);
        if (isClose(currentEnd, ep.start)) {
          next = w; nextEP = ep; reverse = false; break;
        }
        if (isClose(currentEnd, ep.end)) {
          next = w; nextEP = ep; reverse = true; break;
        }
      }

      if (!next) break;

      chainWalls.push(next);
      const newPoint = reverse ? nextEP.start : nextEP.end;
      chainPoints.push(newPoint);
      currentEnd = newPoint;

      // Closed if we returned to first point.
      if (chainPoints.length > 3 && isClose(currentEnd, chainPoints[0])) {
        closed = true;
        break;
      }
    }

    if (closed && chainPoints.length >= 4) {
      // Ensure last point equals first for rendering consistency.
      if (!isClose(chainPoints[chainPoints.length - 1], chainPoints[0])) {
        chainPoints.push({ ...chainPoints[0] });
      }

      rooms.push({
        walls: chainWalls,
        polygon: chainPoints,
        area: calculatePolygonArea(chainPoints),
      });

      chainWalls.forEach(w => visitedWalls.add(w.id));
    }
  }
  
  appState.detectedRooms = rooms;
  syncSelectedRoom(previousSignature);
  return rooms;
}

function getRoomSignature(room) {
  if (!room || !Array.isArray(room.walls)) return '';
  return room.walls.map(w => String(w.id)).sort().join('|');
}

function syncSelectedRoom(preferredSignature = null) {
  const rooms = appState.detectedRooms || [];
  if (rooms.length === 0) {
    appState.selectedRoomIndex = null;
    return;
  }

  if (preferredSignature) {
    const matchedIndex = rooms.findIndex(room => getRoomSignature(room) === preferredSignature);
    if (matchedIndex >= 0) {
      appState.selectedRoomIndex = matchedIndex;
      return;
    }
  }

  if (!Number.isInteger(appState.selectedRoomIndex)
    || appState.selectedRoomIndex < 0
    || appState.selectedRoomIndex >= rooms.length) {
    appState.selectedRoomIndex = 0;
  }
}

function calculatePolygonArea(points) {
  // points: [{x,y}, ...] optionally closed (last==first)
  if (!points || points.length < 3) return 0;
  let area2 = 0;
  for (let i = 0; i < points.length - 1; i++) {
    area2 += points[i].x * points[i + 1].y - points[i + 1].x * points[i].y;
  }
  return Math.abs(area2) / 2;
}

function getObjectCorners(obj) {
  const halfWidth = (obj.width || 0) / 2;
  const halfHeight = (obj.height || 0) / 2;
  const angleRad = ((obj.angle || 0) * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  const localCorners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ];

  return localCorners.map((p) => ({
    x: obj.x + p.x * cos - p.y * sin,
    y: obj.y + p.x * sin + p.y * cos,
  }));
}

function projectPolygon(points, axis) {
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    const projection = p.x * axis.x + p.y * axis.y;
    if (projection < min) min = projection;
    if (projection > max) max = projection;
  }
  return { min, max };
}

function isPointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function getRoomAtPoint(point) {
  for (const room of appState.detectedRooms) {
    if (isPointInPolygon(point, room.polygon)) {
      return room;
    }
  }
  return null;
}

function getRoomIndexAtPoint(point) {
  for (let i = 0; i < appState.detectedRooms.length; i++) {
    if (isPointInPolygon(point, appState.detectedRooms[i].polygon)) {
      return i;
    }
  }
  return -1;
}

function getFurnitureInRoom(room) {
  if (!room) return [];
  
  return appState.canvasObjects.filter(obj => {
    if (obj.type !== 'furniture') return false;
    
    // Check if object center is inside room polygon
    return isPointInPolygon({ x: obj.x, y: obj.y }, room.polygon);
  });
}

function sortFurnitureByPlacementOrder(a, b) {
  return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
}

function getFurnitureFootprintAreaCanvasUnits(obj) {
  const w = Number(obj.width) || 0;
  const h = Number(obj.height) || 0;
  return w * h;
}

function getOccupiedFurnitureAreaInRoom(room) {
  return getFurnitureInRoom(room).reduce((sum, f) => sum + getFurnitureFootprintAreaCanvasUnits(f), 0);
}

function canvasAreaToCm2(areaCanvasUnits) {
  const k = CANVAS_CM_PER_UNIT;
  return (Number(areaCanvasUnits) || 0) * k * k;
}

function polygonsOverlap(polyA, polyB) {
  const polygons = [polyA, polyB];
  for (const polygon of polygons) {
    for (let i = 0; i < polygon.length; i++) {
      const nextI = (i + 1) % polygon.length;
      const edge = {
        x: polygon[nextI].x - polygon[i].x,
        y: polygon[nextI].y - polygon[i].y,
      };
      const axis = { x: -edge.y, y: edge.x };
      const length = Math.hypot(axis.x, axis.y);
      if (!length) continue;
      axis.x /= length;
      axis.y /= length;

      const projA = projectPolygon(polyA, axis);
      const projB = projectPolygon(polyB, axis);
      if (projA.max < projB.min || projB.max < projA.min) {
        return false;
      }
    }
  }
  return true;
}

function pointInPolygon(point, polygon) {
  let inside = false;
  const n = polygon.length;
  if (n < 3) return false;
  const EPS = 1e-6;

  const isPointOnSegment = (p, a, b) => {
    const cross = (p.y - a.y) * (b.x - a.x) - (p.x - a.x) * (b.y - a.y);
    if (Math.abs(cross) > EPS) return false;
    const dot = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y);
    if (dot < -EPS) return false;
    const lenSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (dot - lenSq > EPS) return false;
    return true;
  };

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const current = polygon[i];
    const prev = polygon[j];

    // Edge contact counts as valid (inside room).
    if (isPointOnSegment(point, prev, current)) return true;

    const intersects = ((current.y > point.y) !== (prev.y > point.y))
      && (point.x < ((prev.x - current.x) * (point.y - current.y)) / ((prev.y - current.y) || 1e-9) + current.x);
    if (intersects) inside = !inside;
  }

  return inside;
}

function getPolygonWithoutDuplicateClosure(polygon) {
  if (!polygon || polygon.length < 3) return [];
  const first = polygon[0];
  const last = polygon[polygon.length - 1];
  if (first.x === last.x && first.y === last.y) {
    return polygon.slice(0, -1);
  }
  return polygon;
}

function orientation(a, b, c) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 1e-9) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return b.x <= Math.max(a.x, c.x) + 1e-9
    && b.x + 1e-9 >= Math.min(a.x, c.x)
    && b.y <= Math.max(a.y, c.y) + 1e-9
    && b.y + 1e-9 >= Math.min(a.y, c.y);
}

function segmentsIntersect(p1, q1, p2, q2) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

function isSimplePolygon(polygon) {
  const pts = getPolygonWithoutDuplicateClosure(polygon);
  if (pts.length < 3) return false;
  const n = pts.length;

  for (let i = 0; i < n; i++) {
    const a1 = pts[i];
    const a2 = pts[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      const b1 = pts[j];
      const b2 = pts[(j + 1) % n];

      // Neighbor edges share a vertex and are allowed.
      if (i === j) continue;
      if ((i + 1) % n === j) continue;
      if (i === (j + 1) % n) continue;

      if (segmentsIntersect(a1, a2, b1, b2)) return false;
    }
  }

  return true;
}

function isOverlapAllowed(objA, objB) {
  if (objA.type === 'wall' && objB.type === 'wall') return true;
  if (objA.type === 'opening' && objB.type === 'wall') return true;
  if (objA.type === 'wall' && objB.type === 'opening') return true;
  return false;
}

/** Две единицы мебели без ошибки пересечения, если у любой включено «Без коллизий». */
function furnitureOverlapIgnoredPair(objA, objB) {
  if (objA.type !== 'furniture' || objB.type !== 'furniture') return false;
  return !!(objA.ignoreOverlap || objB.ignoreOverlap);
}

function isFurnitureInsideDetectedRoom(obj, rooms) {
  if (!rooms || rooms.length === 0) return false;
  const corners = getObjectCorners(obj);

  return rooms.some((room) => {
    const polygon = getPolygonWithoutDuplicateClosure(room.polygon || []);
    if (polygon.length < 3) return false;
    if (!isSimplePolygon(polygon)) return false;
    return corners.every((corner) => pointInPolygon(corner, polygon));
  });
}

function hasInvalidOverlap(targetObj, allObjects) {
  const targetCorners = getObjectCorners(targetObj);
  for (const other of allObjects) {
    if (other.id === targetObj.id) continue;
    if (isOverlapAllowed(targetObj, other)) continue;
    if (furnitureOverlapIgnoredPair(targetObj, other)) continue;
    const otherCorners = getObjectCorners(other);
    if (polygonsOverlap(targetCorners, otherCorners)) {
      return true;
    }
  }
  return false;
}

function getObjectPlacementErrors(targetObj, allObjects, rooms) {
  const errors = [];

  if (targetObj.type === 'furniture' && !isFurnitureInsideDetectedRoom(targetObj, rooms)) {
    errors.push('outside-room');
  }

  if (hasInvalidOverlap(targetObj, allObjects)) {
    errors.push('overlap');
  }

  return errors;
}

function renderCanvas() {
  const canvas = document.getElementById('canvas');
  canvas.innerHTML = '';

  // Detect rooms
  detectRooms();

  // Draw detected rooms as background
  if (appState.detectedRooms && appState.detectedRooms.length > 0) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    
    appState.detectedRooms.forEach((room, index) => {
      const colors = ['#949494', '#e3f2fd', '#fff3e0', '#fce4ec', '#f3e5f5'];
      if (room.polygon && room.polygon.length >= 3) {
        const inRoom = getFurnitureInRoom(room);
        const roomSpec = classifyRoomBySpecialFurniture(inRoom);
        const conflict = roomSpec.conflict;
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const pts = room.polygon
          .map(p => `${Math.round(p.x)},${Math.round(p.y)}`)
          .join(' ');
        poly.setAttribute('points', pts);
        poly.setAttribute('fill', conflict ? '#ffcdd2' : colors[index % colors.length]);
        poly.setAttribute('fill-opacity', conflict ? '0.35' : '0.25');
        poly.setAttribute('stroke', conflict ? '#d32f2f' : '#999');
        poly.setAttribute('stroke-width', conflict ? '3' : '2');
        poly.setAttribute('stroke-dasharray', '5,5');
        svg.appendChild(poly);
      }
    });
    
    canvas.appendChild(svg);
  }

  const typePriority = (obj) => {
    if (obj.type === 'wall') return 0;
    if (obj.type === 'opening') return 2; // must be above wall
    return 1;
  };

  const sorted = [...appState.canvasObjects].sort((a, b) => {
    const pa = typePriority(a);
    const pb = typePriority(b);
    if (pa !== pb) return pa - pb;
    const za = Number(a.z) || 0;
    const zb = Number(b.z) || 0;
    if (za !== zb) return za - zb;
    const idCmp = String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
    return idCmp;
  });

  const draggingObj = appState.draggingObject
    ? appState.canvasObjects.find(o => o.id === appState.draggingObject)
    : null;
  const draggingWallId = draggingObj?.type === 'wall' ? draggingObj.id : null;
  const placementErrorsById = new Map();
  for (const obj of appState.canvasObjects) {
    const errors = getObjectPlacementErrors(obj, appState.canvasObjects, appState.detectedRooms);
    if (errors.length > 0) placementErrorsById.set(obj.id, errors);
  }

  sorted.forEach(obj => {
    if (obj.type === 'opening') {
      const wall = appState.canvasObjects.find(o => o.type === 'wall' && o.id === obj.wallId);
      if (wall) updateOpeningWorldPose(obj, wall);
    }

    const el = document.createElement('div');
    el.className = `canvas-object ${obj.type === 'wall' ? 'wall' : ''}${obj.type === 'wall' && obj.bearing ? ' wall-bearing' : ''}`;
    el.dataset.id = obj.id;
    el.style.position = 'absolute';
    el.style.left = `${obj.x - obj.width / 2}px`;
    el.style.top = `${obj.y - obj.height / 2}px`;
    el.style.width = `${obj.width}px`;
    el.style.height = `${obj.height}px`;
    el.style.border = '2px solid #333';
    el.style.borderRadius = '4px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.fontSize = '12px';
    el.style.fontWeight = 'bold';
    el.style.cursor = obj.locked ? 'not-allowed' : appState.draggingObject === obj.id ? 'grabbing' : 'grab';
    el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    if (obj.type === 'wall') {
      el.style.backgroundColor = obj.color;
      el.style.backgroundImage = 'none';
      el.style.color = 'rgba(255,255,255,0.96)';
      el.style.fontSize = '9px';
      el.style.letterSpacing = '0.14em';
      el.style.lineHeight = '1';
      el.style.textShadow = '0 0 4px #000, 0 1px 2px rgba(0,0,0,0.85)';
      el.style.whiteSpace = 'nowrap';
      el.textContent = 'СТЕНА';
    } else {
      el.style.color = 'transparent';
      el.textContent = '';
      el.title = obj.name || '';
      if (window.FurniturePlannerSprites) {
        window.FurniturePlannerSprites.styleCanvasElement(el, obj, {});
      } else {
        el.style.backgroundColor = obj.color;
        el.style.color = 'white';
        el.textContent = obj.name;
      }
    }
    const zInt = Math.round(Number(obj.z) || 0);

    if (draggingWallId && obj.type === 'opening' && obj.wallId === draggingWallId) {
      // While dragging a wall, its openings must stay above it.
      el.style.zIndex = 10050 + zInt;
    } else if (appState.draggingObject === obj.id) {
      // Dragged object goes very top (except the special case above).
      el.style.zIndex = draggingWallId ? 10000 : 9999;
    } else if (obj.type === 'opening') {
      el.style.zIndex = 5000 + zInt;
    } else if (obj.type === 'wall') {
      el.style.zIndex = 1000 + zInt;
    } else {
      el.style.zIndex = 3000 + zInt;
    }
    el.style.opacity = obj.visible !== false ? 1 : 0.5;
    el.style.transform = `rotate(${obj.angle || 0}deg)`;
    el.style.transformOrigin = 'center center';

    if (appState.selectedObject?.id === obj.id) {
      el.style.border = '3px solid #007bff';
    }

    if (placementErrorsById.has(obj.id)) {
      el.style.border = '3px solid #d32f2f';
      el.style.boxShadow = '0 0 0 2px rgba(211, 47, 47, 0.35)';
    }

    el.addEventListener('mousedown', (e) => handleObjectMouseDown(e, obj));
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      selectObject(obj);
    });

    if (appState.selectedObject?.id === obj.id && obj.type === 'wall' && !obj.locked) {
      const handle = document.createElement('div');
      handle.className = 'rotate-handle';
      handle.title = 'Rotate wall';
      handle.addEventListener('mousedown', (e) => handleRotateMouseDown(e, obj));
      el.appendChild(handle);
    }

    canvas.appendChild(el);
  });

  if (appState.previewObject) {
    const preview = appState.previewObject;
    const previewErrors = getObjectPlacementErrors(preview, appState.canvasObjects, appState.detectedRooms);
    const el = document.createElement('div');
    el.className = 'canvas-object preview';
    el.style.position = 'absolute';
    el.style.left = `${preview.x - preview.width / 2}px`;
    el.style.top = `${preview.y - preview.height / 2}px`;
    el.style.width = `${preview.width}px`;
    el.style.height = `${preview.height}px`;
    el.style.border = '2px dashed #333';
    el.style.borderRadius = '4px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.fontSize = '12px';
    el.style.fontWeight = 'bold';
    el.style.opacity = '0.7';
    el.style.pointerEvents = 'none';
    el.style.transform = `rotate(${preview.angle || 0}deg)`;
    el.style.transformOrigin = 'center center';
    el.style.zIndex = 9000;
    el.textContent = '';
    el.title = preview.name || '';
    if (preview.type === 'wall') {
      el.style.backgroundColor = preview.color;
      el.style.backgroundImage = 'none';
    } else if (window.FurniturePlannerSprites) {
      window.FurniturePlannerSprites.styleCanvasElement(el, preview, { preview: true });
    } else {
      el.style.backgroundColor = preview.color;
      el.style.color = 'white';
      el.textContent = preview.name;
    }
    if (preview.type === 'opening' && preview._previewAttachedToWall === false) {
      el.style.opacity = '0.35';
      el.style.borderColor = '#c62828';
    }
    if (previewErrors.length > 0) {
      el.style.borderColor = '#d32f2f';
      el.style.opacity = '0.5';
      el.style.boxShadow = '0 0 0 2px rgba(211, 47, 47, 0.35)';
    }
    canvas.appendChild(el);
  }

  const linesToDraw = [...appState.measureLines];
  if (appState.measureStartPoint && appState.measurePreviewEndPoint) {
    linesToDraw.push({ start: appState.measureStartPoint, end: appState.measurePreviewEndPoint });
  }

  if (linesToDraw.length > 0) {
    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '20000';

    const makePoint = (x, y) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      p.setAttribute('cx', x);
      p.setAttribute('cy', y);
      p.setAttribute('r', '5');
      p.setAttribute('fill', '#ff1744');
      p.setAttribute('stroke', '#ffffff');
      p.setAttribute('stroke-width', '2');
      return p;
    };

    for (const lineToDraw of linesToDraw) {
      const dx = lineToDraw.end.x - lineToDraw.start.x;
      const dy = lineToDraw.end.y - lineToDraw.start.y;
      const distanceCm = Math.hypot(dx, dy) * CANVAS_CM_PER_UNIT;
      const midX = (lineToDraw.start.x + lineToDraw.end.x) / 2;
      const midY = (lineToDraw.start.y + lineToDraw.end.y) / 2;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', lineToDraw.start.x);
      line.setAttribute('y1', lineToDraw.start.y);
      line.setAttribute('x2', lineToDraw.end.x);
      line.setAttribute('y2', lineToDraw.end.y);
      line.setAttribute('stroke', '#ff1744');
      line.setAttribute('stroke-width', '3');
      overlay.appendChild(line);

      overlay.appendChild(makePoint(lineToDraw.start.x, lineToDraw.start.y));
      overlay.appendChild(makePoint(lineToDraw.end.x, lineToDraw.end.y));

      const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const labelWidth = 96;
      const labelHeight = 24;
      labelBg.setAttribute('x', midX - labelWidth / 2);
      labelBg.setAttribute('y', midY - labelHeight - 10);
      labelBg.setAttribute('width', labelWidth);
      labelBg.setAttribute('height', labelHeight);
      labelBg.setAttribute('rx', 6);
      labelBg.setAttribute('fill', '#111827');
      labelBg.setAttribute('fill-opacity', '0.85');
      overlay.appendChild(labelBg);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', midX);
      label.setAttribute('y', midY - 14);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', '#ffffff');
      label.setAttribute('font-size', '12');
      label.setAttribute('font-weight', '700');
      label.textContent = `${distanceCm.toFixed(1)} см`;
      overlay.appendChild(label);
    }

    canvas.appendChild(overlay);
  }

  // Update room info panel with type and recommendations
  updateRoomInfoPanel();
}

function handleObjectMouseDown(e, obj) {
  if (appState.isMeasureMode) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  if (obj.locked) return;

  e.preventDefault();
  appState.selectedObject = obj;

  const canvas = document.getElementById('canvas');
  const rect = canvas.getBoundingClientRect();
  const offsetX = e.clientX - rect.left - obj.x;
  const offsetY = e.clientY - rect.top - obj.y;

  // Установить перетаскивание до renderCanvas: иначе цель mousedown уничтожается
  // при перерисовке до выставления draggingObject — в части окружений drag ломается.
  appState.draggingObject = obj.id;
  appState.dragOffset = { x: offsetX, y: offsetY };

  updateInspector();
  renderCanvas();
}

function handleRotateMouseDown(e, obj) {
  e.stopPropagation();
  if (obj.locked) return;

  const canvas = document.getElementById('canvas');
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const startAngle = Math.atan2(y - obj.y, x - obj.x) * 180 / Math.PI;

  appState.rotatingObject = obj.id;
  appState.rotationStart = {
    startAngle,
    initialAngle: obj.angle || 0,
  };
}

function selectObject(obj) {
  appState.selectedObject = obj;
  updateInspector();
  renderCanvas();
}

function deleteObject(id) {
  const obj = appState.canvasObjects.find(o => o.id === id);
  if (obj?.locked) return;

  if (obj?.type === 'wall') {
    // Openings cannot exist without a wall.
    appState.canvasObjects = appState.canvasObjects.filter(o => o.id !== id && !(o.type === 'opening' && o.wallId === id));
  } else {
    appState.canvasObjects = appState.canvasObjects.filter(o => o.id !== id);
  }

  if (appState.selectedObject?.id === id) {
    appState.selectedObject = null;
  }
  saveToLocalStorage();
  renderCanvas();
  updateInspector();
}

// =============== INSPECTOR ===============
function updateInspector() {
  const inspectorTitle = document.getElementById('inspector-title');
  const fieldX = document.getElementById('field-x');
  const fieldY = document.getElementById('field-y');
  const fieldZ = document.getElementById('field-z');
  const fieldWidth = document.getElementById('field-width');
  const fieldHeight = document.getElementById('field-height');
  const fieldAngle = document.getElementById('field-angle');
  const fieldComment = document.getElementById('field-comment');
  const btnDelete = document.getElementById('btn-delete');
  const btnVisibility = document.getElementById('btn-visibility');
  const btnLock = document.getElementById('btn-lock');
  const btnBearing = document.getElementById('btn-bearing');
  const btnIgnoreOverlap = document.getElementById('btn-ignore-overlap');

  const setToggleOn = (btn, on) => {
    if (!btn) return;
    btn.classList.toggle('inspector-action--on', Boolean(on));
  };

  if (!appState.selectedObject) {
    if (inspectorTitle) inspectorTitle.textContent = 'Select an object';
    if (fieldX) {
      fieldX.value = '';
      fieldX.disabled = true;
    }
    if (fieldY) {
      fieldY.value = '';
      fieldY.disabled = true;
    }
    if (fieldZ) {
      fieldZ.value = '';
      fieldZ.disabled = true;
    }
    if (fieldWidth) {
      fieldWidth.value = '';
      fieldWidth.disabled = true;
    }
    if (fieldHeight) {
      fieldHeight.value = '';
      fieldHeight.disabled = true;
    }
    if (fieldAngle) {
      fieldAngle.value = '';
      fieldAngle.disabled = true;
    }
    if (fieldComment) {
      fieldComment.value = '';
      fieldComment.disabled = true;
    }

    setToggleOn(btnVisibility, false);
    setToggleOn(btnLock, false);
    setToggleOn(btnBearing, false);
    setToggleOn(btnIgnoreOverlap, false);
    if (btnDelete) btnDelete.disabled = true;
    if (btnVisibility) btnVisibility.disabled = true;
    if (btnLock) btnLock.disabled = true;
    if (btnBearing) btnBearing.disabled = true;
    if (btnIgnoreOverlap) btnIgnoreOverlap.disabled = true;
    return;
  }

  const obj = appState.selectedObject;

  if (inspectorTitle) inspectorTitle.textContent = obj.name;
  if (fieldX) fieldX.value = Math.round(obj.x);
  if (fieldY) fieldY.value = Math.round(obj.y);
  if (fieldZ) fieldZ.value = obj.z;
  if (fieldWidth) fieldWidth.value = obj.width;
  if (fieldHeight) fieldHeight.value = obj.height;
  if (fieldAngle) fieldAngle.value = Math.round(obj.angle || 0);
  if (fieldComment) fieldComment.value = obj.comment || '';

  setToggleOn(btnVisibility, obj.visible !== false);
  setToggleOn(btnLock, !!obj.locked);
  setToggleOn(btnBearing, !!obj.bearing);
  setToggleOn(btnIgnoreOverlap, !!obj.ignoreOverlap);

  if (fieldX) fieldX.disabled = false;
  if (fieldY) fieldY.disabled = false;
  if (fieldZ) fieldZ.disabled = obj.type === 'wall';
  if (fieldWidth) fieldWidth.disabled = false;
  if (fieldHeight) fieldHeight.disabled = false;
  if (fieldAngle) fieldAngle.disabled = false;
  if (fieldComment) fieldComment.disabled = false;

  if (btnBearing) btnBearing.disabled = obj.type !== 'wall';
  if (btnIgnoreOverlap) btnIgnoreOverlap.disabled = obj.type !== 'furniture';
  if (btnDelete) btnDelete.disabled = !!obj.locked;
  if (btnVisibility) btnVisibility.disabled = false;
  if (btnLock) btnLock.disabled = false;

  if (obj.type === 'opening') {
    if (fieldX) fieldX.disabled = true;
    if (fieldY) fieldY.disabled = true;
    if (fieldAngle) fieldAngle.disabled = true;
    if (fieldHeight) fieldHeight.disabled = true;
  }
}

function setupInspectorEventListeners() {
  const fieldX = document.getElementById('field-x');
  const fieldY = document.getElementById('field-y');
  const fieldZ = document.getElementById('field-z');
  const fieldWidth = document.getElementById('field-width');
  const fieldHeight = document.getElementById('field-height');
  const fieldAngle = document.getElementById('field-angle');
  const fieldComment = document.getElementById('field-comment');
  const btnDelete = document.getElementById('btn-delete');
  const btnVisibility = document.getElementById('btn-visibility');
  const btnLock = document.getElementById('btn-lock');
  const btnBearing = document.getElementById('btn-bearing');
  const btnIgnoreOverlap = document.getElementById('btn-ignore-overlap');
  const projectNameInput = document.getElementById('projectName');

  const updateField = (field) => {
    return () => {
      if (!appState.selectedObject) return;
      const obj = appState.selectedObject;

      switch (field) {
        case 'x': obj.x = parseFloat(fieldX?.value) || obj.x; break;
        case 'y': obj.y = parseFloat(fieldY?.value) || obj.y; break;
        case 'z': obj.z = parseInt(fieldZ?.value) || obj.z; break;
        case 'width': obj.width = parseFloat(fieldWidth?.value) || obj.width; break;
        case 'height': obj.height = parseFloat(fieldHeight?.value) || obj.height; break;
        case 'angle': obj.angle = parseInt(fieldAngle?.value) || 0; break;
        case 'comment': obj.comment = fieldComment?.value; break;
      }

      saveToLocalStorage();
      renderCanvas();
    };
  };

  [fieldX, fieldY, fieldZ, fieldWidth, fieldHeight, fieldAngle].forEach(field => {
    if (!field) return;
    field.addEventListener('change', updateField(field.id.split('-')[1]));
  });

  if (fieldComment) fieldComment.addEventListener('change', updateField('comment'));

  if (btnDelete) {
    btnDelete.addEventListener('click', () => {
      if (appState.selectedObject) {
        deleteObject(appState.selectedObject.id);
      }
    });
  }

  if (btnVisibility) {
    btnVisibility.addEventListener('click', () => {
      if (appState.selectedObject) {
        appState.selectedObject.visible = !appState.selectedObject.visible;
        saveToLocalStorage();
        updateInspector();
        renderCanvas();
      }
    });
  }

  if (btnLock) {
    btnLock.addEventListener('click', () => {
      if (appState.selectedObject) {
        appState.selectedObject.locked = !appState.selectedObject.locked;
        saveToLocalStorage();
        updateInspector();
        renderCanvas();
      }
    });
  }

  if (btnBearing) {
    btnBearing.addEventListener('click', () => {
      if (!appState.selectedObject || appState.selectedObject.type !== 'wall') return;
      appState.selectedObject.bearing = !appState.selectedObject.bearing;
      saveToLocalStorage();
      updateInspector();
      renderCanvas();
    });
  }

  if (btnIgnoreOverlap) {
    btnIgnoreOverlap.addEventListener('click', () => {
      if (!appState.selectedObject || appState.selectedObject.type !== 'furniture') return;
      appState.selectedObject.ignoreOverlap = !appState.selectedObject.ignoreOverlap;
      saveToLocalStorage();
      updateInspector();
      renderCanvas();
    });
  }

  if (projectNameInput) {
    projectNameInput.addEventListener('change', () => {
      appState.projectName = projectNameInput.value || 'Untitled Project';
      saveToLocalStorage();
    });
  }
}


// =============== ROOM TYPE (спец-объекты) ===============
const SPECIAL_ROOM_CATEGORY_LABEL = {
  bedroom: 'Спальня',
  bathroom: 'Санузел',
  kitchen: 'Кухня',
};

/** Подсказки для разрешения конфликта типов (что оставить / что убрать). */
const SPECIAL_CATEGORY_RESOLVE_HINT = {
  bedroom: { label: 'Спальня', keep: 'кровать' },
  bathroom: { label: 'Санузел', keep: 'унитаз и/или ванну' },
  kitchen: { label: 'Кухня', keep: 'плиту и/или микроволновку' },
};

function getConflictResolutionRecommendationItems(categoryKeys) {
  const keys = [...categoryKeys];
  const order = ['bedroom', 'bathroom', 'kitchen'];
  keys.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return keys.map((target) => {
    const hint = SPECIAL_CATEGORY_RESOLVE_HINT[target];
    const otherLabels = keys.filter(k => k !== target).map(k => SPECIAL_ROOM_CATEGORY_LABEL[k]);
    let removePhrase;
    if (otherLabels.length === 1) {
      removePhrase = `уберите спец-объекты категории «${otherLabels[0]}»`;
    } else if (otherLabels.length === 2) {
      removePhrase = `уберите спец-объекты категорий «${otherLabels[0]}» и «${otherLabels[1]}»`;
    } else {
      removePhrase = 'уберите лишние спец-объекты';
    }
    return {
      name: `Оставить только «${hint.label}»`,
      reason: `Оставьте в комнате ${hint.keep}; ${removePhrase}.`,
    };
  });
}

function getSpecialRoomCategoryKey(subtype) {
  const s = String(subtype || '').toLowerCase();
  if (s === 'bed') return 'bedroom';
  if (s === 'toilet' || s === 'bathtub') return 'bathroom';
  if (s === 'microwave' || s === 'stove') return 'kitchen';
  return null;
}

/**
 * Тип комнаты по спец-объектам: при нескольких несовместимых категориях — конфликт.
 * Порядок «первого» объекта — по id (порядок добавления в типичном случае).
 */
function classifyRoomBySpecialFurniture(furnitureList) {
  const list = furnitureList ? [...furnitureList] : [];
  const specials = list
    .filter(f => f.type === 'furniture' && getSpecialRoomCategoryKey(f.subtype))
    .sort(sortFurnitureByPlacementOrder);

  const subtypes = list.map(f => String(f.subtype || '').toLowerCase());
  const counts = {
    bed: subtypes.filter(s => s === 'bed').length,
    toilet: subtypes.filter(s => s === 'toilet').length,
    bathtub: subtypes.filter(s => s === 'bathtub').length,
    microwave: subtypes.filter(s => s === 'microwave').length,
    stove: subtypes.filter(s => s === 'stove').length,
    sofa: subtypes.filter(s => s === 'sofa').length,
    table: subtypes.filter(s => s === 'table').length,
    chair: subtypes.filter(s => s === 'chair').length,
    cabinet: subtypes.filter(s => s === 'cabinet').length,
    lamp: subtypes.filter(s => s === 'lamp').length,
  };

  if (specials.length === 0) {
    if (list.length === 0) {
      return {
        type: 'Empty',
        confidence: 0,
        conflict: false,
        conflictMessage: '',
        conflictCategories: [],
        counts,
        firstCategoryKey: null,
      };
    }
    return {
      type: 'Неизвестная',
      confidence: 0.3,
      conflict: false,
      conflictMessage: '',
      conflictCategories: [],
      counts,
      firstCategoryKey: null,
    };
  }

  const categoryKeys = [...new Set(specials.map(f => getSpecialRoomCategoryKey(f.subtype)))];
  if (categoryKeys.length > 1) {
    return {
      type: 'Конфликт',
      confidence: 0,
      conflict: true,
      conflictMessage: 'Несовместимые объекты',
      conflictCategories: categoryKeys,
      counts,
      firstCategoryKey: getSpecialRoomCategoryKey(specials[0].subtype),
    };
  }

  const cat = categoryKeys[0];
  return {
    type: SPECIAL_ROOM_CATEGORY_LABEL[cat],
    confidence: 0.9,
    conflict: false,
    conflictMessage: '',
    conflictCategories: [],
    counts,
    firstCategoryKey: cat,
  };
}

// =============== FURNITURE RECOMMENDATIONS ===============
function getFurnitureRecommendations(roomType) {
  const recommendations = {
    'Спальня': [
      { name: 'Шкаф', subtype: 'cabinet', reason: 'Для хранения одежды' },
      { name: 'Лампа', subtype: 'lamp', reason: 'Для освещения' },
      { name: 'Стол', subtype: 'table', reason: 'Туалетный столик' },
    ],
    'Санузел': [
      { name: 'Шкаф', subtype: 'cabinet', reason: 'Для полотенец и средств' },
      { name: 'Лампа', subtype: 'lamp', reason: 'Освещение' },
    ],
    'Кухня': [
      { name: 'Шкаф', subtype: 'cabinet', reason: 'Хранение посуды и продуктов' },
      { name: 'Стол', subtype: 'table', reason: 'Обеденная зона' },
      { name: 'Стул', subtype: 'chair', reason: 'Посадочные места' },
    ],
    'Неизвестная': [
      { name: 'Стол', subtype: 'table', reason: 'Базовая планировка' },
      { name: 'Стул', subtype: 'chair', reason: 'Для сидения' },
    ],
    'Empty': [
      { name: 'Стол', subtype: 'table', reason: 'Основная мебель' },
      { name: 'Стул', subtype: 'chair', reason: 'Для сидения' },
      { name: 'Кровать', subtype: 'bed', reason: 'Спальня' },
    ],
    'Конфликт': [],
  };

  return recommendations[roomType] || [];
}

// =============== LIGHTING ANALYSIS WITH OBSTACLES ===============

/**
 * Проверяет, есть ли прямая видимость между двумя точками
 * Использует готовую функцию segmentsIntersest из кода
 */
function isLineOfSightClear(x1, y1, x2, y2, obstacles) {
  // Проходим по всем препятствиям
  for (const obs of obstacles) {
    // Получаем 4 стороны (отрезки) препятствия
    const corners = getObjectCorners(obs);
    if (!corners || corners.length < 3) continue;

    // Проверяем пересечение луча (отрезка от источника до точки) с каждой стороной
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % corners.length];

      // Игнорируем, если источник или точка лежат на этом же отрезке (допуск)
      if (segmentsIntersect({ x: x1, y: y1 }, { x: x2, y: y2 }, a, b)) {
        return false; // Есть пересечение – свет не проходит
      }
    }
  }
  return true;
}

/**
 * Анализ освещения с учётом препятствий
 */
function analyzeLighting() {
  const objects = appState.canvasObjects;
  const lamps = objects.filter(obj => obj.subtype === 'lamp');
  const windows = objects.filter(obj => obj.subtype === 'window');

  // Препятствия: все объекты, КРОМЕ ламп, окон и проёмов (они не блокируют свет)
  const obstacles = objects.filter(obj => {
    if (obj.subtype === 'lamp') return false;
    if (obj.subtype === 'window') return false;
    if (obj.type === 'opening') return false;
    return true;
  });

  // Размер области анализа (подберите под свой проект)
  const width = 2000;
  const height = 1600;
  const gridSize = 1; // чем меньше, тем точнее, но медленнее
  const xOffset = 0;
  const yOffset = 0;

  const LAMP_RADIUS = 180;
  const WINDOW_RADIUS = 250;

  const grid = [];

  for (let y = 0; y < height; y += gridSize) {
    for (let x = 0; x < width; x += gridSize) {
      const worldX = x + xOffset;
      const worldY = y + yOffset;

      let intensity = 0.15; // базовый свет

      // Лампы
      for (const lamp of lamps) {
        const dx = worldX - lamp.x;
        const dy = worldY - lamp.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= LAMP_RADIUS) continue;

        // Проверяем видимость
        const visible = isLineOfSightClear(lamp.x, lamp.y, worldX, worldY, obstacles);
        if (visible) {
          const falloff = Math.pow(1 - dist / LAMP_RADIUS, 1.5);
          intensity += falloff * 0.65;
        } else if (dist < LAMP_RADIUS * 0.3) {
          // небольшой рассеянный свет
          intensity += 0.08;
        }
      }

      // В analyzeLighting(), при расчёте света от окон:

      for (const win of windows) {
        const dx = worldX - win.x;
        const dy = worldY - win.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= WINDOW_RADIUS) continue;

        // Игнорируем стену, в которой находится окно
        const ignoredWallId = win.wallId; // предполагаем, что у окна есть wallId
        
        const visible = isLineOfSightClear(win.x, win.y, worldX, worldY, obstacles, ignoredWallId);
        if (visible) {
          const falloff = 1 - dist / WINDOW_RADIUS;
          intensity += falloff * 0.5; // 0.5 - интенсивность света от окна
        } else if (dist < WINDOW_RADIUS * 0.2) {
          intensity += 0.05;
        }
      }

      intensity = Math.min(intensity, 0.95);
      grid.push({ x: worldX, y: worldY, intensity });
    }
  }

  console.log(`Освещение рассчитано. Точек: ${grid.length}, препятствий: ${obstacles.length}`);
  return grid;
}

function isLineOfSightClear(x1, y1, x2, y2, obstacles, ignoredObstacleId = null) {
  // Проходим по всем препятствиям
  for (const obs of obstacles) {
    // Игнорируем указанную стену (ту, в которой находится окно)
    if (ignoredObstacleId !== null && obs.id === ignoredObstacleId) continue;
    
    // Получаем 4 стороны (отрезки) препятствия
    const corners = getObjectCorners(obs);
    if (!corners || corners.length < 3) continue;

    // Проверяем пересечение луча с каждой стороной
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % corners.length];

      if (segmentsIntersect({ x: x1, y: y1 }, { x: x2, y: y2 }, a, b)) {
        return false; // Есть пересечение – свет не проходит
      }
    }
  }
  return true;
}

function createStandardRoom(width, height) {
  // Очистить все существующие объекты
  appState.canvasObjects = [];
  appState.walls = [];
  
  // Получаем центр канваса как начальную точку комнаты
  const canvas = document.getElementById('canvas');
  const canvasRect = canvas.getBoundingClientRect();
  const centerX = canvasRect.width / 2;
  const centerY = canvasRect.height / 2;
  
  // Вычисляем левый верхний угол комнаты относительно центра
  const leftX = centerX - width / 2;
  const topY = centerY - height / 2;
  
  const wallThick = 12; // толщина стены
  
  // Верхняя стена (горизонтальная, угол 0)
  const top = {
    x: leftX + width / 2,
    y: topY,
    width: width,
    height: wallThick,
    angle: 0,
  };
  
  // Правая стена (вертикальная, угол 90)
  const right = {
    x: leftX + width,
    y: topY + height / 2,
    width: height,
    height: wallThick,
    angle: 90,
  };
  
  // Нижняя стена (горизонтальная, угол 180)
  const bottom = {
    x: leftX + width / 2,
    y: topY + height,
    width: width,
    height: wallThick,
    angle: 180,
  };
  
  // Левая стена (вертикальная, угол -90)
  const left = {
    x: leftX,
    y: topY + height / 2,
    width: height,
    height: wallThick,
    angle: -90,
  };
  
  const walls = [top, right, bottom, left];
  
  walls.forEach((wall, idx) => {
    appState.canvasObjects.push({
      id: Date.now() + idx + Math.random(),
      type: 'wall',
      x: wall.x,
      y: wall.y,
      width: wall.width,
      height: wall.height,
      angle: wall.angle,
      z: idx,
      color: '#4f4f4f',
      visible: true,
      locked: false,
    });
  });
  
  saveToLocalStorage();
  renderCanvas();
}
// =============== UI UPDATES ===============
function updateRoomInfoPanel(room = null) {
  const rooms = appState.detectedRooms || [];
  let activeRoomIndex = Number.isInteger(appState.selectedRoomIndex) ? appState.selectedRoomIndex : null;

  if (Number.isInteger(room)) {
    activeRoomIndex = room;
  } else if (room && typeof room === 'object') {
    const objectRoomIndex = rooms.indexOf(room);
    if (objectRoomIndex >= 0) activeRoomIndex = objectRoomIndex;
  }

  if (rooms.length > 0) {
    if (!Number.isInteger(activeRoomIndex) || activeRoomIndex < 0 || activeRoomIndex >= rooms.length) {
      activeRoomIndex = 0;
    }
    appState.selectedRoomIndex = activeRoomIndex;
  } else {
    activeRoomIndex = null;
    appState.selectedRoomIndex = null;
  }

  const activeRoom = Number.isInteger(activeRoomIndex) ? rooms[activeRoomIndex] : null;
  const furniture = activeRoom ? getFurnitureInRoom(activeRoom) : [];
  const roomInfo = classifyRoomBySpecialFurniture(furniture);
  const infoPanelSelector = '#room-info-panel';
  
  if (!document.querySelector(infoPanelSelector)) {
    const panel = document.createElement('div');
    panel.id = 'room-info-panel';
    panel.className = 'room-info-panel';
    const inspector = document.querySelector('.inspector') || document.querySelector('.canvas');
    if (inspector) inspector.appendChild(panel);
  }
  
  const panel = document.querySelector(infoPanelSelector);
  if (!panel) return;
  let recommendationsMarkup;
  if (roomInfo.conflict && roomInfo.conflictCategories && roomInfo.conflictCategories.length > 1) {
    const conflictRecs = getConflictResolutionRecommendationItems(roomInfo.conflictCategories);
    recommendationsMarkup = conflictRecs.map(r => `
    <li>
      <strong>${r.name}</strong>
      <br><small>${r.reason}</small>
    </li>
  `).join('');
  } else {
    const recommendations = getFurnitureRecommendations(roomInfo.type);
    recommendationsMarkup = recommendations.length
      ? recommendations.map(r => `
    <li>
      <strong>${r.name}</strong>
      <br><small>${r.reason}</small>
    </li>
  `).join('')
      : '<li class="recommendations-empty"><small>Нет рекомендаций для этого состояния.</small></li>';
  }

  const totalCm2 = activeRoom ? canvasAreaToCm2(activeRoom.area || 0) : 0;
  const occupiedCanvas = activeRoom ? getOccupiedFurnitureAreaInRoom(activeRoom) : 0;
  const occupiedCm2 = canvasAreaToCm2(occupiedCanvas);
  const freeCm2 = Math.max(0, totalCm2 - occupiedCm2);

  const roomSwitcherMarkup = rooms.length > 0
    ? `
      <div class="room-switcher">
        <button id="roomPrevBtn" class="room-switch-btn" ${rooms.length < 2 ? 'disabled' : ''}>←</button>
        <span class="room-switch-label">Комната ${activeRoomIndex + 1} из ${rooms.length}</span>
        <button id="roomNextBtn" class="room-switch-btn" ${rooms.length < 2 ? 'disabled' : ''}>→</button>
      </div>
      <p class="room-meta">Площадь: ${Math.round(totalCm2)} см²</p>
      <p class="room-meta room-meta-free">Свободно (оценка): ${Math.round(freeCm2)} см²</p>
    `
    : '<p class="room-meta">Замкнутых комнат пока нет. Замкните стены, и комната появится автоматически.</p>';

  const conflictMarkup = roomInfo.conflict && roomInfo.conflictMessage
    ? `<div class="room-conflict-alert" role="alert">${roomInfo.conflictMessage}</div>`
    : '';

  const confidenceMarkup = roomInfo.conflict
    ? ''
    : `<p class="confidence">Уверенность: ${Math.round(roomInfo.confidence * 100)}%</p>`;
  
  panel.innerHTML = `
    <div class="room-info">
      <h4>📍 Текущая комната</h4>
      ${roomSwitcherMarkup}

      <h4>🏠 Тип комнаты</h4>
      ${conflictMarkup}
      <p class="room-type">${roomInfo.type}</p>
      ${confidenceMarkup}
      
      <h4>💡 Освещение</h4>
      <div class="lighting-info">
        <button id="toggleLighting" class="lighting-toggle">Показать освещение</button>
      </div>
      
      <h4>🛋️ Рекомендации</h4>
      <ul class="recommendations">
        ${recommendationsMarkup}
      </ul>
    </div>
  `;

  const roomPrevBtn = document.getElementById('roomPrevBtn');
  const roomNextBtn = document.getElementById('roomNextBtn');
  if (roomPrevBtn) {
    roomPrevBtn.addEventListener('click', () => {
      if (rooms.length === 0) return;
      const current = Number.isInteger(appState.selectedRoomIndex) ? appState.selectedRoomIndex : 0;
      const next = (current - 1 + rooms.length) % rooms.length;
      appState.selectedRoomIndex = next;
      updateRoomInfoPanel(next);
    });
  }
  if (roomNextBtn) {
    roomNextBtn.addEventListener('click', () => {
      if (rooms.length === 0) return;
      const current = Number.isInteger(appState.selectedRoomIndex) ? appState.selectedRoomIndex : 0;
      const next = (current + 1) % rooms.length;
      appState.selectedRoomIndex = next;
      updateRoomInfoPanel(next);
    });
  }
  
  // Setup lighting toggle
  const lightingBtn = document.getElementById('toggleLighting');
  if (lightingBtn) {
    lightingBtn.addEventListener('click', toggleLightingVisualization);
  }
}

function toggleLightingVisualization() {
  const canvas = document.getElementById('canvas');
  const lightingOverlay = document.getElementById('lighting-overlay');
  
  if (lightingOverlay) {
    lightingOverlay.remove();
    document.getElementById('toggleLighting').textContent = 'Показать освещение';
    return;
  }
  
  const grid = analyzeLighting();
  const overlay = document.createElement('canvas');
  overlay.id = 'lighting-overlay';
  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.pointerEvents = 'none';
  overlay.width = canvas.offsetWidth;
  overlay.height = canvas.offsetHeight;
  overlay.style.opacity = '0.5';
  
  const ctx = overlay.getContext('2d');
  
  grid.forEach(point => {
    const hue = (1 - point.intensity) * 240; // Blue = dark, Red = bright
    ctx.fillStyle = `hsl(${hue}, 100%, ${50 + point.intensity * 30}%)`;
    ctx.fillRect(point.x * appState.zoom, point.y * appState.zoom, 
                 50 * appState.zoom, 50 * appState.zoom);
  });
  
  canvas.appendChild(overlay);
  document.getElementById('toggleLighting').textContent = 'Скрыть освещение';
}

// =============== UTILITIES ===============
function normalizeAngle(angle) {
  while (angle < 0) angle += 360;
  while (angle >= 360) angle -= 360;
  return angle;
}

function snapAngle(angle, snap) {
  return Math.round(angle / snap) * snap;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function worldToWallLocal(wall, worldX, worldY) {
  const dx = worldX - wall.x;
  const dy = worldY - wall.y;
  const rad = -(wall.angle || 0) * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos,
  };
}

function wallLocalToWorld(wall, localX, localY) {
  const rad = (wall.angle || 0) * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: wall.x + localX * cos - localY * sin,
    y: wall.y + localX * sin + localY * cos,
  };
}

function findNearestWallProjection(worldX, worldY) {
  const walls = appState.canvasObjects.filter(o => o.type === 'wall');
  if (walls.length === 0) return null;

  let best = null;
  for (const wall of walls) {
    const local = worldToWallLocal(wall, worldX, worldY);
    const halfLen = wall.width / 2;
    const over = Math.max(0, Math.abs(local.x) - halfLen);
    const distToCenterline = Math.abs(local.y);
    const score = distToCenterline + over * 2;
    if (!best || score < best.score) {
      best = { wall, localX: local.x, distToCenterline, score };
    }
  }
  return best;
}

function findWallHitAtPoint(worldX, worldY) {
  const walls = appState.canvasObjects.filter(o => o.type === 'wall');
  let best = null;

  for (const wall of walls) {
    const local = worldToWallLocal(wall, worldX, worldY);
    const halfLen = wall.width / 2;
    const halfTh = wall.height / 2;

    // For openings, we want "nearest wall" snapping.
    // Allow some tolerance beyond endpoints and thickness.
    const maxDistToCenterline = Math.max(halfTh, 80);
    const endTolerance = 30;

    if (Math.abs(local.y) <= maxDistToCenterline && Math.abs(local.x) <= halfLen + endTolerance) {
      // Penalize being past the endpoints so we prefer walls where projection lies inside segment.
      const over = Math.max(0, Math.abs(local.x) - halfLen);
      const score = Math.abs(local.y) + over * 2;
      if (!best || score < best.score) best = { wall, localX: local.x, score };
    }
  }

  return best ? { wall: best.wall, localX: best.localX } : null;
}

function createOpeningOnWall(openingItem, wall, localX) {
  const width = Number(openingItem.width) || 60;
  const height = wall.height;
  const halfWall = wall.width / 2;
  const halfOpening = width / 2;
  const clampedLocalX = clamp(localX, -halfWall + halfOpening, halfWall - halfOpening);

  const opening = {
    id: Date.now() + Math.random(),
    type: 'opening',
    subtype: openingItem.subtype,
    name: openingItem.name,
    color: openingItem.color,
    width,
    height,
    wallId: wall.id,
    wallOffset: clampedLocalX,
    x: wall.x,
    y: wall.y,
    angle: wall.angle || 0,
    // IMPORTANT: keep z-index integer (CSS z-index is integer; floats can be ignored by browser)
    z: (Math.round(Number(wall.z) || 0) + 1),
    visible: true,
    locked: false,
    comment: '',
  };

  updateOpeningWorldPose(opening, wall);
  return opening;
}

function updateOpeningWorldPose(opening, wall) {
  opening.height = wall.height;
  opening.angle = wall.angle || 0;
  const wz = Math.round(Number(wall.z) || 0);
  const oz = Math.round(Number(opening.z) || 0);
  opening.z = Math.max(oz, wz + 1);

  const pos = wallLocalToWorld(wall, opening.wallOffset || 0, 0);
  opening.x = pos.x;
  opening.y = pos.y;
}

function saveToLocalStorage(options = {}) {
  localStorage.setItem('projectName', appState.projectName);
  if (!options.skipDirtyMark) {
    appState.workspaceDirty = true;
  }
}

function isTextInputActive() {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || active.isContentEditable;
}

function moveSelectedObjectBy(deltaX, deltaY) {
  const obj = appState.selectedObject;
  if (!obj || obj.locked) return;

  if (obj.type === 'opening') {
    const wall = appState.canvasObjects.find(o => o.type === 'wall' && o.id === obj.wallId);
    if (!wall) return;

    const targetX = obj.x + deltaX;
    const targetY = obj.y + deltaY;
    const local = worldToWallLocal(wall, targetX, targetY);
    const halfWall = wall.width / 2;
    const halfOpening = obj.width / 2;
    obj.wallOffset = clamp(local.x, -halfWall + halfOpening, halfWall - halfOpening);
    updateOpeningWorldPose(obj, wall);
  } else {
    obj.x += deltaX;
    obj.y += deltaY;
  }

  updateInspector();
  renderCanvas();
}

function getKeyboardMoveDelta() {
  const STEP = 1;
  let dx = 0;
  let dy = 0;

  if (appState.pressedMoveKeys.has('ArrowLeft')) dx -= STEP;
  if (appState.pressedMoveKeys.has('ArrowRight')) dx += STEP;
  if (appState.pressedMoveKeys.has('ArrowUp')) dy -= STEP;
  if (appState.pressedMoveKeys.has('ArrowDown')) dy += STEP;

  return { dx, dy };
}

function applyKeyboardMovementTick() {
  const { dx, dy } = getKeyboardMoveDelta();
  if (dx === 0 && dy === 0) return;
  moveSelectedObjectBy(dx, dy);
}

function startKeyboardMovement() {
  if (appState.keyboardMoveIntervalId !== null) return;
  appState.keyboardMoveIntervalId = setInterval(() => {
    applyKeyboardMovementTick();
  }, 30);
}

function stopKeyboardMovementIfIdle() {
  if (appState.pressedMoveKeys.size > 0) return;
  if (appState.keyboardMoveIntervalId !== null) {
    clearInterval(appState.keyboardMoveIntervalId);
    appState.keyboardMoveIntervalId = null;
    saveToLocalStorage();
  }
}

function setupKeyboardEventListeners() {
  document.addEventListener('keydown', (e) => {
    if (isTextInputActive()) return;

    if (e.key === 'Delete') {
      if (appState.selectedObject) {
        e.preventDefault();
        deleteObject(appState.selectedObject.id);
      }
      return;
    }

    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    appState.pressedMoveKeys.add(e.key);
    applyKeyboardMovementTick();
    startKeyboardMovement();
  });

  document.addEventListener('keyup', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    appState.pressedMoveKeys.delete(e.key);
    stopKeyboardMovementIfIdle();
  });

  window.addEventListener('blur', () => {
    appState.pressedMoveKeys.clear();
    stopKeyboardMovementIfIdle();
  });
}

// =============== EVENT SETUP ===============
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

if (authToken) {
  loadCustomObjects();
}