/**
 * Authentication - User authentication and login/register flows
 */

/**
 * Set up authentication UI
 */
function setupAuthUI() {
  if (isAuthUIInitialized) return;
  isAuthUIInitialized = true;

  const loginBtn = document.getElementById('loginBtn');
  const loginModal = document.getElementById('loginModal');
  const closeBtn = loginModal.querySelector('.close');
  const authForm = document.getElementById('authForm');
  const authToggleBtn = document.getElementById('authToggleBtn');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const authEmailInput = document.getElementById('authEmail');

  loginBtn.addEventListener('click', () => {
    if (authToken && currentUser) return;
    authMode = 'login';
    loginModal.classList.remove('hidden');
  });

  const userNameMenuBtn = document.getElementById('userNameMenuBtn');
  const userMenuDropdown = document.getElementById('userMenuDropdown');
  const logoutBtn = document.getElementById('logoutBtn');

  function closeUserMenu() {
    if (userMenuDropdown) userMenuDropdown.classList.add('hidden');
    if (userNameMenuBtn) userNameMenuBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleUserMenu(e) {
    if (e) e.stopPropagation();
    if (!userMenuDropdown || !userNameMenuBtn) return;
    const isClosed = userMenuDropdown.classList.contains('hidden');
    userMenuDropdown.classList.toggle('hidden', !isClosed);
    userNameMenuBtn.setAttribute('aria-expanded', isClosed ? 'true' : 'false');
  }

  if (userNameMenuBtn) {
    userNameMenuBtn.addEventListener('click', toggleUserMenu);
  }
  if (userMenuDropdown) {
    userMenuDropdown.addEventListener('click', (e) => e.stopPropagation());
  }
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeUserMenu();
      logout();
    });
  }
  document.addEventListener('click', () => closeUserMenu());

  closeBtn.addEventListener('click', () => {
    loginModal.classList.add('hidden');
  });

  authToggleBtn.addEventListener('click', () => {
    authMode = authMode === 'login' ? 'register' : 'login';
    authEmailInput.style.display = authMode === 'register' ? 'block' : 'none';
    authSubmitBtn.textContent = authMode === 'login' ? 'Login' : 'Register';
    authToggleBtn.textContent = authMode === 'login' ? 'Register instead' : 'Login instead';
  });

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('authUsername').value;
    const password = document.getElementById('authPassword').value;
    const email = document.getElementById('authEmail').value;

    try {
      let prev = null;
      try {
        const prevRaw = localStorage.getItem('currentUser');
        prev = prevRaw ? JSON.parse(prevRaw) : null;
      } catch (_) {
        prev = null;
      }

      const endpoint = authMode === 'login' ? 'auth/login/' : 'auth/register/';
      const data = authMode === 'login' 
        ? { username, password }
        : { username, password, email };

      const response = await fetch(`${API_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorMessage = 'Authentication failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.detail || errorMessage;
        } catch (_) {
          // Keep default message when backend does not provide JSON.
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const newUserId = result.user_id;
      const isDifferentUser = prev != null && String(prev.id) !== String(newUserId);

      authToken = result.token;
      currentUser = { id: result.user_id, username: result.username, email: result.email };
      
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('currentUser', JSON.stringify(currentUser));

      if (isDifferentUser) {
        resetLayoutForNewAccount();
      }

      updateAuthUI();
      loginModal.classList.add('hidden');
      document.getElementById('authMessage').textContent = '';
      authForm.reset();

      await loadCustomObjects();
      await loadUserProjects();
    } catch (error) {
      const msg = document.getElementById('authMessage');
      msg.textContent = error.message;
      msg.className = 'error';
    }
  });
}

/**
 * Update UI based on authentication state
 */
function updateAuthUI() {
  const loginBtn = document.getElementById('loginBtn');
  const headerAuthLogged = document.getElementById('headerAuthLogged');
  const userNameMenuBtn = document.getElementById('userNameMenuBtn');
  const userMenuDropdown = document.getElementById('userMenuDropdown');

  if (authToken && currentUser) {
    if (loginBtn) loginBtn.classList.add('hidden');
    if (headerAuthLogged) headerAuthLogged.classList.remove('hidden');
    if (userNameMenuBtn) userNameMenuBtn.textContent = currentUser.username;
    if (userMenuDropdown) userMenuDropdown.classList.add('hidden');
    if (userNameMenuBtn) userNameMenuBtn.setAttribute('aria-expanded', 'false');
  } else {
    if (loginBtn) {
      loginBtn.classList.remove('hidden');
      loginBtn.textContent = 'Login';
    }
    if (headerAuthLogged) headerAuthLogged.classList.add('hidden');
    if (userMenuDropdown) userMenuDropdown.classList.add('hidden');
  }
}

/**
 * Logout the current user
 */
function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');

  appState.customObjects = [];
  appState.userProjects = [];
  appState.currentProjectIndex = -1;

  resetWorkspaceState();
  renderSidebar();
  updateAuthUI();
}
