// Furniture and wall data
const furnitureItems = [
  { type: 'furniture', subtype: 'table', name: 'Стол', width: 100, height: 60, color: '#8B4513' },
  { type: 'furniture', subtype: 'chair', name: 'Стул', width: 50, height: 50, color: '#654321' },
  { type: 'furniture', subtype: 'sofa', name: 'Диван', width: 150, height: 80, color: '#4169E1' },
  { type: 'furniture', subtype: 'cabinet', name: 'Шкаф', width: 80, height: 120, color: '#8B4513' },
  { type: 'furniture', subtype: 'bed', name: 'Кровать', width: 160, height: 100, color: '#FF6347' },
  { type: 'furniture', subtype: 'lamp', name: 'Лампа', width: 30, height: 60, color: '#FFD700' },
];

const wallItems = [
  { type: 'wall', subtype: 'standard', name: 'Стена', width: 240, height: 14, color: '#4f4f4f' },
];

// App state
let appState = {
  canvasObjects: [],
  selectedObject: null,
  zoom: 1,
  isDraggingCanvas: false,
  draggingObject: null,
  rotatingObject: null,
  rotationStart: null,
  dragOffset: { x: 0, y: 0 },
  previewObject: null,
};

// DOM Elements
const canvas = document.getElementById('canvas');
const furnitureGrid = document.getElementById('sidebar-furniture-grid');
const wallGrid = document.getElementById('sidebar-wall-grid');
const inspectorTitle = document.getElementById('inspector-title');
const previewBox = document.getElementById('preview-box');
const fieldX = document.getElementById('field-x');
const fieldY = document.getElementById('field-y');
const fieldZ = document.getElementById('field-z');
const fieldWidth = document.getElementById('field-width');
const fieldLength = document.getElementById('field-length');
const fieldHeight = document.getElementById('field-height');
const fieldAngle = document.getElementById('field-angle');
const fieldBearing = document.getElementById('field-bearing');
const saveBtn = document.getElementById('saveBtn');
const loginBtn = document.getElementById('loginBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomLabel = document.getElementById('zoomLabel');
const btnDelete = document.getElementById('btn-delete');
const btnVisibility = document.getElementById('btn-visibility');
const btnLock = document.getElementById('btn-lock');

// Initialize
function init() {
  renderSidebar();
  setupCanvasEventListeners();
  setupControlEventListeners();
  renderCanvas();
  loadFromLocalStorage();
}

// ============ SIDEBAR ============
function renderSidebar() {
  furnitureGrid.innerHTML = '';
  wallGrid.innerHTML = '';

  furnitureItems.forEach(item => furnitureGrid.appendChild(createSidebarItem(item)));
  wallItems.forEach(item => wallGrid.appendChild(createSidebarItem(item)));
}

function createSidebarItem(item) {
  const el = document.createElement('div');
  el.className = 'item';
  el.style.backgroundColor = item.color;
  el.draggable = true;
  el.textContent = item.name;

  el.addEventListener('dragstart', (e) => handleSidebarDragStart(e, item));
  return el;
}

function handleSidebarDragStart(e, item) {
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('application/json', JSON.stringify(item));

  const ghost = document.createElement('div');
  ghost.style.width = `${item.width}px`;
  ghost.style.height = `${item.height}px`;
  ghost.style.backgroundColor = item.color;
  ghost.style.border = '2px solid #333';
  ghost.style.borderRadius = '4px';
  ghost.style.display = 'flex';
  ghost.style.alignItems = 'center';
  ghost.style.justifyContent = 'center';
  ghost.style.color = 'white';
  ghost.style.fontSize = '12px';
  ghost.style.fontWeight = 'bold';
  ghost.style.position = 'absolute';
  ghost.style.top = '-1000px';
  ghost.textContent = item.name;
  document.body.appendChild(ghost);

  e.dataTransfer.setDragImage(ghost, item.width / 2, item.height / 2);
  setTimeout(() => document.body.removeChild(ghost), 0);
}

function createPlacedObject(item, x, y) {
  const base = {
    id: Date.now() + Math.random(),
    x,
    y,
    z: appState.canvasObjects.length,
    visible: true,
    angle: 0,
    name: item.name,
    color: item.color,
  };

  if (item.type === 'wall') {
    return {
      ...base,
      type: 'wall',
      subtype: item.subtype,
      width: item.width,
      height: item.height,
      bearing: false,
      locked: false,
    };
  }

  return {
    ...base,
    type: 'furniture',
    subtype: item.subtype,
    width: item.width,
    height: item.height,
    locked: false,
  };
}

// ============ CANVAS ============
function setupCanvasEventListeners() {
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
  canvas.classList.add('dragging-over');

  const data = e.dataTransfer.getData('application/json');
  if (data) {
    const item = JSON.parse(data);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    appState.previewObject = { ...item, x, y };
    renderCanvas();
  }
}

function handleCanvasDragLeave(e) {
  if (!canvas.contains(e.relatedTarget)) {
    canvas.classList.remove('dragging-over');
    appState.previewObject = null;
    renderCanvas();
  }
}

function handleCanvasDrop(e) {
  e.preventDefault();
  canvas.classList.remove('dragging-over');
  appState.previewObject = null;

  const data = e.dataTransfer.getData('application/json');
  if (data) {
    const item = JSON.parse(data);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newObject = createPlacedObject(item, x, y);
    appState.canvasObjects.push(newObject);
    saveToLocalStorage();
    renderCanvas();
  }
}

function handleCanvasMouseMove(e) {
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

function renderCanvas() {
  canvas.innerHTML = '';

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
      handle.title = 'Повернуть стену';
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
    el.style.top = `${preview.y - preview.height / 2}px`;
    el.style.width = `${preview.width}px`;
    el.style.height = `${preview.height}px`;
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

  const rect = canvas.getBoundingClientRect();
  const offsetX = e.clientX - rect.left - obj.x;
  const offsetY = e.clientY - rect.top - obj.y;

  appState.draggingObject = obj.id;
  appState.dragOffset = { x: offsetX, y: offsetY };
}

function handleRotateMouseDown(e, obj) {
  e.stopPropagation();
  if (obj.locked) return;

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

// ============ INSPECTOR ============
function updateInspector() {
  if (!appState.selectedObject) {
    inspectorTitle.textContent = 'Название объекта';
    fieldX.value = '';
    fieldY.value = '';
    fieldZ.value = '';
    fieldWidth.value = '';
    fieldLength.value = '';
    fieldHeight.value = '';
    fieldAngle.value = '';
    fieldBearing.checked = false;
    previewBox.style.backgroundColor = '#f8f9ff';
    fieldX.disabled = false;
    fieldY.disabled = false;
    fieldZ.disabled = false;
    fieldWidth.disabled = false;
    fieldLength.disabled = false;
    fieldHeight.disabled = false;
    fieldAngle.disabled = false;
    fieldBearing.disabled = false;
    btnDelete.disabled = false;
    btnVisibility.disabled = false;
    btnLock.disabled = false;
    return;
  }
  
  const obj = appState.selectedObject;
  const isBearing = obj.type === 'wall' && obj.bearing;

  inspectorTitle.textContent = obj.name + (isBearing ? ' (несущая)' : '');
  fieldX.value = Math.round(obj.x);
  fieldY.value = Math.round(obj.y);
  fieldZ.value = obj.z;
  fieldWidth.value = obj.width;
  fieldLength.value = obj.height;
  fieldHeight.value = 100;
  fieldAngle.value = obj.angle || 0;
  fieldBearing.checked = obj.type === 'wall' ? !!obj.bearing : false;
  previewBox.style.backgroundColor = obj.color;

  const editable = !(obj.type === 'wall' && obj.bearing);
  fieldX.disabled = !editable;
  fieldY.disabled = !editable;
  fieldZ.disabled = !editable;
  fieldWidth.disabled = !editable;
  fieldLength.disabled = !editable;
  fieldHeight.disabled = !editable;
  fieldAngle.disabled = !editable;
  btnDelete.disabled = !editable;
  btnVisibility.disabled = !editable;
  btnLock.disabled = !editable;
}

// Setup inspector input listeners
[fieldX, fieldY, fieldZ, fieldWidth, fieldLength, fieldHeight].forEach(field => {
  field.addEventListener('change', () => {
    if (!appState.selectedObject) return;
    
    appState.selectedObject.x = parseFloat(fieldX.value) || appState.selectedObject.x;
    appState.selectedObject.y = parseFloat(fieldY.value) || appState.selectedObject.y;
    appState.selectedObject.z = parseFloat(fieldZ.value) || appState.selectedObject.z;
    appState.selectedObject.width = parseFloat(fieldWidth.value) || appState.selectedObject.width;
    appState.selectedObject.height = parseFloat(fieldLength.value) || appState.selectedObject.height;
    
    saveToLocalStorage();
    renderCanvas();
  });
});

fieldAngle.addEventListener('change', () => {
  if (!appState.selectedObject) return;
  if (appState.selectedObject.type === 'wall' && appState.selectedObject.bearing) return;
  const angle = parseFloat(fieldAngle.value);
  if (!isNaN(angle)) {
    appState.selectedObject.angle = normalizeAngle(angle);
    saveToLocalStorage();
    renderCanvas();
  }
});

fieldBearing.addEventListener('change', () => {
  if (!appState.selectedObject || appState.selectedObject.type !== 'wall') return;
  appState.selectedObject.bearing = fieldBearing.checked;
  appState.selectedObject.locked = fieldBearing.checked;
  saveToLocalStorage();
  updateInspector();
  renderCanvas();
});

function normalizeAngle(angle) {
  let result = angle % 360;
  if (result < 0) result += 360;
  return result;
}

function snapAngle(angle, step) {
  return Math.round(angle / step) * step;
}

// ============ CONTROLS ============
function setupControlEventListeners() {
  saveBtn.addEventListener('click', saveProject);
  loginBtn.addEventListener('click', () => alert('Кнопка входа'));
  
  zoomInBtn.addEventListener('click', () => changeZoom(1.2));
  zoomOutBtn.addEventListener('click', () => changeZoom(0.8));
  
  btnDelete.addEventListener('click', () => {
    if (appState.selectedObject) {
      deleteObject(appState.selectedObject.id);
    }
  });
  
  btnVisibility.addEventListener('click', () => {
    if (appState.selectedObject) {
      appState.selectedObject.visible = !appState.selectedObject.visible;
      saveToLocalStorage();
      renderCanvas();
    }
  });
  
  btnLock.addEventListener('click', () => {
    if (appState.selectedObject) {
      appState.selectedObject.locked = !appState.selectedObject.locked;
      saveToLocalStorage();
      renderCanvas();
    }
  });
}

function changeZoom(factor) {
  appState.zoom *= factor;
  appState.zoom = Math.max(0.5, Math.min(appState.zoom, 3));
  zoomLabel.textContent = Math.round(appState.zoom * 100) + '%';
  
  canvas.style.transform = `scale(${appState.zoom})`;
  canvas.style.transformOrigin = 'top left';
}

function saveProject() {
  const data = {
    objects: appState.canvasObjects,
    timestamp: new Date().toISOString(),
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `furniture-plan-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============ STORAGE ============
function saveToLocalStorage() {
  localStorage.setItem('furniture-plan', JSON.stringify(appState.canvasObjects));
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem('furniture-plan');
  if (saved) {
    try {
      appState.canvasObjects = JSON.parse(saved);
      renderCanvas();
    } catch (e) {
      console.error('Error loading saved data:', e);
    }
  }
}

// Start application
init();
