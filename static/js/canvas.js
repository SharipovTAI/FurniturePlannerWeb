/**
 * Canvas - Canvas event handling and rendering
 */

/**
 * Setup canvas event listeners
 */
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

/**
 * Get canvas pointer position relative to canvas
 */
function getCanvasPointerPosition(e) {
  const canvas = document.getElementById('canvas');
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

/**
 * Handle canvas click
 */
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

/**
 * Handle measurement tool click
 */
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

/**
 * Handle canvas drag over
 */
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
      const wasAttached = Boolean(appState.previewObject?._previewAttachedToWall);
      const shouldAttach = best && (best.distToCenterline <= (wasAttached ? DETACH_DISTANCE : ATTACH_DISTANCE));

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

/**
 * Handle canvas drag leave
 */
function handleCanvasDragLeave(e) {
  const canvas = document.getElementById('canvas');
  if (!canvas.contains(e.relatedTarget)) {
    canvas.classList.remove('dragging-over');
    appState.previewObject = null;
    renderCanvas();
  }
}

/**
 * Handle canvas drop
 */
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

/**
 * Handle canvas mouse move (dragging and rotating)
 */
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

/**
 * Handle canvas mouse up
 */
function handleCanvasMouseUp() {
  if (appState.draggingObject || appState.rotatingObject) {
    saveToLocalStorage();
  }
  appState.draggingObject = null;
  appState.rotatingObject = null;
  appState.rotationStart = null;
  appState.dragOffset = { x: 0, y: 0 };
}

/**
 * Handle object mouse down (start dragging)
 */
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

/**
 * Handle rotate button mouse down
 */
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

/**
 * Select object
 */
function selectObject(obj) {
  appState.selectedObject = obj;
  updateInspector();
  renderCanvas();
}

/**
 * Delete object
 */
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

/**
 * Create a standard room
 */
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
