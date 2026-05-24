/**
 * Projects - Project management (save, load, download, switch)
 */

/**
 * Get list of user projects from server
 */
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

/**
 * Load list of user projects and update app state
 */
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

/**
 * Save project to server
 */
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

/**
 * Save project (public wrapper)
 */
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

/**
 * Download project as JSON file
 */
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

/**
 * Restore opening from saved item
 */
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

/**
 * Load project by ID
 */
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

/**
 * Switch to a project by index
 */
async function switchToProject(index) {
  if (index < 0 || index >= appState.userProjects.length) return;
  
  const project = appState.userProjects[index];
  if (String(project.id) === String(currentProjectId)) return;

  if (!(await confirmUnsavedBeforeLeave(`перед открытием проекта «${project.name}»`))) return;

  const ok = await loadProject(project.id);
  if (ok) appState.currentProjectIndex = index;
}

/**
 * Show project list and allow selection
 */
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

/**
 * Switch to previous project
 */
async function previousProject() {
  if (appState.userProjects.length === 0) return;
  const newIndex = appState.currentProjectIndex > 0 ? appState.currentProjectIndex - 1 : appState.userProjects.length - 1;
  await switchToProject(newIndex);
}

/**
 * Switch to next project
 */
async function nextProject() {
  if (appState.userProjects.length === 0) return;
  const newIndex = appState.currentProjectIndex < appState.userProjects.length - 1 ? appState.currentProjectIndex + 1 : 0;
  await switchToProject(newIndex);
}
