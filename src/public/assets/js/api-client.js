/**
 * API Client
 * Handles HTTP requests to the backend API
 */
class APIClient {
  constructor(baseURL = '/api/v1') {
    this.baseURL = baseURL;
    this.token = null;
  }

  /**
   * Set authentication token
   */
  setToken(token) {
    this.token = token;
  }

  /**
   * Clear authentication token
   */
  clearToken() {
    this.token = null;
  }

  /**
   * Get headers with authentication
   */
  getHeaders(customHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  /**
   * Handle API response
   */
  async handleResponse(response) {
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const error = new Error(data.message || 'API request failed');
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  /**
   * GET request
   */
  async get(url, config = {}) {
    try {
      const response = await fetch(`${this.baseURL}${url}`, {
        method: 'GET',
        headers: this.getHeaders(config.headers),
        ...config,
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('GET request failed:', error);
      throw error;
    }
  }

  /**
   * POST request
   */
  async post(url, data, config = {}) {
    try {
      const response = await fetch(`${this.baseURL}${url}`, {
        method: 'POST',
        headers: this.getHeaders(config.headers),
        body: JSON.stringify(data),
        ...config,
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('POST request failed:', error);
      throw error;
    }
  }

  /**
   * PUT request
   */
  async put(url, data, config = {}) {
    try {
      const response = await fetch(`${this.baseURL}${url}`, {
        method: 'PUT',
        headers: this.getHeaders(config.headers),
        body: JSON.stringify(data),
        ...config,
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('PUT request failed:', error);
      throw error;
    }
  }

  /**
   * DELETE request
   */
  async delete(url, config = {}) {
    try {
      const response = await fetch(`${this.baseURL}${url}`, {
        method: 'DELETE',
        headers: this.getHeaders(config.headers),
        ...config,
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('DELETE request failed:', error);
      throw error;
    }
  }

  /**
   * PATCH request
   */
  async patch(url, data, config = {}) {
    try {
      const response = await fetch(`${this.baseURL}${url}`, {
        method: 'PATCH',
        headers: this.getHeaders(config.headers),
        body: JSON.stringify(data),
        ...config,
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('PATCH request failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
const apiClient = new APIClient();
