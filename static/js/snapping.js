/**
 * Snapping - Magnetic snapping logic for furniture and walls
 */

/**
 * Get bounding box of object
 */
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

/**
 * Check furniture snapping
 */
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

/**
 * Check wall snapping to other wall endpoints
 */
function checkWallSnapping(draggedWall) {
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
