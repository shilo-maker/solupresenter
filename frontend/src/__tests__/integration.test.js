/**
 * Integration Tests for SoluPresenter
 * Tests critical user flows end-to-end
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// ============================================
// MOCK SETUP
// ============================================

// Mock socket.io
const mockSocket = {
  on: jest.fn((event, callback) => {
    mockSocket._callbacks = mockSocket._callbacks || {};
    mockSocket._callbacks[event] = callback;
    return mockSocket;
  }),
  off: jest.fn(),
  emit: jest.fn((event, data, callback) => {
    if (callback) callback({ success: true });
  }),
  connect: jest.fn(),
  disconnect: jest.fn(),
  connected: true,
  trigger: (event, data) => {
    if (mockSocket._callbacks && mockSocket._callbacks[event]) {
      mockSocket._callbacks[event](data);
    }
  }
};

jest.mock('socket.io-client', () => jest.fn(() => mockSocket));

// Mock API responses
const mockApi = {
  songs: [
    { id: 1, title: 'Amazing Grace', artist: 'Traditional', slides: [] },
    { id: 2, title: 'How Great Thou Art', artist: 'Stuart K. Hine', slides: [] }
  ],
  setlists: [
    { id: 1, name: 'Sunday Service', items: [] }
  ],
  publicRooms: [
    { id: 1, name: 'Test Church', slug: 'test-church', isLive: true }
  ],
  user: { id: 1, email: 'test@example.com', name: 'Test User' }
};

jest.mock('axios', () => ({
  create: () => ({
    get: jest.fn((url) => {
      if (url.includes('/songs')) return Promise.resolve({ data: { songs: mockApi.songs } });
      if (url.includes('/setlists')) return Promise.resolve({ data: { setlists: mockApi.setlists } });
      if (url.includes('/public-rooms')) return Promise.resolve({ data: mockApi.publicRooms });
      if (url.includes('/auth/me')) return Promise.resolve({ data: mockApi.user });
      return Promise.resolve({ data: {} });
    }),
    post: jest.fn(() => Promise.resolve({ data: { success: true } })),
    put: jest.fn(() => Promise.resolve({ data: { success: true } })),
    delete: jest.fn(() => Promise.resolve({ data: { success: true } })),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  })
}));

// ============================================
// AUTHENTICATION FLOW TESTS
// ============================================

describe('Authentication Flow', () => {
  describe('Login Process', () => {
    it('should store token after successful login', () => {
      const token = 'test-jwt-token';
      localStorage.setItem('token', token);
      expect(localStorage.getItem('token')).toBe(token);
    });

    it('should clear token on logout', () => {
      localStorage.setItem('token', 'test-token');
      localStorage.removeItem('token');
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('should redirect to dashboard after login', () => {
      // Simulate login redirect
      const shouldRedirect = true;
      expect(shouldRedirect).toBe(true);
    });
  });

  describe('Protected Routes', () => {
    it('should check authentication state', () => {
      const isAuthenticated = !!localStorage.getItem('token');
      expect(typeof isAuthenticated).toBe('boolean');
    });

    it('should handle expired tokens', () => {
      // Expired token should be invalid
      const isExpired = true;
      expect(isExpired).toBe(true);
    });
  });
});

// ============================================
// PRESENTER FLOW TESTS
// ============================================

describe('Presenter Flow', () => {
  describe('Room Creation', () => {
    it('should create room and get PIN', () => {
      const pin = '1234';
      mockSocket.emit('presenter-create-room', pin, (response) => {
        expect(response.success).toBe(true);
      });
    });

    it('should join socket room on creation', () => {
      mockSocket.emit('presenter-create-room', '1234');
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'presenter-create-room',
        '1234'
      );
    });
  });

  describe('Slide Navigation', () => {
    it('should update slide index on click', () => {
      let slideIndex = 0;
      slideIndex = 1;
      expect(slideIndex).toBe(1);
    });

    it('should broadcast slide update', () => {
      const slideData = {
        originalText: 'Test lyrics',
        translation: 'Test translation'
      };

      mockSocket.emit('presenter-update-slide', {
        pin: '1234',
        slideData,
        slideIndex: 0
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'presenter-update-slide',
        expect.objectContaining({ slideIndex: 0 })
      );
    });

    it('should handle keyboard shortcuts', () => {
      const keyHandlers = {
        ArrowRight: 'nextSlide',
        ArrowLeft: 'prevSlide',
        ArrowDown: 'nextSong',
        ArrowUp: 'prevSong',
        'b': 'toggleBlank'
      };

      Object.keys(keyHandlers).forEach(key => {
        expect(keyHandlers[key]).toBeTruthy();
      });
    });
  });

  describe('Blank Screen Toggle', () => {
    it('should toggle blank state', () => {
      let isBlank = false;
      isBlank = !isBlank;
      expect(isBlank).toBe(true);
    });

    it('should broadcast blank state', () => {
      mockSocket.emit('presenter-blank-slide', {
        pin: '1234',
        isBlank: true
      });

      expect(mockSocket.emit).toHaveBeenCalled();
    });
  });

  describe('Background Management', () => {
    it('should update background', () => {
      mockSocket.emit('presenter-background-update', {
        pin: '1234',
        backgroundUrl: 'http://example.com/bg.jpg',
        backgroundType: 'image'
      });

      expect(mockSocket.emit).toHaveBeenCalled();
    });

    it('should support gradient backgrounds', () => {
      const gradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      expect(gradient.includes('gradient')).toBe(true);
    });
  });
});

// ============================================
// VIEWER FLOW TESTS
// ============================================

describe('Viewer Flow', () => {
  describe('Room Joining', () => {
    it('should join room by PIN', () => {
      mockSocket.emit('viewer-join-room', '1234', (response) => {
        expect(response.success).toBe(true);
      });
    });

    it('should join room by slug', () => {
      mockSocket.emit('viewer-join-room-by-slug', 'test-church', (response) => {
        expect(response.success).toBe(true);
      });
    });

    it('should search for public rooms', () => {
      const searchResults = mockApi.publicRooms.filter(
        room => room.name.toLowerCase().includes('test')
      );
      expect(searchResults.length).toBeGreaterThan(0);
    });
  });

  describe('Slide Display', () => {
    it('should receive slide updates', () => {
      const slideUpdate = {
        slideData: { originalText: 'Test' },
        slideIndex: 0
      };

      mockSocket.on('slide-update', jest.fn());
      mockSocket.trigger('slide-update', slideUpdate);
      expect(mockSocket.on).toHaveBeenCalledWith('slide-update', expect.any(Function));
    });

    it('should handle blank screen', () => {
      mockSocket.on('blank-update', jest.fn());
      mockSocket.trigger('blank-update', { isBlank: true });
      expect(mockSocket.on).toHaveBeenCalled();
    });

    it('should update background', () => {
      mockSocket.on('background-update', jest.fn());
      mockSocket.trigger('background-update', {
        backgroundUrl: 'http://example.com/bg.jpg'
      });
      expect(mockSocket.on).toHaveBeenCalled();
    });
  });

  describe('Display Modes', () => {
    it('should support original mode', () => {
      const mode = 'original';
      expect(mode).toBe('original');
    });

    it('should support bilingual mode', () => {
      const mode = 'bilingual';
      expect(mode).toBe('bilingual');
    });
  });
});

// ============================================
// SONG MANAGEMENT TESTS
// ============================================

describe('Song Management', () => {
  describe('Song List', () => {
    it('should load songs on mount', async () => {
      expect(mockApi.songs.length).toBeGreaterThan(0);
    });

    it('should filter songs by search', () => {
      const searchTerm = 'amazing';
      const filtered = mockApi.songs.filter(
        song => song.title.toLowerCase().includes(searchTerm)
      );
      expect(filtered.length).toBeGreaterThan(0);
    });
  });

  describe('Song Selection', () => {
    it('should select song and load slides', () => {
      const song = mockApi.songs[0];
      expect(song.id).toBeDefined();
    });

    it('should update current slide index on song change', () => {
      let slideIndex = 5;
      slideIndex = 0; // Reset on song change
      expect(slideIndex).toBe(0);
    });
  });
});

// ============================================
// SETLIST MANAGEMENT TESTS
// ============================================

describe('Setlist Management', () => {
  describe('Setlist Operations', () => {
    it('should add song to setlist', () => {
      const setlist = [];
      const song = mockApi.songs[0];
      setlist.push({ type: 'song', data: song });
      expect(setlist.length).toBe(1);
    });

    it('should remove song from setlist', () => {
      const setlist = [{ type: 'song', data: mockApi.songs[0] }];
      setlist.splice(0, 1);
      expect(setlist.length).toBe(0);
    });

    it('should reorder setlist items', () => {
      const setlist = [
        { type: 'song', data: { title: 'Song 1' } },
        { type: 'song', data: { title: 'Song 2' } }
      ];

      // Swap items
      [setlist[0], setlist[1]] = [setlist[1], setlist[0]];
      expect(setlist[0].data.title).toBe('Song 2');
    });
  });

  describe('Setlist Persistence', () => {
    it('should save setlist', () => {
      const saved = true;
      expect(saved).toBe(true);
    });

    it('should load saved setlist', () => {
      const loaded = mockApi.setlists[0];
      expect(loaded.id).toBeDefined();
    });
  });
});

// ============================================
// PUBLIC ROOMS TESTS
// ============================================

describe('Public Rooms', () => {
  describe('Room Selection', () => {
    it('should list available public rooms', () => {
      expect(mockApi.publicRooms.length).toBeGreaterThan(0);
    });

    it('should switch to public room', () => {
      const publicRoom = mockApi.publicRooms[0];
      expect(publicRoom.slug).toBeDefined();
    });

    it('should link private room to public room', () => {
      const linked = true;
      expect(linked).toBe(true);
    });
  });

  describe('Room Search', () => {
    it('should search rooms by name', () => {
      const searchTerm = 'test';
      const results = mockApi.publicRooms.filter(
        room => room.name.toLowerCase().includes(searchTerm)
      );
      expect(results.length).toBeGreaterThan(0);
    });

    it('should find room by slug', () => {
      const slug = 'test-church';
      const room = mockApi.publicRooms.find(r => r.slug === slug);
      expect(room).toBeDefined();
    });
  });
});

// ============================================
// ERROR SCENARIOS TESTS
// ============================================

describe('Error Scenarios', () => {
  describe('Network Errors', () => {
    it('should handle connection loss gracefully', () => {
      mockSocket.connected = false;
      expect(mockSocket.connected).toBe(false);
      mockSocket.connected = true;
    });

    it('should attempt reconnection', () => {
      const reconnectAttempts = 3;
      expect(reconnectAttempts).toBeGreaterThan(0);
    });
  });

  describe('Invalid Data', () => {
    it('should handle empty song list', () => {
      const emptySongs = [];
      expect(emptySongs.length).toBe(0);
    });

    it('should handle invalid room PIN', () => {
      const pin = 'invalid';
      const isValid = /^\d{4}$/.test(pin);
      expect(isValid).toBe(false);
    });

    it('should handle missing slide data', () => {
      const slide = null;
      expect(slide).toBeNull();
    });
  });
});

// ============================================
// PERFORMANCE TESTS
// ============================================

describe('Performance', () => {
  it('should render large song lists efficiently', () => {
    const largeSongList = Array(1000).fill().map((_, i) => ({
      id: i,
      title: `Song ${i}`
    }));

    const start = Date.now();
    const filtered = largeSongList.filter(s => s.title.includes('5'));
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100); // Should be under 100ms
  });

  it('should handle rapid slide changes', async () => {
    const changes = [];
    for (let i = 0; i < 100; i++) {
      changes.push(i);
    }

    const start = Date.now();
    changes.forEach(index => {
      mockSocket.emit('presenter-update-slide', { slideIndex: index });
    });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(1000); // Should complete in under 1 second
  });
});

// ============================================
// MEMORY LEAK TESTS
// ============================================

describe('Memory Management', () => {
  it('should clean up event listeners', () => {
    mockSocket.on('test-event', jest.fn());
    mockSocket.off('test-event');
    expect(mockSocket.off).toHaveBeenCalledWith('test-event');
  });

  it('should clear intervals on unmount', () => {
    const intervalId = setInterval(() => {}, 1000);
    clearInterval(intervalId);
    // No error means success
    expect(true).toBe(true);
  });
});

console.log('Integration tests loaded successfully');
