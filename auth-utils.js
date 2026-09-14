/**
 * Authentication Utility Module
 * Handles user authentication, session management, and API calls
 * 
 * This integrates with your Supabase backend for production use
 */

class AuthManager {
  constructor(apiBaseUrl = '/api') {
    this.apiBaseUrl = apiBaseUrl;
    this.currentUser = null;
    this.token = null;
    this.isInitialized = false;
  }

  /**
   * Initialize authentication - check for existing session
   */
  async initialize() {
    try {
      // Check sessionStorage for current user
      const storedUser = sessionStorage.getItem('currentUser');
      const storedToken = sessionStorage.getItem('authToken');

      if (storedUser && storedToken) {
        this.currentUser = JSON.parse(storedUser);
        this.token = storedToken;
        this.isInitialized = true;
        return this.currentUser;
      }

      // Check if remember me is enabled
      const remembered = localStorage.getItem('rememberedUser');
      if (remembered) {
        this.isInitialized = true;
        return JSON.parse(remembered);
      }

      this.isInitialized = true;
      return null;
    } catch (error) {
      console.error('Auth initialization failed:', error);
      this.isInitialized = true;
      return null;
    }
  }

  /**
   * Register a new user
   */
  async register(userData) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/patient/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patient_name: userData.patient_name,
          caretaker_name: userData.caretaker_name,
          caretaker_mobile: userData.caretaker_mobile,
          password: userData.password,
          language: userData.language,
          voice_helper: userData.voice_helper
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Registration failed');
      }

      const data = await response.json();
      
      // Store user data and token
      this.currentUser = data.user;
      this.token = data.token;
      sessionStorage.setItem('currentUser', JSON.stringify(data.user));
      sessionStorage.setItem('authToken', data.token);

      return {
        success: true,
        user: data.user,
        token: data.token
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(caretakerName, password) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/patient/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          caretaker_name: caretakerName,
          password: password
        })
      });

      let errorData = null;
      const contentType = response.headers.get('content-type');
      
      if (!response.ok) {
        try {
          if (contentType && contentType.includes('application/json')) {
            errorData = await response.json();
          } else {
            const text = await response.text();
            errorData = { message: text || `HTTP ${response.status}` };
          }
        } catch (e) {
          errorData = { message: `Login failed with status ${response.status}` };
        }
        throw new Error(errorData?.message || 'Login failed');
      }

      let data;
      try {
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          throw new Error('Invalid response format: expected JSON');
        }
      } catch (e) {
        console.error('JSON parse error:', e);
        throw new Error('Server returned invalid response');
      }

      // Store user data and token
      this.currentUser = data.user;
      this.token = data.token;
      sessionStorage.setItem('currentUser', JSON.stringify(data.user));
      sessionStorage.setItem('authToken', data.token);

      return {
        success: true,
        user: data.user,
        token: data.token
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }
  /**
   * Logout user
   */
  async logout() {
    try {
      // Optional: Notify backend of logout
      if (this.token) {
        await fetch(`${this.apiBaseUrl}/patient/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          }
        });
      }

      // Clear local storage
      this.currentUser = null;
      this.token = null;
      sessionStorage.removeItem('currentUser');
      sessionStorage.removeItem('authToken');
      localStorage.removeItem('rememberedUser');

      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      // Clear anyway
      this.currentUser = null;
      this.token = null;
      sessionStorage.removeItem('currentUser');
      sessionStorage.removeItem('authToken');
      throw error;
    }
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.currentUser && !!this.token;
  }

  /**
   * Make authenticated API call
   */
  async apiCall(endpoint, method = 'GET', body = null) {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.apiBaseUrl}${endpoint}`, options);

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid
        await this.logout();
        window.location.href = '/index.html';
        return;
      }
      throw new Error(`API call failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Save game score
   */
  async saveGameScore(gameType, score, difficulty, duration) {
    try {
      const data = await this.apiCall('/scores/save', 'POST', {
        game_type: gameType,
        score: score,
        difficulty: difficulty,
        duration_seconds: duration
      });

      return data;
    } catch (error) {
      console.error('Failed to save score:', error);
      throw error;
    }
  }

  /**
   * Get game history
   */
  async getGameHistory() {
    try {
      const data = await this.apiCall('/scores/history', 'GET');
      return data;
    } catch (error) {
      console.error('Failed to fetch game history:', error);
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(preferences) {
    try {
      const data = await this.apiCall('/patient/preferences', 'PUT', preferences);
      return data;
    } catch (error) {
      console.error('Failed to update preferences:', error);
      throw error;
    }
  }
}

// Create global instance
window.authManager = new AuthManager();

/**
 * Middleware - Protect routes
 * Use in pages that require authentication
 */
class AuthMiddleware {
  static requireAuth() {
    const currentUser = sessionStorage.getItem('currentUser');
    if (!currentUser) {
      window.location.href = '/index.html';
      return false;
    }
    return true;
  }

  static async checkTokenValidity() {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      return false;
    }

    try {
      // Make a simple API call to verify token
      const response = await fetch(`${window.authManager.apiBaseUrl}/patient/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  static async refreshToken() {
    try {
      const response = await fetch(`${window.authManager.apiBaseUrl}/patient/refresh-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        sessionStorage.setItem('authToken', data.token);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }
}

/**
 * Session Management
 */
class SessionManager {
  static startSession() {
    const user = sessionStorage.getItem('currentUser');
    if (user) {
      // Set session timeout (30 minutes)
      this.sessionTimeout = setTimeout(() => {
        this.endSession();
      }, 30 * 60 * 1000);

      // Reset timeout on user activity
      document.addEventListener('mousemove', () => this.resetTimeout());
      document.addEventListener('keypress', () => this.resetTimeout());
      document.addEventListener('click', () => this.resetTimeout());
    }
  }

  static resetTimeout() {
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
    }
    this.startSession();
  }

  static async endSession() {
    await window.authManager.logout();
    window.location.href = '/index.html';
  }
}

/**
 * Password Security Utilities
 */
class PasswordUtils {
  static isStrong(password) {
    // At least 8 characters, contains uppercase, lowercase, number, special char
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongRegex.test(password);
  }

  static getStrength(password) {
    if (password.length === 0) return 0;
    if (password.length < 6) return 1;
    if (password.length < 8) return 2;
    if (this.isStrong(password)) return 4;
    return 3;
  }

  static getStrengthLabel(strength) {
    const labels = ['Weak', 'Very Weak', 'Weak', 'Medium', 'Strong'];
    return labels[strength] || 'Unknown';
  }
}

/**
 * Form Validation
 */
class FormValidator {
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validatePhone(phone) {
    // 10-digit phone number for India
    const phoneRegex = /^[0-9]{10}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
  }

  static validateName(name) {
    return name.trim().length >= 2;
  }

  static validatePassword(password) {
    return password.length >= 6;
  }

  static validateForm(formData) {
    const errors = {};

    if (!this.validateName(formData.caretaker_name)) {
      errors.caretaker_name = 'Name must be at least 2 characters';
    }

    if (formData.patient_name && !this.validateName(formData.patient_name)) {
      errors.patient_name = 'Patient name must be at least 2 characters';
    }

    if (formData.caretaker_mobile && !this.validatePhone(formData.caretaker_mobile)) {
      errors.caretaker_mobile = 'Invalid phone number (must be 10 digits)';
    }

    if (!this.validatePassword(formData.password)) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (formData.confirm_password && formData.password !== formData.confirm_password) {
      errors.confirm_password = 'Passwords do not match';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
}

// Initialize auth on page load
window.addEventListener('DOMContentLoaded', async () => {
  await window.authManager.initialize();
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AuthManager,
    AuthMiddleware,
    SessionManager,
    PasswordUtils,
    FormValidator
  };
}
