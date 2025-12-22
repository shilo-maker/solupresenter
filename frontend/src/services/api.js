import axios from 'axios';

// Dynamically determine API URL based on current hostname
// This allows the app to work both on localhost and when accessed via IP address
const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  // Use the current hostname with backend port
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const backendPort = 5000;

  return `${protocol}//${hostname}:${backendPort}`;
};

const API_URL = getApiUrl();

const api = axios.create({
  baseURL: API_URL
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Set Content-Type to application/json for non-FormData requests
    if (!(config.data instanceof FormData) && !config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json';
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
      // Only redirect to login if we're not already there (to prevent reload)
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authAPI = {
  register: (email, password, language) => api.post('/auth/register', { email, password, language }),
  login: (email, password) => api.post('/auth/login', { email, password }),
  getCurrentUser: () => api.get('/auth/me')
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
  create: (publicRoomId) => api.post('/api/rooms/create', { publicRoomId }),
  joinByPin: (pin) => api.get(`/api/rooms/join/${pin}`),
  getMyRoom: () => api.get('/api/rooms/my-room'),
  close: (id) => api.post(`/api/rooms/${id}/close`),
  linkPublicRoom: (id, publicRoomId) => api.post(`/api/rooms/${id}/link-public-room`, { publicRoomId })
};

// Public Room endpoints
export const publicRoomAPI = {
  getMyRooms: () => api.get('/api/public-rooms/my-rooms'),
  create: (name) => api.post('/api/public-rooms', { name }),
  delete: (id) => api.delete(`/api/public-rooms/${id}`),
  search: (q) => api.get('/api/public-rooms/search', { params: { q } }),
  joinBySlug: (slug) => api.get(`/api/public-rooms/join/${slug}`)
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
  createPublicSong: (songData) => api.post('/api/admin/create-public-song', songData),
  // User management
  getUsers: () => api.get('/api/admin/users'),
  toggleUserAdmin: (id) => api.post(`/api/admin/users/${id}/toggle-admin`),
  deleteUser: (id) => api.delete(`/api/admin/users/${id}`)
};

// Helper function to get full image URL
export const getFullImageUrl = (url) => {
  if (!url) return '';

  // If it's already a full URL (starts with http), return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // If it's a gradient, return as is
  if (url.startsWith('linear-gradient')) {
    return url;
  }

  // If it's a relative path (starts with /uploads), prepend API URL
  if (url.startsWith('/uploads')) {
    return `${API_URL}${url}`;
  }

  // Otherwise return as is
  return url;
};

export default api;
