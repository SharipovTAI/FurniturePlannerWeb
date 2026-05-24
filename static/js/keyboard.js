/**
 * Keyboard - Keyboard event handling and shortcuts
 */

/**
 * Setup keyboard event listeners
 */
function setupKeyboardEventListeners() {
  document.addEventListener('keydown', (e) => {
    if (isTextInputActive()) return;

    if (e.key === 'Delete') {
      if (appState.selectedObject) {
        e.preventDefault();
        deleteObject(appState.selectedObject.id);
      }
      return;
    }

    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    appState.pressedMoveKeys.add(e.key);
    applyKeyboardMovementTick();
    startKeyboardMovement();
  });

  document.addEventListener('keyup', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    appState.pressedMoveKeys.delete(e.key);
    stopKeyboardMovementIfIdle();
  });

  window.addEventListener('blur', () => {
    appState.pressedMoveKeys.clear();
    stopKeyboardMovementIfIdle();
  });
}
