/**
 * Custom Objects - Custom furniture management
 */

/**
 * Set up custom object upload UI
 */
async function setupCustomObjectUI() {
  if (isCustomObjectUIInitialized) return;
  isCustomObjectUIInitialized = true;

  const uploadBtn = document.getElementById('uploadCustomBtn');
  const uploadModal = document.getElementById('uploadModal');
  const closeBtn = uploadModal.querySelector('.close');
  const uploadForm = document.getElementById('uploadForm');

  uploadBtn.addEventListener('click', () => {
    uploadModal.classList.remove('hidden');
  });

  closeBtn.addEventListener('click', () => {
    uploadModal.classList.add('hidden');
  });

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!authToken) {
      alert('Please login to upload custom objects');
      return;
    }

    const name = document.getElementById('uploadName').value;
    const desc = document.getElementById('uploadDesc').value;
    const width = parseFloat(document.getElementById('uploadWidth').value);
    const height = parseFloat(document.getElementById('uploadHeight').value);
    const color = document.getElementById('uploadColor').value;
    const file = document.getElementById('uploadFile').files[0];

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', desc);
      formData.append('width', width);
      formData.append('height', height);
      formData.append('color', color);
      if (file) formData.append('file_path', file);

      const response = await fetch(`${API_URL}/custom-furniture/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${authToken}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload custom object');

      const customObj = await response.json();
      appState.customObjects.push(customObj);
      renderSidebar();

      uploadForm.reset();
      document.getElementById('uploadMessage').textContent = 'Custom object added!';
      document.getElementById('uploadMessage').className = 'success';
      setTimeout(() => {
        uploadModal.classList.add('hidden');
        document.getElementById('uploadMessage').textContent = '';
      }, 2000);
    } catch (error) {
      const msg = document.getElementById('uploadMessage');
      msg.textContent = 'Error: ' + error.message;
      msg.className = 'error';
    }
  });
}

/**
 * Delete custom furniture object
 */
async function deleteCustomFurniture(id) {
  if (!authToken) {
    alert('Войдите в аккаунт, чтобы удалять объекты');
    return;
  }
  if (!confirm('Удалить этот объект из списка? Он будет удалён с сервера; экземпляры на плане тоже исчезнут.')) {
    return;
  }
  try {
    const response = await fetch(`${API_URL}/custom-furniture/${id}/`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Token ${authToken}`,
      },
    });
    if (!response.ok) throw new Error('Не удалось удалить объект');
    appState.customObjects = appState.customObjects.filter(o => o.id !== id);
    const selId = appState.selectedObject?.id;
    appState.canvasObjects = appState.canvasObjects.filter(o => o.customId !== id);
    if (selId != null && !appState.canvasObjects.some(o => o.id === selId)) {
      appState.selectedObject = null;
    }
    renderSidebar();
    renderCanvas();
    updateInspector();
    markWorkspaceDirty();
  } catch (err) {
    alert(err.message || 'Ошибка удаления');
  }
}

/**
 * Load custom objects from server
 */
async function loadCustomObjects() {
  if (!authToken) return;

  try {
    const response = await fetch(`${API_URL}/custom-furniture/`, {
      headers: {
        'Authorization': `Token ${authToken}`,
      },
    });

    if (response.ok) {
      appState.customObjects = await response.json();
    }
  } catch (error) {
    console.error('Error loading custom objects:', error);
  }
}

/**
 * Resolve custom image URL from server path
 */
function resolveCustomImageUrl(filePath) {
  if (filePath == null || filePath === '') return null;
  const s = String(filePath).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return s;
  return '/' + s.replace(/^\/+/, '');
}

/**
 * Check if image URL is renderable
 */
function isRenderableCustomImageUrl(url) {
  if (url == null || url === '') return false;
  const s = String(url).trim().split('?')[0].toLowerCase();
  if (s.startsWith('data:image/')) return true;
  return /\.(png|jpe?g|webp|gif|svg)$/.test(s);
}
