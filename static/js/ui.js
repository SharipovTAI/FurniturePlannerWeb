/**
 * UI - General UI utilities, room info panel, and helper functions
 */

/**
 * Normalize angle to 0-360 range
 */
function normalizeAngle(angle) {
  while (angle < 0) angle += 360;
  while (angle >= 360) angle -= 360;
  return angle;
}

/**
 * Snap angle to nearest multiple
 */
function snapAngle(angle, snap) {
  return Math.round(angle / snap) * snap;
}

/**
 * Clamp value between min and max
 */
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Convert world coordinates to wall-local coordinates
 */
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

/**
 * Convert wall-local coordinates to world coordinates
 */
function wallLocalToWorld(wall, localX, localY) {
  const rad = (wall.angle || 0) * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: wall.x + localX * cos - localY * sin,
    y: wall.y + localX * sin + localY * cos,
  };
}

/**
 * Find nearest wall projection from world point
 */
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

/**
 * Find wall hit at point
 */
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

/**
 * Create opening on wall
 */
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

/**
 * Update opening world pose based on wall
 */
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

/**
 * Check if text input is active
 */
function isTextInputActive() {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || active.isContentEditable;
}

/**
 * Move selected object by offset
 */
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

/**
 * Get keyboard movement delta
 */
function getKeyboardMoveDelta() {
  const STEP = KEYBOARD_STEP;
  let dx = 0;
  let dy = 0;

  if (appState.pressedMoveKeys.has('ArrowLeft')) dx -= STEP;
  if (appState.pressedMoveKeys.has('ArrowRight')) dx += STEP;
  if (appState.pressedMoveKeys.has('ArrowUp')) dy -= STEP;
  if (appState.pressedMoveKeys.has('ArrowDown')) dy += STEP;

  return { dx, dy };
}

/**
 * Apply keyboard movement tick
 */
function applyKeyboardMovementTick() {
  const { dx, dy } = getKeyboardMoveDelta();
  if (dx === 0 && dy === 0) return;
  moveSelectedObjectBy(dx, dy);
}

/**
 * Start keyboard movement interval
 */
function startKeyboardMovement() {
  if (appState.keyboardMoveIntervalId !== null) return;
  appState.keyboardMoveIntervalId = setInterval(() => {
    applyKeyboardMovementTick();
  }, KEYBOARD_MOVE_INTERVAL);
}

/**
 * Stop keyboard movement if idle
 */
function stopKeyboardMovementIfIdle() {
  if (appState.pressedMoveKeys.size > 0) return;
  if (appState.keyboardMoveIntervalId !== null) {
    clearInterval(appState.keyboardMoveIntervalId);
    appState.keyboardMoveIntervalId = null;
    saveToLocalStorage();
  }
}

/**
 * Get special room category key from subtype
 */
function getSpecialRoomCategoryKey(subtype) {
  const s = String(subtype || '').toLowerCase();
  if (s === 'bed') return 'bedroom';
  if (s === 'toilet' || s === 'bathtub') return 'bathroom';
  if (s === 'microwave' || s === 'stove') return 'kitchen';
  return null;
}

/**
 * Classify room by special furniture
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

/**
 * Get conflict resolution recommendations
 */
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

/**
 * Get furniture recommendations for room type
 */
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

/**
 * Update room info panel
 */
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
