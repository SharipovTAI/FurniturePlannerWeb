/**
 * Rendering - Canvas rendering
 */

/**
 * Main canvas rendering function
 */
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
      if (room.polygon && room.polygon.length >= 3) {
        const inRoom = getFurnitureInRoom(room);
        const roomSpec = classifyRoomBySpecialFurniture(inRoom);
        const conflict = roomSpec.conflict;
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const pts = room.polygon
          .map(p => `${Math.round(p.x)},${Math.round(p.y)}`)
          .join(' ');
        poly.setAttribute('points', pts);
        poly.setAttribute('fill', conflict ? '#ffcdd2' : ROOM_COLORS[index % ROOM_COLORS.length]);
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
