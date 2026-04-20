// Configuration
const API_URL = '/api';
const SNAP_DISTANCE = 15; // Distance in pixels for magnetic snapping
const SNAP_LINE_COLOR = '#FF6B6B'; // Color of snap indication lines
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
let currentProjectId = localStorage.getItem('currentProjectId');

// Furniture and wall data
const furnitureItems = [
  { type: 'furniture', subtype: 'table', name: 'Table', width: 100, height: 100, color: '#8B4513' },
  { type: 'furniture', subtype: 'chair', name: 'Chair', width: 50, height: 50, color: '#654321' },
  { type: 'furniture', subtype: 'sofa', name: 'Sofa', width: 150, height: 150, color: '#4169E1' },
  { type: 'furniture', subtype: 'cabinet', name: 'Cabinet', width: 80, height: 80, color: '#8B4513' },
  { type: 'furniture', subtype: 'bed', name: 'Bed', width: 160, height: 160, color: '#FF6347' },
  { type: 'furniture', subtype: 'lamp', name: 'Lamp', width: 30, height: 30, color: '#FFD700' },
];

const wallItems = [
  { type: 'wall', subtype: 'standard', name: 'Wall', width: 240, height: 12, color: '#4f4f4f' },
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
  projectName: 'Untitled Project',
  walls: [],
  detectedRooms: [],
};

// Modal state
let authMode = 'login';

// Initialize
async function init() {
  setupEventListeners();
  renderSidebar();
  renderCanvas();
  loadFromLocalStorage();
  
  if (authToken && currentUser) {
    updateAuthUI();
    if (currentProjectId) {
      await loadProject(currentProjectId);
    }
  }
}

// =============== AUTH ===============
function setupAuthUI() {
  const loginBtn = document.getElementById('loginBtn');
  const loginModal = document.getElementById('loginModal');
  const closeBtn = loginModal.querySelector('.close');
  const authForm = document.getElementById('authForm');
  const authToggleBtn = document.getElementById('authToggleBtn');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const authEmailInput = document.getElementById('authEmail');

  loginBtn.addEventListener('click', () => {
    authMode = 'login';
    loginModal.classList.remove('hidden');
  });

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
      const endpoint = authMode === 'login' ? 'auth/login/' : 'auth/register/';
      const data = authMode === 'login' 
        ? { username, password }
        : { username, password, email };

      const response = await fetch(`${API_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Authentication failed');

      const result = await response.json();
      authToken = result.token;
      currentUser = { id: result.user_id, username: result.username, email: result.email };
      
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('currentUser', JSON.stringify(currentUser));

      updateAuthUI();
      loginModal.classList.add('hidden');
      document.getElementById('authMessage').textContent = '';
      authForm.reset();
    } catch (error) {
      const msg = document.getElementById('authMessage');
      msg.textContent = error.message;
      msg.className = 'error';
    }
  });
}

function updateAuthUI() {
  const loginBtn = document.getElementById('loginBtn');
  if (authToken && currentUser) {
    loginBtn.textContent = `${currentUser.username}`;
    loginBtn.style.background = '#4CAF50';
  } else {
    loginBtn.textContent = 'Login';
    loginBtn.style.background = 'rgba(255, 255, 255, 0.2)';
  }
}

// =============== PROJECT MANAGEMENT ===============
async function saveProject() {
  if (!authToken) {
    alert('Please login to save projects');
    return;
  }

  try {
    const projectData = {
      name: appState.projectName || 'Untitled Project',
      description: 'Furniture layout project',
      room_width: 400,
      room_height: 300,
    };

    let projectId;
    if (currentProjectId) {
      const updateResponse = await fetch(`${API_URL}/projects/${currentProjectId}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${authToken}`,
        },
        body: JSON.stringify(projectData),
      });
      
      if (!updateResponse.ok) {
        throw new Error(`Failed to update project: ${updateResponse.status}`);
      }
      projectId = currentProjectId;
    } else {
      const response = await fetch(`${API_URL}/projects/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${authToken}`,
        },
        body: JSON.stringify(projectData),
      });

      if (!response.ok) throw new Error(`Failed to create project: ${response.status}`);
      const result = await response.json();
      projectId = result.id;
      currentProjectId = projectId;
      localStorage.setItem('currentProjectId', projectId);
    }

    // First, delete existing furniture items and walls for this project
    try {
      await fetch(`${API_URL}/projects/${projectId}/furniture_items/?delete_all=true`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Token ${authToken}`,
        },
      });
    } catch (e) {
      // Ignore if endpoint doesn't exist
    }

    // Save furniture items
    for (const obj of appState.canvasObjects) {
      const itemData = {
        name: obj.name,
        subtype: obj.subtype,
        item_type: obj.type === 'wall' ? 'wall' : obj.customId ? 'custom' : 'preset',
        x: obj.x,
        y: obj.y,
        z_index: obj.z,
        width: obj.width,
        height: obj.height,
        angle: obj.angle || 0,
        color: obj.color,
        visible: obj.visible !== false,
        locked: obj.locked || false,
        comment: obj.comment || '',
      };

      if (obj.customId) {
        itemData.custom_object = obj.customId;
      }

      const itemResponse = await fetch(`${API_URL}/projects/${projectId}/furniture_items/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${authToken}`,
        },
        body: JSON.stringify(itemData),
      });
      
      if (!itemResponse.ok) {
        const errorText = await itemResponse.text();
        console.error('Failed to save item:', itemData, 'Response:', errorText);
        throw new Error(`Failed to save furniture item: ${itemResponse.status}`);
      }
    }

    alert('Project saved successfully!');
  } catch (error) {
    console.error('Error saving project:', error);
    alert('Error saving project: ' + error.message);
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

async function loadProject(projectId) {
  if (!authToken) return;

  try {
    const response = await fetch(`${API_URL}/projects/${projectId}/`, {
      headers: {
        'Authorization': `Token ${authToken}`,
      },
    });

    if (!response.ok) throw new Error('Failed to load project');
    const project = await response.json();

    appState.projectName = project.name;
    document.getElementById('projectName').value = project.name;
    appState.canvasObjects = [];
    appState.walls = [];

    // Load furniture items
    for (const item of project.furniture_items) {
      appState.canvasObjects.push({
        id: item.id,
        name: item.name,
        subtype: item.subtype,
        type: item.item_type === 'wall' ? 'wall' : 'furniture',
        x: item.x,
        y: item.y,
        z: item.z_index,
        width: item.width,
        height: item.height,
        angle: item.angle,
        color: item.color,
        visible: item.visible,
        locked: item.locked,
        comment: item.comment || '',
        customId: item.custom_object?.id,
      });
    }

    // Load walls
    for (const wall of project.walls) {
      appState.walls.push(wall);
    }

    saveToLocalStorage();
    renderCanvas();
  } catch (error) {
    console.error('Error loading project:', error);
  }
}

// =============== CUSTOM OBJECTS ===============
async function setupCustomObjectUI() {
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
  appState.customObjects.forEach(item => {
    const sidebarItem = {
      type: 'furniture',
      subtype: 'custom',
      name: item.name,
      width: item.width,
      height: item.height,
      color: item.color,
      customId: item.id,
    };
    customGrid.appendChild(createSidebarItem(sidebarItem));
  });
}

function createSidebarItem(item) {
  const el = document.createElement('div');
  el.className = 'item';
  el.style.backgroundColor = item.color;
  el.draggable = true;
  el.textContent = item.name;

  el.addEventListener('dragstart', (e) => handleSidebarDragStart(e, item));
  el.addEventListener('dragend', handleSidebarDragEnd);
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
  dragPreview.textContent = item.name;
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

// =============== CANVAS ===============
function setupCanvasEventListeners() {
  const canvas = document.getElementById('canvas');
  canvas.addEventListener('dragover', handleCanvasDragOver);
  canvas.addEventListener('dragleave', handleCanvasDragLeave);
  canvas.addEventListener('drop', handleCanvasDrop);
  canvas.addEventListener('mousemove', handleCanvasMouseMove);
  canvas.addEventListener('mouseup', handleCanvasMouseUp);
  canvas.addEventListener('mouseleave', handleCanvasMouseUp);
}

function handleCanvasDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  document.getElementById('canvas').classList.add('dragging-over');

  const data = e.dataTransfer.getData('application/json');
  if (data) {
    const item = JSON.parse(data);
    const dimensions = normalizeObjectDimensions(item);
    const rect = document.getElementById('canvas').getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    appState.previewObject = { ...item, ...dimensions, x, y };
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
  appState.previewObject = null;

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
      customId: item.customId,
    };

    if (item.type === 'wall') {
      newObject.bearing = false;
    }

    appState.canvasObjects.push(newObject);
    saveToLocalStorage();
    renderCanvas();
  }
}

function handleCanvasMouseMove(e) {
  const canvas = document.getElementById('canvas');
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
  const rooms = [];
  const walls = appState.canvasObjects.filter(obj => obj.type === 'wall');
  
  if (walls.length === 0) return rooms;

  // Check if walls form a closed polygon by verifying connectivity
  // For each wall, check if its ends connect to other walls
  const visited = new Set();
  
  for (let i = 0; i < walls.length; i++) {
    if (visited.has(walls[i].id)) continue;
    
    // Start tracing from this wall
    const chain = [];
    let currentWall = walls[i];
    let chainVisited = new Set();
    
    while (currentWall && !chainVisited.has(currentWall.id)) {
      chain.push(currentWall);
      chainVisited.add(currentWall.id);
      
      // Find next connected wall
      const wallEnd = {
        x: currentWall.x + currentWall.width / 2 * Math.cos(currentWall.angle * Math.PI / 180),
        y: currentWall.y + currentWall.width / 2 * Math.sin(currentWall.angle * Math.PI / 180)
      };
      
      let found = false;
      for (const wall of walls) {
        if (chainVisited.has(wall.id)) continue;
        
        const wallStart = {
          x: wall.x - wall.width / 2 * Math.cos(wall.angle * Math.PI / 180),
          y: wall.y - wall.width / 2 * Math.sin(wall.angle * Math.PI / 180)
        };
        
        const dist = Math.sqrt(Math.pow(wallEnd.x - wallStart.x, 2) + Math.pow(wallEnd.y - wallStart.y, 2));
        
        if (dist < 5) {
          currentWall = wall;
          found = true;
          break;
        }
      }
      
      if (!found) break;
    }
    
    // Check if chain is closed (ends connect)
    if (chain.length > 2) {
      const firstWallStart = {
        x: chain[0].x - chain[0].width / 2 * Math.cos(chain[0].angle * Math.PI / 180),
        y: chain[0].y - chain[0].width / 2 * Math.sin(chain[0].angle * Math.PI / 180)
      };
      
      const lastWallEnd = {
        x: chain[chain.length - 1].x + chain[chain.length - 1].width / 2 * Math.cos(chain[chain.length - 1].angle * Math.PI / 180),
        y: chain[chain.length - 1].y + chain[chain.length - 1].width / 2 * Math.sin(chain[chain.length - 1].angle * Math.PI / 180)
      };
      
      const closingDist = Math.sqrt(Math.pow(firstWallStart.x - lastWallEnd.x, 2) + Math.pow(firstWallStart.y - lastWallEnd.y, 2));
      
      if (closingDist < 5) {
        // This is a closed room
        const roomBounds = calculateRoomBounds(chain);
        rooms.push({
          walls: chain,
          bounds: roomBounds,
          area: calculatePolygonArea(roomBounds)
        });
        
        chain.forEach(wall => visited.add(wall.id));
      }
    }
  }
  
  appState.detectedRooms = rooms;
  return rooms;
}

function calculateRoomBounds(walls) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  walls.forEach(wall => {
    const halfW = wall.width / 2 * Math.cos(wall.angle * Math.PI / 180);
    const halfH = wall.width / 2 * Math.sin(wall.angle * Math.PI / 180);
    
    minX = Math.min(minX, wall.x - halfW, wall.x + halfW);
    maxX = Math.max(maxX, wall.x - halfW, wall.x + halfW);
    minY = Math.min(minY, wall.y - halfH, wall.y + halfH);
    maxY = Math.max(maxY, wall.y - halfH, wall.y + halfH);
  });
  
  return { minX, maxX, minY, maxY };
}

function calculatePolygonArea(bounds) {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  return width * height;
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
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const colors = ['#949494', '#e3f2fd', '#fff3e0', '#fce4ec', '#f3e5f5'];
      rect.setAttribute('x', room.bounds.minX);
      rect.setAttribute('y', room.bounds.minY);
      rect.setAttribute('width', room.bounds.maxX - room.bounds.minX);
      rect.setAttribute('height', room.bounds.maxY - room.bounds.minY);
      rect.setAttribute('fill', colors[index % colors.length]);
      rect.setAttribute('fill-opacity', '0.3');
      rect.setAttribute('stroke', '#999');
      rect.setAttribute('stroke-width', '2');
      rect.setAttribute('stroke-dasharray', '5,5');
      svg.appendChild(rect);
    });
    
    canvas.appendChild(svg);
  }

  const sorted = [...appState.canvasObjects].sort((a, b) => a.z - b.z);

  sorted.forEach(obj => {
    const el = document.createElement('div');
    el.className = `canvas-object ${obj.type === 'wall' ? 'wall' : ''}${obj.type === 'wall' && obj.bearing ? ' wall-bearing' : ''}`;
    el.dataset.id = obj.id;
    el.style.position = 'absolute';
    el.style.left = `${obj.x - obj.width / 2}px`;
    el.style.top = `${obj.y - obj.height / 2}px`;
    el.style.width = `${obj.width}px`;
    el.style.height = `${obj.height}px`;
    el.style.backgroundColor = obj.color;
    el.style.border = '2px solid #333';
    el.style.borderRadius = '4px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.color = 'white';
    el.style.fontSize = '12px';
    el.style.fontWeight = 'bold';
    el.style.cursor = obj.locked ? 'not-allowed' : appState.draggingObject === obj.id ? 'grabbing' : 'grab';
    el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    el.style.zIndex = appState.draggingObject === obj.id ? 10 : obj.z;
    el.style.opacity = obj.visible ? 1 : 0.5;
    el.style.transform = `rotate(${obj.angle || 0}deg)`;
    el.style.transformOrigin = 'center center';
    el.textContent = obj.name;

    if (appState.selectedObject?.id === obj.id) {
      el.style.border = '3px solid #007bff';
    }

    el.addEventListener('mousedown', (e) => handleObjectMouseDown(e, obj));
    el.addEventListener('dblclick', () => deleteObject(obj.id));
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
    const el = document.createElement('div');
    el.className = 'canvas-object preview';
    el.style.position = 'absolute';
    el.style.left = `${preview.x - preview.width / 2}px`;
    el.style.top = `${preview.y - preview.length / 2}px`;
    el.style.width = `${preview.width}px`;
    el.style.height = `${preview.length}px`;
    el.style.backgroundColor = preview.color;
    el.style.border = '2px dashed #333';
    el.style.borderRadius = '4px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.color = 'white';
    el.style.fontSize = '12px';
    el.style.fontWeight = 'bold';
    el.style.opacity = '0.7';
    el.style.pointerEvents = 'none';
    el.textContent = preview.name;
    canvas.appendChild(el);
  }
}

function handleObjectMouseDown(e, obj) {
  if (obj.locked) return;

  e.preventDefault();
  selectObject(obj);

  const canvas = document.getElementById('canvas');
  const rect = canvas.getBoundingClientRect();
  const offsetX = e.clientX - rect.left - obj.x;
  const offsetY = e.clientY - rect.top - obj.y;

  appState.draggingObject = obj.id;
  appState.dragOffset = { x: offsetX, y: offsetY };
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

  appState.canvasObjects = appState.canvasObjects.filter(o => o.id !== id);
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
  const fieldBearing = document.getElementById('field-bearing');
  const fieldVisible = document.getElementById('field-visible');
  const fieldLocked = document.getElementById('field-locked');
  const fieldComment = document.getElementById('field-comment');
  const previewBox = document.getElementById('preview-box');
  const btnDelete = document.getElementById('btn-delete');
  const btnVisibility = document.getElementById('btn-visibility');
  const btnLock = document.getElementById('btn-lock');

  if (!appState.selectedObject) {
    inspectorTitle.textContent = 'Select an object';
    fieldX.value = '';
    fieldY.value = '';
    fieldZ.value = '';
    fieldWidth.value = '';
    fieldHeight.value = '';
    fieldAngle.value = '';
    fieldBearing.checked = false;
    fieldVisible.checked = true;
    fieldLocked.checked = false;
    fieldComment.value = '';
    previewBox.style.backgroundColor = '#f8f9ff';
    fieldX.disabled = true;
    fieldY.disabled = true;
    fieldZ.disabled = true;
    fieldWidth.disabled = true;
    fieldHeight.disabled = true;
    fieldAngle.disabled = true;
    fieldBearing.disabled = true;
    fieldVisible.disabled = true;
    fieldLocked.disabled = true;
    fieldComment.disabled = true;

    btnDelete.disabled = true;
    btnVisibility.disabled = true;
    btnLock.disabled = true;
    return;
  }

  const obj = appState.selectedObject;

  inspectorTitle.textContent = obj.name;
  fieldX.value = Math.round(obj.x);
  fieldY.value = Math.round(obj.y);
  fieldZ.value = obj.z;
  fieldWidth.value = obj.width;
  fieldHeight.value = obj.height;
  fieldAngle.value = Math.round(obj.angle || 0);
  fieldBearing.checked = obj.bearing || false;
  fieldVisible.checked = obj.visible !== false;
  fieldLocked.checked = obj.locked || false;
  fieldComment.value = obj.comment || '';
  previewBox.style.backgroundColor = obj.color;
  
  fieldX.disabled = false;
  fieldY.disabled = false;
  fieldZ.disabled = obj.type === 'wall';
  fieldWidth.disabled = false;
  fieldHeight.disabled = false;
  fieldAngle.disabled = false;
  fieldBearing.disabled = obj.type !== 'wall';
  fieldVisible.disabled = false;
  fieldLocked.disabled = false;
  fieldComment.disabled = false;
  btnDelete.disabled = false;
  btnVisibility.disabled = false;
  btnLock.disabled = false;
}

function setupInspectorEventListeners() {
  const fieldX = document.getElementById('field-x');
  const fieldY = document.getElementById('field-y');
  const fieldZ = document.getElementById('field-z');
  const fieldWidth = document.getElementById('field-width');
  const fieldHeight = document.getElementById('field-height');
  const fieldAngle = document.getElementById('field-angle');
  const fieldBearing = document.getElementById('field-bearing');
  const fieldVisible = document.getElementById('field-visible');
  const fieldLocked = document.getElementById('field-locked');
  const fieldComment = document.getElementById('field-comment');
  const btnDelete = document.getElementById('btn-delete');
  const btnVisibility = document.getElementById('btn-visibility');
  const btnLock = document.getElementById('btn-lock');
  const projectNameInput = document.getElementById('projectName');

  const updateField = (field) => {
    return () => {
      if (!appState.selectedObject) return;
      const obj = appState.selectedObject;

      switch (field) {
        case 'x': obj.x = parseFloat(fieldX.value) || obj.x; break;
        case 'y': obj.y = parseFloat(fieldY.value) || obj.y; break;
        case 'z': obj.z = parseInt(fieldZ.value) || obj.z; break;
        case 'width': obj.width = parseFloat(fieldWidth.value) || obj.width; break;
        case 'height': obj.height = parseFloat(fieldHeight.value) || obj.height; break;
        case 'angle': obj.angle = parseInt(fieldAngle.value) || 0; break;
        case 'bearing': obj.bearing = fieldBearing.checked; break;
        case 'visible': obj.visible = fieldVisible.checked; break;
        case 'locked': obj.locked = fieldLocked.checked; break;
        case 'comment': obj.comment = fieldComment.value; break;
      }

      saveToLocalStorage();
      renderCanvas();
    };
  };

  [fieldX, fieldY, fieldZ, fieldWidth, fieldHeight, fieldAngle].forEach(field => {
    field.addEventListener('change', updateField(field.id.split('-')[1]));
  });

  fieldBearing.addEventListener('change', updateField('bearing'));
  fieldVisible.addEventListener('change', updateField('visible'));
  fieldLocked.addEventListener('change', updateField('locked'));
  fieldComment.addEventListener('change', updateField('comment'));

  btnDelete.addEventListener('click', () => {
    if (appState.selectedObject) {
      deleteObject(appState.selectedObject.id);
    }
  });

  btnVisibility.addEventListener('click', () => {
    if (appState.selectedObject) {
      appState.selectedObject.visible = !appState.selectedObject.visible;
      saveToLocalStorage();
      updateInspector();
      renderCanvas();
    }
  });

  btnLock.addEventListener('click', () => {
    if (appState.selectedObject) {
      appState.selectedObject.locked = !appState.selectedObject.locked;
      saveToLocalStorage();
      updateInspector();
      renderCanvas();
    }
  });

  projectNameInput.addEventListener('change', () => {
    appState.projectName = projectNameInput.value || 'Untitled Project';
    saveToLocalStorage();
  });
}

// =============== ZOOM ===============
function setupZoomEventListeners() {
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomLabel = document.getElementById('zoomLabel');

  zoomInBtn.addEventListener('click', () => {
    appState.zoom = Math.min(appState.zoom + 0.1, 3);
    zoomLabel.textContent = Math.round(appState.zoom * 100) + '%';
  });

  zoomOutBtn.addEventListener('click', () => {
    appState.zoom = Math.max(appState.zoom - 0.1, 0.5);
    zoomLabel.textContent = Math.round(appState.zoom * 100) + '%';
  });
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

function saveToLocalStorage() {
  localStorage.setItem('canvasObjects', JSON.stringify(appState.canvasObjects));
  localStorage.setItem('projectName', appState.projectName);
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem('canvasObjects');
  if (saved) appState.canvasObjects = JSON.parse(saved);
  
  const projectName = localStorage.getItem('projectName');
  if (projectName) {
    appState.projectName = projectName;
    document.getElementById('projectName').value = projectName;
  }
}

// =============== EVENT SETUP ===============
function setupEventListeners() {
  setupCanvasEventListeners();
  setupInspectorEventListeners();
  setupZoomEventListeners();
  setupAuthUI();
  setupCustomObjectUI();

  document.getElementById('saveBtn').addEventListener('click', saveProject);
  document.getElementById('moreBtn').addEventListener('click', () => {
    const choice = prompt('Enter action:\n1. Download project\n2. Load project');
    if (choice === '1') downloadProject();
    else if (choice === '2') {
      const id = prompt('Enter project ID:');
      if (id) loadProject(id);
    }
  });
}

// Start app
init();
if (authToken) {
  loadCustomObjects();
}