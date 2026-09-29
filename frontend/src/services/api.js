export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Universal API fetch client with automatic JWT token attachment and error handling
 */
export const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('nudge_token');

  const headers = {
    ...options.headers
  };

  // Do not set Content-Type if body is FormData (let browser set boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || 'Request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};
