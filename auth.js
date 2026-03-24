// Authentication module for MathQuest
const AuthModule = {
  token: null,
  user: null,

  init() {
    // Load token from localStorage
    const savedToken = localStorage.getItem('mathquest-auth-token');
    const savedUser = localStorage.getItem('mathquest-user');

    if (savedToken && savedUser) {
      this.token = savedToken;
      this.user = JSON.parse(savedUser);
    }

    this.bindEvents();
    this.checkAuth();

    // Check for Google OAuth callback
    this.handleGoogleCallback();

    // Set initial tab state - show login form by default
    this.switchTab('login');
  },

  handleGoogleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const isGoogleAuth = urlParams.get('google_auth');
    const token = urlParams.get('token');
    const userParam = urlParams.get('user');

    if (isGoogleAuth && token && userParam) {
      try {
        this.token = token;
        this.user = JSON.parse(decodeURIComponent(userParam));
        this.showApp();

        // Clean up URL
        window.history.replaceState({}, document.title, '/');
      } catch (error) {
        console.error('Failed to parse Google auth data:', error);
      }
    }
  },

  bindEvents() {
    // Tab switching
    const loginTabs = document.querySelectorAll('.login-tab');
    loginTabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // Signup form
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
      signupForm.addEventListener('submit', (e) => this.handleSignup(e));
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout());
    }
  },

  switchTab(tab) {
    const tabs = document.querySelectorAll('.login-tab');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    // Update tab active states
    tabs.forEach(t => {
      if (t.dataset.tab === tab) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });

    // Show/hide forms based on selected tab
    if (tab === 'login') {
      loginForm.classList.remove('hidden');
      signupForm.classList.add('hidden');
    } else {
      loginForm.classList.add('hidden');
      signupForm.classList.remove('hidden');
    }

    // Clear errors
    document.querySelectorAll('.form-error').forEach(el => {
      el.classList.add('hidden');
      el.textContent = '';
    });
  },

  async checkAuth() {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');

    if (!this.token) {
      // Show login screen
      if (loginScreen) loginScreen.classList.remove('hidden');
      if (mainApp) mainApp.classList.add('hidden');
      return;
    }

    // Verify token with server
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.user = data.user;
        this.showApp();
      } else {
        this.logout(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      this.logout(false);
    }
  },

  showApp() {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    const userNameDisplay = document.getElementById('userNameDisplay');

    if (loginScreen) loginScreen.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');

    if (userNameDisplay && this.user) {
      userNameDisplay.textContent = this.user.name;
    }

    // Store auth info
    localStorage.setItem('mathquest-auth-token', this.token);
    localStorage.setItem('mathquest-user', JSON.stringify(this.user));
  },

  async handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    errorEl.classList.add('hidden');
    errorEl.textContent = '';
    submitBtn.disabled = true;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        this.token = data.token;
        this.user = data.user;
        this.showApp();
        // Initialize the main app now that user is logged in
        if (typeof init === 'function') {
          init();
        }
      } else {
        errorEl.textContent = data.error || 'Login failed';
        errorEl.classList.remove('hidden');
      }
    } catch (error) {
      errorEl.textContent = 'Network error. Please try again.';
      errorEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
    }
  },

  async handleSignup(e) {
    e.preventDefault();

    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const errorEl = document.getElementById('signupError');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    errorEl.classList.add('hidden');
    errorEl.textContent = '';
    submitBtn.disabled = true;

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        this.token = data.token;
        this.user = data.user;
        this.showApp();
        // Initialize the main app now that user is logged in
        if (typeof init === 'function') {
          init();
        }
      } else {
        errorEl.textContent = data.error || 'Signup failed';
        errorEl.classList.remove('hidden');
      }
    } catch (error) {
      errorEl.textContent = 'Network error. Please try again.';
      errorEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
    }
  },

  logout(clearStorage = true) {
    this.token = null;
    this.user = null;

    if (clearStorage) {
      localStorage.removeItem('mathquest-auth-token');
      localStorage.removeItem('mathquest-user');
    }

    // Reload page to show login screen
    window.location.reload();
  },

  getToken() {
    return this.token;
  },

  getUser() {
    return this.user;
  },
};

// Initialize auth module when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  AuthModule.init();
});
