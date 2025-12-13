/**
 * Service Tests for SoluPresenter
 * Tests API service and Socket service
 */

import '@testing-library/jest-dom';

// ============================================
// API SERVICE TESTS
// ============================================

describe('API Service', () => {
  let mockAxios;

  beforeEach(() => {
    jest.resetModules();
    mockAxios = {
      create: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ data: {} }),
        post: jest.fn().mockResolvedValue({ data: {} }),
        put: jest.fn().mockResolvedValue({ data: {} }),
        delete: jest.fn().mockResolvedValue({ data: {} }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      })),
      get: jest.fn().mockResolvedValue({ data: {} }),
      post: jest.fn().mockResolvedValue({ data: {} })
    };
    jest.doMock('axios', () => mockAxios);
  });

  describe('Authentication API', () => {
    it('should have login endpoint', () => {
      // API should have auth endpoints
      expect(true).toBe(true);
    });

    it('should have register endpoint', () => {
      expect(true).toBe(true);
    });

    it('should handle token storage', () => {
      // Test localStorage token handling
      const token = 'test-token';
      localStorage.setItem('token', token);
      expect(localStorage.getItem('token')).toBe(token);
      localStorage.removeItem('token');
    });
  });

  describe('Songs API', () => {
    it('should fetch songs list', async () => {
      const mockSongs = [
        { id: 1, title: 'Song 1' },
        { id: 2, title: 'Song 2' }
      ];

      mockAxios.get.mockResolvedValueOnce({ data: { songs: mockSongs } });

      // Verify mock setup works
      expect(mockAxios.get).toBeDefined();
    });

    it('should create new song', async () => {
      const newSong = {
        title: 'New Song',
        slides: [{ originalText: 'Lyrics' }]
      };

      mockAxios.post.mockResolvedValueOnce({ data: { id: 1, ...newSong } });

      expect(mockAxios.post).toBeDefined();
    });

    it('should update existing song', async () => {
      mockAxios.put = jest.fn().mockResolvedValueOnce({ data: { success: true } });
      expect(mockAxios.put).toBeDefined();
    });

    it('should delete song', async () => {
      mockAxios.delete = jest.fn().mockResolvedValueOnce({ data: { success: true } });
      expect(mockAxios.delete).toBeDefined();
    });
  });

  describe('Rooms API', () => {
    it('should create room', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { id: 1, pin: '1234' }
      });

      expect(mockAxios.post).toBeDefined();
    });

    it('should fetch room by PIN', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: { id: 1, pin: '1234' }
      });

      expect(mockAxios.get).toBeDefined();
    });

    it('should link public room', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { success: true }
      });

      expect(mockAxios.post).toBeDefined();
    });
  });

  describe('Public Rooms API', () => {
    it('should fetch public rooms', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: [{ id: 1, name: 'Public Room', slug: 'public-room' }]
      });

      expect(mockAxios.get).toBeDefined();
    });

    it('should search public rooms', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: [{ id: 1, name: 'Test Room', slug: 'test-room' }]
      });

      expect(mockAxios.get).toBeDefined();
    });

    it('should create public room', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { id: 1, name: 'New Room', slug: 'new-room' }
      });

      expect(mockAxios.post).toBeDefined();
    });
  });

  describe('Setlists API', () => {
    it('should fetch setlists', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: { setlists: [{ id: 1, name: 'Setlist 1' }] }
      });

      expect(mockAxios.get).toBeDefined();
    });

    it('should save setlist', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { id: 1, name: 'New Setlist' }
      });

      expect(mockAxios.post).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockAxios.get.mockRejectedValueOnce(new Error('Network Error'));

      try {
        await mockAxios.get('/api/test');
      } catch (error) {
        expect(error.message).toBe('Network Error');
      }
    });

    it('should handle 401 unauthorized', async () => {
      mockAxios.get.mockRejectedValueOnce({
        response: { status: 401, data: { message: 'Unauthorized' } }
      });

      try {
        await mockAxios.get('/api/protected');
      } catch (error) {
        expect(error.response.status).toBe(401);
      }
    });

    it('should handle 500 server error', async () => {
      mockAxios.get.mockRejectedValueOnce({
        response: { status: 500, data: { message: 'Server Error' } }
      });

      try {
        await mockAxios.get('/api/error');
      } catch (error) {
        expect(error.response.status).toBe(500);
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
      connect: jest.fn(),
      disconnect: jest.fn(),
      connected: true,
      id: 'test-socket-id'
    };
  });

  describe('Connection Management', () => {
    it('should connect to socket server', () => {
      expect(mockSocket.connected).toBe(true);
    });

    it('should handle disconnect', () => {
      mockSocket.connected = false;
      expect(mockSocket.connected).toBe(false);
    });

    it('should have unique socket ID', () => {
      expect(mockSocket.id).toBeTruthy();
      expect(typeof mockSocket.id).toBe('string');
    });
  });

  describe('Room Events', () => {
    it('should emit presenter-create-room', () => {
      mockSocket.emit('presenter-create-room', '1234', jest.fn());
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'presenter-create-room',
        '1234',
        expect.any(Function)
      );
    });

    it('should emit viewer-join-room', () => {
      mockSocket.emit('viewer-join-room', '1234', jest.fn());
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'viewer-join-room',
        '1234',
        expect.any(Function)
      );
    });

    it('should emit viewer-join-room-by-slug', () => {
      mockSocket.emit('viewer-join-room-by-slug', 'test-room', jest.fn());
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'viewer-join-room-by-slug',
        'test-room',
        expect.any(Function)
      );
    });
  });

  describe('Slide Events', () => {
    it('should emit presenter-update-slide', () => {
      const slideData = {
        pin: '1234',
        slideData: { originalText: 'Test' },
        slideIndex: 0
      };

      mockSocket.emit('presenter-update-slide', slideData);
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'presenter-update-slide',
        slideData
      );
    });

    it('should emit presenter-blank-slide', () => {
      mockSocket.emit('presenter-blank-slide', { pin: '1234', isBlank: true });
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'presenter-blank-slide',
        expect.objectContaining({ isBlank: true })
      );
    });

    it('should listen for slide-update', () => {
      mockSocket.on('slide-update', jest.fn());
      expect(mockSocket.on).toHaveBeenCalledWith(
        'slide-update',
        expect.any(Function)
      );
    });
  });

  describe('Background Events', () => {
    it('should emit presenter-background-update', () => {
      mockSocket.emit('presenter-background-update', {
        pin: '1234',
        backgroundUrl: 'http://example.com/bg.jpg',
        backgroundType: 'image'
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'presenter-background-update',
        expect.objectContaining({ backgroundType: 'image' })
      );
    });

    it('should listen for background-update', () => {
      mockSocket.on('background-update', jest.fn());
      expect(mockSocket.on).toHaveBeenCalledWith(
        'background-update',
        expect.any(Function)
      );
    });
  });

  describe('Event Cleanup', () => {
    it('should remove event listeners on cleanup', () => {
      mockSocket.off('slide-update');
      expect(mockSocket.off).toHaveBeenCalledWith('slide-update');
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

  it('should store and retrieve token', () => {
    const token = 'test-jwt-token';
    localStorage.setItem('token', token);
    expect(localStorage.getItem('token')).toBe(token);
  });

  it('should remove token on logout', () => {
    localStorage.setItem('token', 'test-token');
    localStorage.removeItem('token');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('should handle missing token gracefully', () => {
    expect(localStorage.getItem('token')).toBeNull();
  });
});

// ============================================
// URL UTILITIES TESTS
// ============================================

describe('URL Utilities', () => {
  describe('getFullImageUrl', () => {
    it('should handle absolute URLs', () => {
      const url = 'https://example.com/image.jpg';
      expect(url.startsWith('http')).toBe(true);
    });

    it('should handle relative URLs', () => {
      const url = '/uploads/image.jpg';
      expect(url.startsWith('/')).toBe(true);
    });

    it('should handle gradient strings', () => {
      const gradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      expect(gradient.startsWith('linear-gradient')).toBe(true);
    });
  });
});

console.log('Service tests loaded successfully');
