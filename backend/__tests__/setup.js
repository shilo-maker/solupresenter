// Test setup file
require('dotenv').config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.SESSION_SECRET = 'test-session-secret';

// Increase timeout for database operations
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  generateRandomEmail: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@test.com`,
  generateRandomPin: () => Math.floor(1000 + Math.random() * 9000).toString(),
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

// Suppress console logs during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
// };
