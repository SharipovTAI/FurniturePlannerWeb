/**
 * Rooms - Room detection, analysis and classification
 */

/**
 * Detect rooms from walls
 */
function detectRooms() {
  const previousSelectedRoom = Number.isInteger(appState.selectedRoomIndex)
    ? appState.detectedRooms?.[appState.selectedRoomIndex]
    : null;
  const previousSignature = previousSelectedRoom ? getRoomSignature(previousSelectedRoom) : null;
  const rooms = [];
  const walls = appState.canvasObjects.filter(obj => obj.type === 'wall');
  
  if (walls.length === 0) return rooms;

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

/**
 * Get unique signature for room (for comparison)
 */
function getRoomSignature(room) {
  if (!room || !Array.isArray(room.walls)) return '';
  return room.walls.map(w => String(w.id)).sort().join('|');
}

/**
 * Sync selected room with previously selected (if same room still exists)
 */
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

/**
 * Calculate area of polygon
 */
function calculatePolygonArea(points) {
  // points: [{x,y}, ...] optionally closed (last==first)
  if (!points || points.length < 3) return 0;
  let area2 = 0;
  for (let i = 0; i < points.length - 1; i++) {
    area2 += points[i].x * points[i + 1].y - points[i + 1].x * points[i].y;
  }
  return Math.abs(area2) / 2;
}

/**
 * Get corners of an object (for collision detection)
 */
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

/**
 * Project polygon onto axis (SAT - Separating Axis Theorem)
 */
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

/**
 * Check if point is inside polygon (ray casting algorithm)
 */
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

/**
 * Get room at point
 */
function getRoomAtPoint(point) {
  for (const room of appState.detectedRooms) {
    if (isPointInPolygon(point, room.polygon)) {
      return room;
    }
  }
  return null;
}

/**
 * Get room index at point
 */
function getRoomIndexAtPoint(point) {
  for (let i = 0; i < appState.detectedRooms.length; i++) {
    if (isPointInPolygon(point, appState.detectedRooms[i].polygon)) {
      return i;
    }
  }
  return -1;
}

/**
 * Get furniture inside room
 */
function getFurnitureInRoom(room) {
  if (!room) return [];
  
  return appState.canvasObjects.filter(obj => {
    if (obj.type !== 'furniture') return false;
    
    // Check if object center is inside room polygon
    return isPointInPolygon({ x: obj.x, y: obj.y }, room.polygon);
  });
}

/**
 * Sort furniture by placement order (ID)
 */
function sortFurnitureByPlacementOrder(a, b) {
  return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
}

/**
 * Get occupied furniture area in room
 */
function getOccupiedFurnitureAreaInRoom(room) {
  return getFurnitureInRoom(room).reduce((sum, f) => sum + getFurnitureFootprintAreaCanvasUnits(f), 0);
}

/**
 * Get furniture footprint area
 */
function getFurnitureFootprintAreaCanvasUnits(obj) {
  const w = Number(obj.width) || 0;
  const h = Number(obj.height) || 0;
  return w * h;
}

/**
 * Convert canvas area to cm²
 */
function canvasAreaToCm2(areaCanvasUnits) {
  const k = CANVAS_CM_PER_UNIT;
  return (Number(areaCanvasUnits) || 0) * k * k;
}

/**
 * Check if two polygons overlap (SAT)
 */
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

/**
 * Point in polygon (more precise version with edge cases)
 */
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

/**
 * Get polygon without duplicate closure
 */
function getPolygonWithoutDuplicateClosure(polygon) {
  if (!polygon || polygon.length < 3) return [];
  const first = polygon[0];
  const last = polygon[polygon.length - 1];
  if (first.x === last.x && first.y === last.y) {
    return polygon.slice(0, -1);
  }
  return polygon;
}

/**
 * Check polygon orientation
 */
function orientation(a, b, c) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 1e-9) return 0;
  return value > 0 ? 1 : 2;
}

/**
 * Check if point is on segment
 */
function onSegment(a, b, c) {
  return b.x <= Math.max(a.x, c.x) + 1e-9
    && b.x + 1e-9 >= Math.min(a.x, c.x)
    && b.y <= Math.max(a.y, c.y) + 1e-9
    && b.y + 1e-9 >= Math.min(a.y, c.y);
}

/**
 * Check if line segments intersect
 */
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

/**
 * Check if polygon is simple (no self-intersections)
 */
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

/**
 * Check if overlap is allowed between objects
 */
function isOverlapAllowed(objA, objB) {
  if (objA.type === 'wall' && objB.type === 'wall') return true;
  if (objA.type === 'opening' && objB.type === 'wall') return true;
  if (objA.type === 'wall' && objB.type === 'opening') return true;
  return false;
}

/**
 * Check if furniture overlap is ignored
 */
function furnitureOverlapIgnoredPair(objA, objB) {
  if (objA.type !== 'furniture' || objB.type !== 'furniture') return false;
  return !!(objA.ignoreOverlap || objB.ignoreOverlap);
}

/**
 * Check if furniture is inside detected room
 */
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

/**
 * Check for invalid overlaps
 */
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

/**
 * Get object placement errors
 */
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
