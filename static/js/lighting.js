/**
 * Lighting - Lighting analysis with obstacles
 */

/**
 * Check if there's a line of sight between two points
 */
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

/**
 * Analyze lighting with obstacles
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
  const width = LIGHTING_ANALYSIS_WIDTH;
  const height = LIGHTING_ANALYSIS_HEIGHT;
  const gridSize = LIGHTING_GRID_SIZE;
  const xOffset = 0;
  const yOffset = 0;

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

      // Окна
      for (const win of windows) {
        const dx = worldX - win.x;
        const dy = worldY - win.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= WINDOW_RADIUS) continue;

        // Игнорируем стену, в которой находится окно
        const ignoredWallId = win.wallId;
        
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

/**
 * Toggle lighting visualization
 */
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
