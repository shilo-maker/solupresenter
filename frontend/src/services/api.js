import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Debug: Log the API URL being used
console.log('🔧 API_URL:', API_URL);
console.log('🔧 process.env.REACT_APP_API_URL:', process.env.REACT_APP_API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authAPI = {
  register: (email, password) => api.post('/auth/register', { email, password }),
  login: (email, password) => api.post('/auth/login', { email, password }),
  getCurrentUser: () => api.get('/auth/me'),
  googleAuth: () => window.location.href = `${API_URL}/auth/google`
};

// Song endpoints
export const songAPI = {
  getAll: () => api.get('/api/songs'),
  search: (params) => api.get('/api/songs/search', { params }),
  getById: (id) => api.get(`/api/songs/${id}`),
  create: (songData) => api.post('/api/songs', songData),
  update: (id, songData) => api.put(`/api/songs/${id}`, songData),
  delete: (id) => api.delete(`/api/songs/${id}`),
  getTags: () => api.get('/api/songs/meta/tags')
};

// Room endpoints
export const roomAPI = {
  create: () => api.post('/api/rooms/create'),
  joinByPin: (pin) => api.get(`/api/rooms/join/${pin}`),
  getMyRoom: () => api.get('/api/rooms/my-room'),
  close: (id) => api.post(`/api/rooms/${id}/close`)
};

// Setlist endpoints
export const setlistAPI = {
  getAll: () => api.get('/api/setlists'),
  getById: (id) => api.get(`/api/setlists/${id}`),
  getByShareToken: (token) => api.get(`/api/setlists/shared/${token}`),
  create: (setlistData) => api.post('/api/setlists', setlistData),
  update: (id, setlistData) => api.put(`/api/setlists/${id}`, setlistData),
  delete: (id) => api.delete(`/api/setlists/${id}`),
  generateShareLink: (id) => api.post(`/api/setlists/${id}/share`),
  incrementUsage: (id) => api.post(`/api/setlists/${id}/use`)
};

// Admin endpoints
export const adminAPI = {
  getPendingSongs: () => api.get('/api/admin/pending-songs'),
  approveSong: (id) => api.post(`/api/admin/approve-song/${id}`),
  rejectSong: (id) => api.post(`/api/admin/reject-song/${id}`),
  createPublicSong: (songData) => api.post('/api/admin/create-public-song', songData)
};

export default api;
