/**
 * Comprehensive Middleware and Utility Tests
 * Tests auth middleware, cleanup jobs, and utility functions
 */

const jwt = require('jsonwebtoken');
const { sequelize, User, Room, Setlist } = require('../models');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const cleanupTemporarySetlists = require('../jobs/cleanupTemporarySetlists');
const cleanupExpiredRooms = require('../jobs/cleanupExpiredRooms');

// Mock Express request/response objects
const mockRequest = (headers = {}, user = null) => ({
  headers,
  user
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

// ============================================
// TEST SETUP AND TEARDOWN
// ============================================

beforeAll(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ force: true });
  } catch (error) {
    console.error('Test setup failed:', error);
    throw error;
  }
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================
// AUTHENTICATE TOKEN MIDDLEWARE TESTS
// ============================================

describe('authenticateToken Middleware', () => {
  let testUser;
  let validToken;

  beforeAll(async () => {
    testUser = await User.create({
      email: 'middleware@example.com',
      password: 'TestPassword123!',
      authProvider: 'local',
      isEmailVerified: true
    });

    validToken = jwt.sign(
      { userId: testUser.id },
      process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing',
      { expiresIn: '1h' }
    );
  });

  it('should allow request with valid token', async () => {
    const req = mockRequest({
      authorization: `Bearer ${validToken}`
    });
    const res = mockResponse();

    await authenticateToken(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(testUser.id);
  });

  it('should reject request without token', async () => {
    const req = mockRequest({});
    const res = mockResponse();

    await authenticateToken(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access token required' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject request with invalid token', async () => {
    const req = mockRequest({
      authorization: 'Bearer invalid-token'
    });
    const res = mockResponse();

    await authenticateToken(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject request with expired token', async () => {
    const expiredToken = jwt.sign(
      { userId: testUser.id },
      process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing',
      { expiresIn: '-1h' } // Already expired
    );

    const req = mockRequest({
      authorization: `Bearer ${expiredToken}`
    });
    const res = mockResponse();

    await authenticateToken(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject request with malformed authorization header', async () => {
    const req = mockRequest({
      authorization: 'NotBearer token'
    });
    const res = mockResponse();

    await authenticateToken(req, res, mockNext);

    // The middleware extracts token after splitting by space and tries to verify it
    // Since 'token' is not a valid JWT, it returns 403 (invalid/expired token)
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject request with non-existent user in token', async () => {
    const tokenForNonExistentUser = jwt.sign(
      { userId: '00000000-0000-0000-0000-000000000999' },
      process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing',
      { expiresIn: '1h' }
    );

    const req = mockRequest({
      authorization: `Bearer ${tokenForNonExistentUser}`
    });
    const res = mockResponse();

    await authenticateToken(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should handle Bearer prefix case-insensitively', async () => {
    // Note: The actual middleware splits by space and takes second part,
    // so it doesn't validate the 'Bearer' prefix. This test verifies current behavior.
    const req = mockRequest({
      authorization: `bearer ${validToken}` // lowercase
    });
    const res = mockResponse();

    await authenticateToken(req, res, mockNext);

    // Since the middleware just splits by space, lowercase 'bearer' works the same
    // The token is valid so the request succeeds
    expect(mockNext).toHaveBeenCalled();
  });
});

// ============================================
// IS ADMIN MIDDLEWARE TESTS
// ============================================

describe('isAdmin Middleware', () => {
  it('should allow request from admin user', () => {
    const req = mockRequest({}, { role: 'admin' });
    const res = mockResponse();

    isAdmin(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should reject request from operator user', () => {
    const req = mockRequest({}, { role: 'operator' });
    const res = mockResponse();

    isAdmin(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject request with undefined role', () => {
    const req = mockRequest({}, { role: undefined });
    const res = mockResponse();

    isAdmin(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should reject request with null role', () => {
    const req = mockRequest({}, { role: null });
    const res = mockResponse();

    isAdmin(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ============================================
// CLEANUP TEMPORARY SETLISTS JOB TESTS
// ============================================

describe('cleanupTemporarySetlists Job', () => {
  let testUser;

  beforeAll(async () => {
    testUser = await User.create({
      email: 'cleanup@example.com',
      password: 'TestPassword123!',
      authProvider: 'local'
    });
  });

  beforeEach(async () => {
    // Clear rooms and setlists before each test
    await Setlist.destroy({ where: {} });
    await Room.destroy({ where: {} });
  });

  it('should delete temporary setlists without linked room', async () => {
    // Create orphaned temporary setlist (no linkedRoomId)
    await Setlist.create({
      name: 'Orphaned Setlist',
      createdById: testUser.id,
      items: [],
      isTemporary: true,
      linkedRoomId: null
    });

    await cleanupTemporarySetlists();

    const remaining = await Setlist.findAll({ where: { isTemporary: true } });
    expect(remaining).toHaveLength(0);
  });

  it('should delete temporary setlists with inactive linked room', async () => {
    // Create inactive room
    const inactiveRoom = await Room.create({
      pin: 'INAC',
      operatorId: testUser.id,
      isActive: false
    });

    // Create temporary setlist linked to inactive room
    await Setlist.create({
      name: 'Linked to Inactive',
      createdById: testUser.id,
      items: [],
      isTemporary: true,
      linkedRoomId: inactiveRoom.id
    });

    await cleanupTemporarySetlists();

    const remaining = await Setlist.findAll({ where: { isTemporary: true } });
    expect(remaining).toHaveLength(0);
  });

  it('should keep temporary setlists with active linked room', async () => {
    // Create active room
    const activeRoom = await Room.create({
      pin: 'ACTV',
      operatorId: testUser.id,
      isActive: true
    });

    // Create temporary setlist linked to active room
    await Setlist.create({
      name: 'Linked to Active',
      createdById: testUser.id,
      items: [],
      isTemporary: true,
      linkedRoomId: activeRoom.id
    });

    await cleanupTemporarySetlists();

    const remaining = await Setlist.findAll({ where: { isTemporary: true } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].name).toBe('Linked to Active');
  });

  it('should not affect permanent setlists', async () => {
    // Create permanent setlist
    await Setlist.create({
      name: 'Permanent Setlist',
      createdById: testUser.id,
      items: [],
      isTemporary: false
    });

    await cleanupTemporarySetlists();

    const remaining = await Setlist.findAll({ where: { isTemporary: false } });
    expect(remaining).toHaveLength(1);
  });

  it('should handle no temporary setlists gracefully', async () => {
    // No setlists created
    await expect(cleanupTemporarySetlists()).resolves.not.toThrow();
  });

  it('should handle multiple orphaned setlists', async () => {
    // Create 5 orphaned setlists
    for (let i = 0; i < 5; i++) {
      await Setlist.create({
        name: `Orphaned ${i}`,
        createdById: testUser.id,
        items: [],
        isTemporary: true,
        linkedRoomId: null
      });
    }

    await cleanupTemporarySetlists();

    const remaining = await Setlist.findAll({ where: { isTemporary: true } });
    expect(remaining).toHaveLength(0);
  });
});

// ============================================
// CLEANUP EXPIRED ROOMS JOB TESTS
// ============================================

describe('cleanupExpiredRooms Job', () => {
  let testUser;

  beforeAll(async () => {
    testUser = await User.create({
      email: 'roomcleanup@example.com',
      password: 'TestPassword123!',
      authProvider: 'local'
    });
  });

  beforeEach(async () => {
    await Setlist.destroy({ where: {} });
    await Room.destroy({ where: {} });
  });

  it('should delete expired rooms', async () => {
    // Create expired room (expiresAt in the past)
    await Room.create({
      pin: 'EXPR',
      operatorId: testUser.id,
      isActive: true,
      expiresAt: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
    });

    await cleanupExpiredRooms();

    const remaining = await Room.findAll({});
    expect(remaining).toHaveLength(0);
  });

  it('should keep non-expired rooms', async () => {
    // Create non-expired room (expiresAt in the future)
    await Room.create({
      pin: 'KEEP',
      operatorId: testUser.id,
      isActive: true,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
    });

    await cleanupExpiredRooms();

    const remaining = await Room.findAll({});
    expect(remaining).toHaveLength(1);
    expect(remaining[0].pin).toBe('KEEP');
  });

  it('should delete temporary setlist when room expires', async () => {
    // Create expired room with temporary setlist
    const setlist = await Setlist.create({
      name: 'Temp Setlist',
      createdById: testUser.id,
      items: [],
      isTemporary: true
    });

    await Room.create({
      pin: 'EXPS',
      operatorId: testUser.id,
      isActive: true,
      temporarySetlistId: setlist.id,
      expiresAt: new Date(Date.now() - 60 * 60 * 1000)
    });

    await cleanupExpiredRooms();

    const remainingSetlists = await Setlist.findAll({ where: { isTemporary: true } });
    expect(remainingSetlists).toHaveLength(0);
  });

  it('should handle multiple expired rooms', async () => {
    // Create 3 expired rooms
    for (let i = 0; i < 3; i++) {
      await Room.create({
        pin: `EXP${i}`,
        operatorId: testUser.id,
        isActive: true,
        expiresAt: new Date(Date.now() - (i + 1) * 60 * 60 * 1000)
      });
    }

    // Create 2 non-expired rooms
    for (let i = 0; i < 2; i++) {
      await Room.create({
        pin: `KEP${i}`,
        operatorId: testUser.id,
        isActive: true,
        expiresAt: new Date(Date.now() + (i + 1) * 60 * 60 * 1000)
      });
    }

    await cleanupExpiredRooms();

    const remaining = await Room.findAll({});
    expect(remaining).toHaveLength(2);
  });

  it('should handle no expired rooms gracefully', async () => {
    // Create only non-expired room
    await Room.create({
      pin: 'NOEX',
      operatorId: testUser.id,
      isActive: true,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });

    await expect(cleanupExpiredRooms()).resolves.not.toThrow();

    const remaining = await Room.findAll({});
    expect(remaining).toHaveLength(1);
  });

  it('should handle rooms with no temporary setlist', async () => {
    await Room.create({
      pin: 'NSET',
      operatorId: testUser.id,
      isActive: true,
      temporarySetlistId: null,
      expiresAt: new Date(Date.now() - 60 * 60 * 1000)
    });

    await expect(cleanupExpiredRooms()).resolves.not.toThrow();

    const remaining = await Room.findAll({});
    expect(remaining).toHaveLength(0);
  });
});

// ============================================
// UTILITY FUNCTION TESTS
// ============================================

describe('Utility Functions', () => {
  describe('PIN Generation', () => {
    const generatePin = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude I, O, 0, 1 for clarity
      let pin = '';
      for (let i = 0; i < 4; i++) {
        pin += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return pin;
    };

    it('should generate 4-character PINs', () => {
      for (let i = 0; i < 100; i++) {
        const pin = generatePin();
        expect(pin).toHaveLength(4);
      }
    });

    it('should generate unique PINs', () => {
      const pins = new Set();
      for (let i = 0; i < 100; i++) {
        pins.add(generatePin());
      }
      // Most should be unique (statistically)
      expect(pins.size).toBeGreaterThan(90);
    });

    it('should only contain valid characters', () => {
      const validChars = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/;
      for (let i = 0; i < 100; i++) {
        const pin = generatePin();
        expect(pin).toMatch(validChars);
      }
    });

    it('should not contain confusing characters (0, O, 1, I)', () => {
      for (let i = 0; i < 100; i++) {
        const pin = generatePin();
        expect(pin).not.toMatch(/[0O1I]/);
      }
    });
  });

  describe('Email Validation', () => {
    const isValidEmail = (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    it('should validate correct emails', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.org',
        'user+tag@example.co.uk',
        'name123@test.io'
      ];

      validEmails.forEach(email => {
        expect(isValidEmail(email)).toBe(true);
      });
    });

    it('should reject invalid emails', () => {
      const invalidEmails = [
        'not-an-email',
        '@domain.com',
        'user@',
        'user@domain',
        'user name@domain.com',
        ''
      ];

      invalidEmails.forEach(email => {
        expect(isValidEmail(email)).toBe(false);
      });
    });
  });

  describe('Slug Generation', () => {
    const generateSlug = (name) => {
      return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 50);
    };

    it('should convert to lowercase', () => {
      expect(generateSlug('My Church')).toBe('my-church');
    });

    it('should replace spaces with hyphens', () => {
      expect(generateSlug('first second third')).toBe('first-second-third');
    });

    it('should remove special characters', () => {
      // The function removes special chars, replaces spaces with hyphens,
      // then collapses multiple hyphens into one
      expect(generateSlug('Church & Ministry!')).toBe('church-ministry');
    });

    it('should handle multiple spaces', () => {
      expect(generateSlug('too   many   spaces')).toBe('too-many-spaces');
    });

    it('should truncate long slugs', () => {
      const longName = 'a'.repeat(100);
      expect(generateSlug(longName).length).toBe(50);
    });

    it('should handle Hebrew characters', () => {
      const result = generateSlug('קהילה שלום');
      expect(result).toBe('-'); // Hebrew removed, spaces become hyphens
    });
  });

  describe('Password Strength', () => {
    const isStrongPassword = (password) => {
      if (password.length < 8) return false;
      if (!/[a-z]/.test(password)) return false;
      if (!/[A-Z]/.test(password)) return false;
      if (!/[0-9]/.test(password)) return false;
      return true;
    };

    it('should accept strong passwords', () => {
      expect(isStrongPassword('Password123')).toBe(true);
      expect(isStrongPassword('SecurePass1')).toBe(true);
      expect(isStrongPassword('MyP@ssw0rd')).toBe(true);
    });

    it('should reject weak passwords', () => {
      expect(isStrongPassword('password')).toBe(false); // no uppercase, no number
      expect(isStrongPassword('PASSWORD1')).toBe(false); // no lowercase
      expect(isStrongPassword('Pass1')).toBe(false); // too short
      expect(isStrongPassword('12345678')).toBe(false); // no letters
    });
  });
});

// ============================================
// RATE LIMITING SIMULATION TESTS
// ============================================

describe('Rate Limiting Behavior', () => {
  it('should simulate rate limiting logic', () => {
    const rateLimitStore = new Map();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 5;

    const checkRateLimit = (ip) => {
      const now = Date.now();
      const record = rateLimitStore.get(ip) || { count: 0, startTime: now };

      // Reset if window expired
      if (now - record.startTime > windowMs) {
        record.count = 0;
        record.startTime = now;
      }

      record.count++;
      rateLimitStore.set(ip, record);

      return record.count <= maxRequests;
    };

    const testIp = '127.0.0.1';

    // First 5 requests should pass
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(testIp)).toBe(true);
    }

    // 6th request should fail
    expect(checkRateLimit(testIp)).toBe(false);

    // Different IP should work
    expect(checkRateLimit('192.168.1.1')).toBe(true);
  });
});

// ============================================
// TOKEN GENERATION TESTS
// ============================================

describe('Token Generation', () => {
  const generateVerificationToken = () => {
    return require('crypto').randomBytes(32).toString('hex');
  };

  it('should generate unique tokens', () => {
    const tokens = new Set();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateVerificationToken());
    }
    expect(tokens.size).toBe(100);
  });

  it('should generate 64-character hex tokens', () => {
    for (let i = 0; i < 10; i++) {
      const token = generateVerificationToken();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]+$/);
    }
  });
});

console.log('Middleware tests loaded successfully');
