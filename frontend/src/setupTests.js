// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Global mocks for all tests

// Mock socket.io-client
jest.mock('socket.io-client', () => {
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
    id: 'test-socket-id',
    trigger: (event, data) => {
      if (mockSocket._callbacks && mockSocket._callbacks[event]) {
        mockSocket._callbacks[event](data);
      }
    }
  };
  return jest.fn(() => mockSocket);
});

// Mock axios
jest.mock('axios', () => ({
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
}));

// Suppress console errors during tests (for cleaner output)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    // Ignore specific React warnings during tests
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning:') || args[0].includes('act(...)'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
