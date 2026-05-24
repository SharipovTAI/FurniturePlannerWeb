/**
 * Inspector - Object inspector panel management
 */

/**
 * Update inspector panel with selected object properties
 */
function updateInspector() {
  const inspectorTitle = document.getElementById('inspector-title');
  const fieldX = document.getElementById('field-x');
  const fieldY = document.getElementById('field-y');
  const fieldZ = document.getElementById('field-z');
  const fieldWidth = document.getElementById('field-width');
  const fieldHeight = document.getElementById('field-height');
  const fieldAngle = document.getElementById('field-angle');
  const fieldComment = document.getElementById('field-comment');
  const btnDelete = document.getElementById('btn-delete');
  const btnVisibility = document.getElementById('btn-visibility');
  const btnLock = document.getElementById('btn-lock');
  const btnBearing = document.getElementById('btn-bearing');
  const btnIgnoreOverlap = document.getElementById('btn-ignore-overlap');

  const setToggleOn = (btn, on) => {
    if (!btn) return;
    btn.classList.toggle('inspector-action--on', Boolean(on));
  };

  if (!appState.selectedObject) {
    if (inspectorTitle) inspectorTitle.textContent = 'Select an object';
    if (fieldX) {
      fieldX.value = '';
      fieldX.disabled = true;
    }
    if (fieldY) {
      fieldY.value = '';
      fieldY.disabled = true;
    }
    if (fieldZ) {
      fieldZ.value = '';
      fieldZ.disabled = true;
    }
    if (fieldWidth) {
      fieldWidth.value = '';
      fieldWidth.disabled = true;
    }
    if (fieldHeight) {
      fieldHeight.value = '';
      fieldHeight.disabled = true;
    }
    if (fieldAngle) {
      fieldAngle.value = '';
      fieldAngle.disabled = true;
    }
    if (fieldComment) {
      fieldComment.value = '';
      fieldComment.disabled = true;
    }

    setToggleOn(btnVisibility, false);
    setToggleOn(btnLock, false);
    setToggleOn(btnBearing, false);
    setToggleOn(btnIgnoreOverlap, false);
    if (btnDelete) btnDelete.disabled = true;
    if (btnVisibility) btnVisibility.disabled = true;
    if (btnLock) btnLock.disabled = true;
    if (btnBearing) btnBearing.disabled = true;
    if (btnIgnoreOverlap) btnIgnoreOverlap.disabled = true;
    return;
  }

  const obj = appState.selectedObject;

  if (inspectorTitle) inspectorTitle.textContent = obj.name;
  if (fieldX) fieldX.value = Math.round(obj.x);
  if (fieldY) fieldY.value = Math.round(obj.y);
  if (fieldZ) fieldZ.value = obj.z;
  if (fieldWidth) fieldWidth.value = obj.width;
  if (fieldHeight) fieldHeight.value = obj.height;
  if (fieldAngle) fieldAngle.value = Math.round(obj.angle || 0);
  if (fieldComment) fieldComment.value = obj.comment || '';

  setToggleOn(btnVisibility, obj.visible !== false);
  setToggleOn(btnLock, !!obj.locked);
  setToggleOn(btnBearing, !!obj.bearing);
  setToggleOn(btnIgnoreOverlap, !!obj.ignoreOverlap);

  if (fieldX) fieldX.disabled = false;
  if (fieldY) fieldY.disabled = false;
  if (fieldZ) fieldZ.disabled = obj.type === 'wall';
  if (fieldWidth) fieldWidth.disabled = false;
  if (fieldHeight) fieldHeight.disabled = false;
  if (fieldAngle) fieldAngle.disabled = false;
  if (fieldComment) fieldComment.disabled = false;

  if (btnBearing) btnBearing.disabled = obj.type !== 'wall';
  if (btnIgnoreOverlap) btnIgnoreOverlap.disabled = obj.type !== 'furniture';
  if (btnDelete) btnDelete.disabled = !!obj.locked;
  if (btnVisibility) btnVisibility.disabled = false;
  if (btnLock) btnLock.disabled = false;

  if (obj.type === 'opening') {
    if (fieldX) fieldX.disabled = true;
    if (fieldY) fieldY.disabled = true;
    if (fieldAngle) fieldAngle.disabled = true;
    if (fieldHeight) fieldHeight.disabled = true;
  }
}

/**
 * Setup inspector event listeners
 */
function setupInspectorEventListeners() {
  const fieldX = document.getElementById('field-x');
  const fieldY = document.getElementById('field-y');
  const fieldZ = document.getElementById('field-z');
  const fieldWidth = document.getElementById('field-width');
  const fieldHeight = document.getElementById('field-height');
  const fieldAngle = document.getElementById('field-angle');
  const fieldComment = document.getElementById('field-comment');
  const btnDelete = document.getElementById('btn-delete');
  const btnVisibility = document.getElementById('btn-visibility');
  const btnLock = document.getElementById('btn-lock');
  const btnBearing = document.getElementById('btn-bearing');
  const btnIgnoreOverlap = document.getElementById('btn-ignore-overlap');
  const projectNameInput = document.getElementById('projectName');

  const updateField = (field) => {
    return () => {
      if (!appState.selectedObject) return;
      const obj = appState.selectedObject;

      switch (field) {
        case 'x': obj.x = parseFloat(fieldX?.value) || obj.x; break;
        case 'y': obj.y = parseFloat(fieldY?.value) || obj.y; break;
        case 'z': obj.z = parseInt(fieldZ?.value) || obj.z; break;
        case 'width': obj.width = parseFloat(fieldWidth?.value) || obj.width; break;
        case 'height': obj.height = parseFloat(fieldHeight?.value) || obj.height; break;
        case 'angle': obj.angle = parseInt(fieldAngle?.value) || 0; break;
        case 'comment': obj.comment = fieldComment?.value; break;
      }

      saveToLocalStorage();
      renderCanvas();
    };
  };

  [fieldX, fieldY, fieldZ, fieldWidth, fieldHeight, fieldAngle].forEach(field => {
    if (!field) return;
    field.addEventListener('change', updateField(field.id.split('-')[1]));
  });

  if (fieldComment) fieldComment.addEventListener('change', updateField('comment'));

  if (btnDelete) {
    btnDelete.addEventListener('click', () => {
      if (appState.selectedObject) {
        deleteObject(appState.selectedObject.id);
      }
    });
  }

  if (btnVisibility) {
    btnVisibility.addEventListener('click', () => {
      if (appState.selectedObject) {
        appState.selectedObject.visible = !appState.selectedObject.visible;
        saveToLocalStorage();
        updateInspector();
        renderCanvas();
      }
    });
  }

  if (btnLock) {
    btnLock.addEventListener('click', () => {
      if (appState.selectedObject) {
        appState.selectedObject.locked = !appState.selectedObject.locked;
        saveToLocalStorage();
        updateInspector();
        renderCanvas();
      }
    });
  }

  if (btnBearing) {
    btnBearing.addEventListener('click', () => {
      if (!appState.selectedObject || appState.selectedObject.type !== 'wall') return;
      appState.selectedObject.bearing = !appState.selectedObject.bearing;
      saveToLocalStorage();
      updateInspector();
      renderCanvas();
    });
  }

  if (btnIgnoreOverlap) {
    btnIgnoreOverlap.addEventListener('click', () => {
      if (!appState.selectedObject || appState.selectedObject.type !== 'furniture') return;
      appState.selectedObject.ignoreOverlap = !appState.selectedObject.ignoreOverlap;
      saveToLocalStorage();
      updateInspector();
      renderCanvas();
    });
  }

  if (projectNameInput) {
    projectNameInput.addEventListener('change', () => {
      appState.projectName = projectNameInput.value || 'Untitled Project';
      saveToLocalStorage();
    });
  }
}
