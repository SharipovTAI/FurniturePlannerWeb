/**
 * Sidebar - Sidebar rendering and drag/drop functionality
 */

/**
 * Render the sidebar with all available items
 */
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

/**
 * Create a sidebar item element
 */
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

/**
 * Normalize object dimensions
 */
function normalizeObjectDimensions(item) {
  const width = Number(item.width) || 50;
  const height = Number(item.height) || 50;

  return {
    width,
    height,
  };
}

/**
 * Handle drag start from sidebar
 */
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

/**
 * Handle drag end from sidebar
 */
function handleSidebarDragEnd(e) {
  if (e.target._dragPreviewEl) {
    e.target._dragPreviewEl.remove();
    e.target._dragPreviewEl = null;
  }
}

/**
 * Start placing opening from sidebar
 */
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

/**
 * Update opening placement preview
 */
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

/**
 * Finalize opening placement
 */
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
