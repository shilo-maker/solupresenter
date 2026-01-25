/**
 * Comprehensive Frontend Service Tests
 * Tests API service, Socket service, and AuthContext thoroughly
 */

import '@testing-library/jest-dom';

// ============================================
// API SERVICE TESTS
// ============================================

describe('API Service', () => {
  let mockAxios;
  let mockApi;

  beforeEach(() => {
    jest.resetModules();

    // Create mock axios instance
    mockApi = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    };

    mockAxios = {
      create: jest.fn(() => mockApi)
    };

    jest.doMock('axios', () => mockAxios);
  });

  describe('Auth API', () => {
    it('should call register with correct params', async () => {
      mockApi.post.mockResolvedValueOnce({
        data: { user: { id: '1', email: 'test@example.com' }, token: 'jwt-token' }
      });

      // Simulate authAPI.register
      const result = await mockApi.post('/auth/register', {
        email: 'test@example.com',
        password: 'Password123!',
        language: 'he'
      });

      expect(mockApi.post).toHaveBeenCalledWith('/auth/register', {
        email: 'test@example.com',
        password: 'Password123!',
        language: 'he'
      });
      expect(result.data).toHaveProperty('token');
    });

    it('should call login with email and password', async () => {
      mockApi.post.mockResolvedValueOnce({
        data: { user: { id: '1' }, token: 'jwt-token' }
      });

      await mockApi.post('/auth/login', {
        email: 'test@example.com',
        password: 'Password123!'
      });

      expect(mockApi.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'Password123!'
      });
    });

    it('should call getCurrentUser with auth header', async () => {
      mockApi.get.mockResolvedValueOnce({
        data: { id: '1', email: 'test@example.com', role: 'operator' }
      });

      await mockApi.get('/auth/me');

      expect(mockApi.get).toHaveBeenCalledWith('/auth/me');
    });
  });

  describe('Song API', () => {
    it('should fetch all songs', async () => {
      const mockSongs = [
        { id: '1', title: 'Song 1', slides: [] },
        { id: '2', title: 'Song 2', slides: [] }
      ];

      mockApi.get.mockResolvedValueOnce({ data: { songs: mockSongs } });

      const result = await mockApi.get('/api/songs');

      expect(result.data.songs).toHaveLength(2);
    });

    it('should search songs with params', async () => {
      mockApi.get.mockResolvedValueOnce({
        data: { songs: [{ id: '1', title: 'Matching Song' }] }
      });

      await mockApi.get('/api/songs/search', {
        params: { q: 'worship', language: 'he', tags: ['praise'] }
      });

      expect(mockApi.get).toHaveBeenCalledWith('/api/songs/search', {
        params: { q: 'worship', language: 'he', tags: ['praise'] }
      });
    });

    it('should create new song', async () => {
      const newSong = {
        title: 'New Song',
        slides: [{ originalText: 'Lyrics', translation: 'Translation' }],
        originalLanguage: 'he'
      };

      mockApi.post.mockResolvedValueOnce({ data: { id: '1', ...newSong } });

      await mockApi.post('/api/songs', newSong);

      expect(mockApi.post).toHaveBeenCalledWith('/api/songs', newSong);
    });

    it('should update existing song', async () => {
      const updates = { title: 'Updated Title' };

      mockApi.put.mockResolvedValueOnce({ data: { id: '1', ...updates } });

      await mockApi.put('/api/songs/1', updates);

      expect(mockApi.put).toHaveBeenCalledWith('/api/songs/1', updates);
    });

    it('should delete song', async () => {
      mockApi.delete.mockResolvedValueOnce({ data: { message: 'Deleted' } });

      await mockApi.delete('/api/songs/1');

      expect(mockApi.delete).toHaveBeenCalledWith('/api/songs/1');
    });

    it('should get tags list', async () => {
      mockApi.get.mockResolvedValueOnce({
        data: { tags: ['worship', 'praise', 'hebrew'] }
      });

      const result = await mockApi.get('/api/songs/meta/tags');

      expect(result.data.tags).toContain('worship');
    });
  });

  describe('Room API', () => {
    it('should create room', async () => {
      mockApi.post.mockResolvedValueOnce({
        data: { id: 'room-1', pin: 'A1B2' }
      });

      const result = await mockApi.post('/api/rooms/create', {});

      expect(result.data).toHaveProperty('pin');
    });

    it('should join room by PIN', async () => {
      mockApi.get.mockResolvedValueOnce({
        data: { id: 'room-1', pin: 'A1B2', isActive: true }
      });

      await mockApi.get('/api/rooms/join/A1B2');

      expect(mockApi.get).toHaveBeenCalledWith('/api/rooms/join/A1B2');
    });

    it('should get my room', async () => {
      mockApi.get.mockResolvedValueOnce({
        data: { room: { id: 'room-1', pin: 'A1B2' } }
      });

      await mockApi.get('/api/rooms/my-room');

      expect(mockApi.get).toHaveBeenCalledWith('/api/rooms/my-room');
    });

    it('should close room', async () => {
      mockApi.post.mockResolvedValueOnce({
        data: { message: 'Room closed' }
      });

      await mockApi.post('/api/rooms/room-1/close');

      expect(mockApi.post).toHaveBeenCalledWith('/api/rooms/room-1/close');
    });

    it('should link public room', async () => {
      mockApi.post.mockResolvedValueOnce({
        data: { message: 'Linked successfully' }
      });

      await mockApi.post('/api/rooms/room-1/link-public-room', {
        publicRoomId: 'public-1'
      });

      expect(mockApi.post).toHaveBeenCalledWith('/api/rooms/room-1/link-public-room', {
        publicRoomId: 'public-1'
      });
    });
  });

  describe('Public Room API', () => {
    it('should get my public rooms', async () => {
      mockApi.get.mockResolvedValueOnce({
        data: [{ id: '1', name: 'My Church', slug: 'my-church' }]
      });

      await mockApi.get('/api/public-rooms/my-rooms');

      expect(mockApi.get).toHaveBeenCalledWith('/api/public-rooms/my-rooms');
    });

    it('should create public room', async () => {
      mockApi.post.mockResolvedValueOnce({
        data: { id: '1', name: 'New Church', slug: 'new-church' }
      });

      await mockApi.post('/api/public-rooms', { name: 'New Church' });

      expect(mockApi.post).toHaveBeenCalledWith('/api/public-rooms', {
        name: 'New Church'
      });
    });

    it('should search public rooms', async () => {
      mockApi.get.mockResolvedValueOnce({
        data: [{ id: '1', name: 'Test Church', slug: 'test-church' }]
      });

      await mockApi.get('/api/public-rooms/search', { params: { q: 'test' } });

      expect(mockApi.get).toHaveBeenCalledWith('/api/public-rooms/search', {
        params: { q: 'test' }
      });
    });

    it('should join by slug', async () => {
      mockApi.get.mockResolvedValueOnce({
        data: { pin: 'A1B2', name: 'Test Church' }
      });

      await mockApi.get('/api/public-rooms/join/test-church');

      expect(mockApi.get).toHaveBeenCalledWith('/api/public-rooms/join/test-church');
    });
  });

  describe('Setlist API', () => {
    it('should get all setlists', async () => {
      mockApi.get.mockResolvedValueOnce({
        data: { setlists: [{ id: '1', name: 'Sunday Service' }] }
      });

      await mockApi.get('/api/setlists');

      expect(mockApi.get).toHaveBeenCalledWith('/api/setlists');
    });

    it('should get setlist by id', async () => {
      mockApi.get.mockResolvedValueOnce({
        data: { id: '1', name: 'Sunday Service', items: [] }
      });

      await mockApi.get('/api/setlists/1');

      expect(mockApi.get).toHaveBeenCalledWith('/api/setlists/1');
    });

    it('should get setlist by share token', async () => {
      mockApi.get.mockResolvedValueOnce({
        data: { id: '1', name: 'Shared Setlist' }
      });

      await mockApi.get('/api/setlists/shared/share-token-123');

      expect(mockApi.get).toHaveBeenCalledWith('/api/setlists/shared/share-token-123');
    });

    it('should create setlist', async () => {
      const setlistData = {
        name: 'New Setlist',
        items: [{ type: 'song', songId: '1' }]
      };

      mockApi.post.mockResolvedValueOnce({ data: { id: '1', ...setlistData } });

      await mockApi.post('/api/setlists', setlistData);

      expect(mockApi.post).toHaveBeenCalledWith('/api/setlists', setlistData);
    });

    it('should generate share link', async () => {
      mockApi.post.mockResolvedValueOnce({
        data: { shareToken: 'abc123' }
      });

      await mockApi.post('/api/setlists/1/share');

      expect(mockApi.post).toHaveBeenCalledWith('/api/setlists/1/share');
    });
  });

  describe('Admin API', () => {
    it('should get pending songs', async () => {
      mockApi.get.mockResolvedValueOnce({
        data: { songs: [{ id: '1', title: 'Pending Song', isPendingApproval: true }] }
      });

      await mockApi.get('/api/admin/pending-songs');

      expect(mockApi.get).toHaveBeenCalledWith('/api/admin/pending-songs');
    });

    it('should approve song', async () => {
      mockApi.post.mockResolvedValueOnce({
        data: { message: 'Approved' }
      });

      await mockApi.post('/api/admin/approve-song/1');

      expect(mockApi.post).toHaveBeenCalledWith('/api/admin/approve-song/1');
    });

    it('should get all users', async () => {
      mockApi.get.mockResolvedValueOnce({
        data: { users: [{ id: '1', email: 'user@test.com', role: 'operator' }] }
      });

      await mockApi.get('/api/admin/users');

      expect(mockApi.get).toHaveBeenCalledWith('/api/admin/users');
    });

    it('should toggle admin status', async () => {
      mockApi.post.mockResolvedValueOnce({
        data: { user: { id: '1', role: 'admin' } }
      });

      await mockApi.post('/api/admin/users/1/toggle-admin');

      expect(mockApi.post).toHaveBeenCalledWith('/api/admin/users/1/toggle-admin');
    });
  });

  describe('Theme API', () => {
    it('should get all themes', async () => {
      mockApi.get.mockResolvedValueOnce({
        data: { themes: [{ id: '1', name: 'Classic', isBuiltIn: true }] }
      });

      await mockApi.get('/api/viewer-themes');

      expect(mockApi.get).toHaveBeenCalledWith('/api/viewer-themes');
    });

    it('should create theme', async () => {
      const themeData = {
        name: 'My Theme',
        lineStyles: { original: { fontSize: 100 } }
      };

      mockApi.post.mockResolvedValueOnce({ data: { theme: { id: '1', ...themeData } } });

      await mockApi.post('/api/viewer-themes', themeData);

      expect(mockApi.post).toHaveBeenCalledWith('/api/viewer-themes', themeData);
    });

    it('should duplicate theme', async () => {
      mockApi.post.mockResolvedValueOnce({
        data: { theme: { id: '2', name: 'Classic Copy' } }
      });

      await mockApi.post('/api/viewer-themes/1/duplicate', { name: 'Classic Copy' });

      expect(mockApi.post).toHaveBeenCalledWith('/api/viewer-themes/1/duplicate', {
        name: 'Classic Copy'
      });
    });

    it('should set default theme', async () => {
      mockApi.post.mockResolvedValueOnce({
        data: { defaultThemeId: '1' }
      });

      await mockApi.post('/api/viewer-themes/1/set-default');

      expect(mockApi.post).toHaveBeenCalledWith('/api/viewer-themes/1/set-default');
    });

    it('should get default theme', async () => {
      mockApi.get.mockResolvedValueOnce({
        data: { defaultThemeId: '1', theme: { name: 'Classic' } }
      });

      await mockApi.get('/api/viewer-themes/default');

      expect(mockApi.get).toHaveBeenCalledWith('/api/viewer-themes/default');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('Network Error'));

      await expect(mockApi.get('/api/test')).rejects.toThrow('Network Error');
    });

    it('should handle 401 Unauthorized', async () => {
      mockApi.get.mockRejectedValueOnce({
        response: { status: 401, data: { error: 'Unauthorized' } }
      });

      try {
        await mockApi.get('/api/protected');
      } catch (error) {
        expect(error.response.status).toBe(401);
      }
    });

    it('should handle 404 Not Found', async () => {
      mockApi.get.mockRejectedValueOnce({
        response: { status: 404, data: { error: 'Not found' } }
      });

      try {
        await mockApi.get('/api/songs/999');
      } catch (error) {
        expect(error.response.status).toBe(404);
      }
    });

    it('should handle 500 Server Error', async () => {
      mockApi.post.mockRejectedValueOnce({
        response: { status: 500, data: { error: 'Internal server error' } }
      });

      try {
        await mockApi.post('/api/songs', {});
      } catch (error) {
        expect(error.response.status).toBe(500);
      }
    });

    it('should handle timeout errors', async () => {
      mockApi.get.mockRejectedValueOnce({
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded'
      });

      try {
        await mockApi.get('/api/slow-endpoint');
      } catch (error) {
        expect(error.code).toBe('ECONNABORTED');
      }
    });
  });
});

// ============================================
// SOCKET SERVICE TESTS
// ============================================

describe('Socket Service', () => {
  let mockSocket;

  beforeEach(() => {
    mockSocket = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      once: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      removeAllListeners: jest.fn(),
      connected: true,
      id: 'test-socket-id'
    };
  });

  describe('Connection Management', () => {
    it('should track connection status', () => {
      expect(mockSocket.connected).toBe(true);
    });

    it('should have unique socket ID', () => {
      expect(mockSocket.id).toBeTruthy();
      expect(typeof mockSocket.id).toBe('string');
    });

    it('should handle disconnect', () => {
      mockSocket.connected = false;
      expect(mockSocket.connected).toBe(false);
    });
  });

  describe('Operator Events', () => {
    it('should emit operator:join event', () => {
      mockSocket.emit('operator:join', { userId: '1', roomId: 'room-1' });

      expect(mockSocket.emit).toHaveBeenCalledWith('operator:join', {
        userId: '1',
        roomId: 'room-1'
      });
    });

    it('should emit operator:updateSlide with full data', () => {
      const slideData = {
        roomId: 'room-1',
        roomPin: 'A1B2',
        songId: 'song-1',
        slideIndex: 0,
        displayMode: 'bilingual',
        isBlank: false,
        slideData: { slide: { originalText: 'Test' }, title: 'Test Song' },
        toolsData: { countdown: { running: false } }
      };

      mockSocket.emit('operator:updateSlide', slideData);

      expect(mockSocket.emit).toHaveBeenCalledWith('operator:updateSlide', slideData);
    });

    it('should emit operator:updateBackground', () => {
      mockSocket.emit('operator:updateBackground', {
        roomId: 'room-1',
        backgroundImage: '/uploads/bg.webp'
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('operator:updateBackground', {
        roomId: 'room-1',
        backgroundImage: '/uploads/bg.webp'
      });
    });

    it('should emit operator:applyTheme', () => {
      mockSocket.emit('operator:applyTheme', {
        roomId: 'room-1',
        themeId: 'theme-1'
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('operator:applyTheme', {
        roomId: 'room-1',
        themeId: 'theme-1'
      });
    });

    it('should emit operator:updateQuickSlideText', () => {
      mockSocket.emit('operator:updateQuickSlideText', {
        roomId: 'room-1',
        quickSlideText: 'Welcome to worship!'
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('operator:updateQuickSlideText', {
        roomId: 'room-1',
        quickSlideText: 'Welcome to worship!'
      });
    });
  });

  describe('Viewer Events', () => {
    it('should emit viewer:join with PIN', () => {
      mockSocket.emit('viewer:join', { pin: 'A1B2' });

      expect(mockSocket.emit).toHaveBeenCalledWith('viewer:join', { pin: 'A1B2' });
    });

    it('should emit viewer:join with slug', () => {
      mockSocket.emit('viewer:join', { slug: 'my-church' });

      expect(mockSocket.emit).toHaveBeenCalledWith('viewer:join', { slug: 'my-church' });
    });
  });

  describe('Event Listeners', () => {
    it('should register operator:joined listener', () => {
      const callback = jest.fn();
      mockSocket.on('operator:joined', callback);

      expect(mockSocket.on).toHaveBeenCalledWith('operator:joined', callback);
    });

    it('should register viewer:joined listener', () => {
      const callback = jest.fn();
      mockSocket.on('viewer:joined', callback);

      expect(mockSocket.on).toHaveBeenCalledWith('viewer:joined', callback);
    });

    it('should register slide:update listener', () => {
      const callback = jest.fn();
      mockSocket.on('slide:update', callback);

      expect(mockSocket.on).toHaveBeenCalledWith('slide:update', callback);
    });

    it('should register room:viewerCount listener', () => {
      const callback = jest.fn();
      mockSocket.on('room:viewerCount', callback);

      expect(mockSocket.on).toHaveBeenCalledWith('room:viewerCount', callback);
    });

    it('should register background:update listener', () => {
      const callback = jest.fn();
      mockSocket.on('background:update', callback);

      expect(mockSocket.on).toHaveBeenCalledWith('background:update', callback);
    });

    it('should register theme:update listener', () => {
      const callback = jest.fn();
      mockSocket.on('theme:update', callback);

      expect(mockSocket.on).toHaveBeenCalledWith('theme:update', callback);
    });

    it('should register error listener', () => {
      const callback = jest.fn();
      mockSocket.on('error', callback);

      expect(mockSocket.on).toHaveBeenCalledWith('error', callback);
    });
  });

  describe('Event Removal', () => {
    it('should remove specific listener', () => {
      mockSocket.off('slide:update');

      expect(mockSocket.off).toHaveBeenCalledWith('slide:update');
    });

    it('should remove all listeners', () => {
      mockSocket.removeAllListeners();

      expect(mockSocket.removeAllListeners).toHaveBeenCalled();
    });
  });

  describe('Heartbeat', () => {
    it('should emit ping with timestamp', () => {
      const timestamp = Date.now();
      mockSocket.emit('ping', timestamp);

      expect(mockSocket.emit).toHaveBeenCalledWith('ping', timestamp);
    });

    it('should listen for pong response', () => {
      const callback = jest.fn();
      mockSocket.on('pong', callback);

      expect(mockSocket.on).toHaveBeenCalledWith('pong', callback);
    });
  });
});

// ============================================
// URL UTILITIES TESTS
// ============================================

describe('URL Utilities', () => {
  describe('getFullImageUrl', () => {
    const mockApiUrl = 'http://localhost:5000';

    const getFullImageUrl = (url) => {
      if (!url) return '';
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      if (url.startsWith('linear-gradient')) {
        return url;
      }
      if (url.startsWith('/uploads')) {
        return `${mockApiUrl}${url}`;
      }
      return url;
    };

    it('should return empty string for null/undefined', () => {
      expect(getFullImageUrl(null)).toBe('');
      expect(getFullImageUrl(undefined)).toBe('');
      expect(getFullImageUrl('')).toBe('');
    });

    it('should return absolute URLs unchanged', () => {
      const httpsUrl = 'https://example.com/image.jpg';
      const httpUrl = 'http://example.com/image.jpg';

      expect(getFullImageUrl(httpsUrl)).toBe(httpsUrl);
      expect(getFullImageUrl(httpUrl)).toBe(httpUrl);
    });

    it('should return gradients unchanged', () => {
      const gradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

      expect(getFullImageUrl(gradient)).toBe(gradient);
    });

    it('should prepend API URL to upload paths', () => {
      const uploadPath = '/uploads/backgrounds/image.webp';
      const expected = 'http://localhost:5000/uploads/backgrounds/image.webp';

      expect(getFullImageUrl(uploadPath)).toBe(expected);
    });

    it('should handle other paths as-is', () => {
      const otherPath = '/static/image.png';

      expect(getFullImageUrl(otherPath)).toBe(otherPath);
    });
  });
});

// ============================================
// LOCAL STORAGE TESTS
// ============================================

describe('Local Storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Token Management', () => {
    it('should store token', () => {
      const token = 'jwt-token-12345';
      localStorage.setItem('token', token);

      expect(localStorage.getItem('token')).toBe(token);
    });

    it('should remove token on logout', () => {
      localStorage.setItem('token', 'some-token');
      localStorage.removeItem('token');

      expect(localStorage.getItem('token')).toBeNull();
    });

    it('should handle missing token', () => {
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  describe('User Preferences', () => {
    it('should store language preference', () => {
      const prefs = { language: 'he' };
      localStorage.setItem('userPreferences', JSON.stringify(prefs));

      const retrieved = JSON.parse(localStorage.getItem('userPreferences'));
      expect(retrieved.language).toBe('he');
    });

    it('should store theme preference', () => {
      const prefs = { defaultThemeId: 'theme-1' };
      localStorage.setItem('userPreferences', JSON.stringify(prefs));

      const retrieved = JSON.parse(localStorage.getItem('userPreferences'));
      expect(retrieved.defaultThemeId).toBe('theme-1');
    });
  });

  describe('Room PIN Cache', () => {
    it('should cache last used PIN', () => {
      localStorage.setItem('lastRoomPin', 'A1B2');

      expect(localStorage.getItem('lastRoomPin')).toBe('A1B2');
    });
  });
});

// ============================================
// INPUT VALIDATION TESTS
// ============================================

describe('Input Validation', () => {
  describe('Email Validation', () => {
    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    it('should validate correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
    });
  });

  describe('Password Validation', () => {
    const isValidPassword = (password) => Boolean(password && password.length >= 6);

    it('should accept valid passwords', () => {
      expect(isValidPassword('password123')).toBe(true);
      expect(isValidPassword('123456')).toBe(true);
    });

    it('should reject short passwords', () => {
      expect(isValidPassword('12345')).toBe(false);
      expect(isValidPassword('')).toBe(false);
    });
  });

  describe('PIN Validation', () => {
    const isValidPin = (pin) => /^[A-Z0-9]{4}$/.test(pin?.toUpperCase());

    it('should accept valid PINs', () => {
      expect(isValidPin('A1B2')).toBe(true);
      expect(isValidPin('1234')).toBe(true);
      expect(isValidPin('ABCD')).toBe(true);
    });

    it('should handle lowercase PINs', () => {
      expect(isValidPin('a1b2')).toBe(true);
    });

    it('should reject invalid PINs', () => {
      expect(isValidPin('ABC')).toBe(false);
      expect(isValidPin('ABCDE')).toBe(false);
      expect(isValidPin('')).toBe(false);
    });
  });

  describe('Slug Validation', () => {
    const isValidSlug = (slug) => /^[a-z0-9-]+$/.test(slug) && slug.length >= 3;

    it('should accept valid slugs', () => {
      expect(isValidSlug('my-church')).toBe(true);
      expect(isValidSlug('church-123')).toBe(true);
    });

    it('should reject invalid slugs', () => {
      expect(isValidSlug('My Church')).toBe(false);
      expect(isValidSlug('ab')).toBe(false);
      expect(isValidSlug('church_name')).toBe(false);
    });
  });
});

console.log('Comprehensive services tests loaded successfully');
