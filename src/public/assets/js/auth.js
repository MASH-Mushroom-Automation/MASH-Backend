/**
 * Authentication Utilities
 * Handles token storage, validation, and session management
 */

const AUTH_STORAGE_KEY = 'mash_auth_token';
const REFRESH_STORAGE_KEY = 'mash_refresh_token';
const USER_STORAGE_KEY = 'mash_user';

/**
 * Save tokens to localStorage
 */
function saveTokens(accessToken, refreshToken) {
  localStorage.setItem(AUTH_STORAGE_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_STORAGE_KEY, refreshToken);
  }
  apiClient.setToken(accessToken);
}

/**
 * Get access token from localStorage
 */
function getToken() {
  return localStorage.getItem(AUTH_STORAGE_KEY);
}

/**
 * Get refresh token from localStorage
 */
function getRefreshToken() {
  return localStorage.getItem(REFRESH_STORAGE_KEY);
}

/**
 * Clear all tokens from localStorage
 */
function clearTokens() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(REFRESH_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  apiClient.clearToken();
}

/**
 * Save user data to localStorage
 */
function saveUser(user) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

/**
 * Get user data from localStorage
 */
function getUser() {
  const userData = localStorage.getItem(USER_STORAGE_KEY);
  return userData ? JSON.parse(userData) : null;
}

/**
 * Decode JWT token (without verification)
 */
function decodeJWT(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}

/**
 * Check if token is expired
 */
function isTokenExpired(token) {
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) {
    return true;
  }

  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp < currentTime;
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  const token = getToken();
  if (!token) {
    return false;
  }

  if (isTokenExpired(token)) {
    clearTokens();
    return false;
  }

  // Set token in API client
  apiClient.setToken(token);
  return true;
}

/**
 * Refresh access token
 */
async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await apiClient.post('/auth/refresh-token', {
      refreshToken,
    });

    saveTokens(response.accessToken, response.refreshToken);
    return response.accessToken;
  } catch (error) {
    clearTokens();
    throw error;
  }
}

/**
 * Logout user
 */
function logout() {
  clearTokens();
  redirectToLogin();
}

/**
 * Redirect to login page
 */
function redirectToLogin() {
  window.location.href = '/';
}

/**
 * Redirect to dashboard
 */
function redirectToDashboard() {
  window.location.href = '/dashboard';
}

/**
 * Get current user info from API
 */
async function fetchCurrentUser() {
  try {
    const user = await apiClient.get('/auth/me');
    saveUser(user);
    return user;
  } catch (error) {
    console.error('Failed to fetch current user:', error);
    throw error;
  }
}

/**
 * Show error message
 */
function showError(elementId, message) {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
      errorElement.style.display = 'none';
    }, 5000);
  }
}

/**
 * Show success message
 */
function showSuccess(elementId, message) {
  const successElement = document.getElementById(elementId);
  if (successElement) {
    successElement.textContent = message;
    successElement.style.display = 'block';

    // Auto-hide after 3 seconds
    setTimeout(() => {
      successElement.style.display = 'none';
    }, 3000);
  }
}

/**
 * Show loading state
 */
function showLoading(buttonId) {
  const button = document.getElementById(buttonId);
  if (button) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.innerHTML = '<span class="spinner"></span> Loading...';
  }
}

/**
 * Hide loading state
 */
function hideLoading(buttonId) {
  const button = document.getElementById(buttonId);
  if (button) {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
  }
}

/**
 * Validate email format
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Calculate password strength
 */
function calculatePasswordStrength(password) {
  let strength = 0;
  let feedback = [];

  if (password.length >= 8) strength += 20;
  else feedback.push('At least 8 characters');

  if (password.length >= 12) strength += 10;

  if (/[a-z]/.test(password)) strength += 20;
  else feedback.push('Lowercase letter');

  if (/[A-Z]/.test(password)) strength += 20;
  else feedback.push('Uppercase letter');

  if (/[0-9]/.test(password)) strength += 20;
  else feedback.push('Number');

  if (/[^a-zA-Z0-9]/.test(password)) strength += 10;
  else feedback.push('Special character');

  let level = 'weak';
  let color = '#ef4444';

  if (strength >= 70) {
    level = 'strong';
    color = '#10b981';
  } else if (strength >= 40) {
    level = 'medium';
    color = '#f59e0b';
  }

  return {
    strength,
    level,
    color,
    feedback,
  };
}

/**
 * Update password strength meter
 */
function updatePasswordStrength(password, meterId, feedbackId) {
  const meter = document.getElementById(meterId);
  const feedback = document.getElementById(feedbackId);

  if (!password) {
    if (meter) meter.style.display = 'none';
    if (feedback) feedback.style.display = 'none';
    return;
  }

  const result = calculatePasswordStrength(password);

  if (meter) {
    meter.style.display = 'block';
    const fill = meter.querySelector('.strength-fill');
    if (fill) {
      fill.style.width = `${result.strength}%`;
      fill.style.backgroundColor = result.color;
    }
    const text = meter.querySelector('.strength-text');
    if (text) {
      text.textContent = result.level.toUpperCase();
      text.style.color = result.color;
    }
  }

  if (feedback && result.feedback.length > 0) {
    feedback.style.display = 'block';
    feedback.textContent = 'Missing: ' + result.feedback.join(', ');
  } else if (feedback) {
    feedback.style.display = 'none';
  }
}

/**
 * Protect route - require authentication
 */
function protectRoute() {
  if (!isAuthenticated()) {
    redirectToLogin();
  }
}

/**
 * Initialize authentication on page load
 */
function initAuth() {
  const token = getToken();
  if (token && !isTokenExpired(token)) {
    apiClient.setToken(token);
  }
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}
