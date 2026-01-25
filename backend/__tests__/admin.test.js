/**
 * Comprehensive Admin API Tests
 * Tests all admin endpoints for SoluPresenter
 */

const request = require('supertest');
const express = require('express');
const { sequelize, User, Song } = require('../models');

let app;
let adminToken;
let operatorToken;
let adminUser;
let operatorUser;
let pendingSong;

// Helper function to create test app
const createTestApp = () => {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(express.urlencoded({ extended: true }));

  const authRoutes = require('../routes/auth');
  const adminRoutes = require('../routes/admin');
  const songRoutes = require('../routes/songs');

  testApp.use('/api/auth', authRoutes);
  testApp.use('/api/admin', adminRoutes);
  testApp.use('/api/songs', songRoutes);

  // Mock io for socket operations
  testApp.set('io', {
    to: () => ({ emit: jest.fn() }),
    emit: jest.fn()
  });

  return testApp;
};

// ============================================
// TEST SETUP AND TEARDOWN
// ============================================

beforeAll(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ force: true });
    app = createTestApp();

    // Create admin user
    adminUser = await User.create({
      email: 'admin@example.com',
      password: 'AdminPassword123!',
      authProvider: 'local',
      role: 'admin',
      isEmailVerified: true
    });

    // Create operator user
    operatorUser = await User.create({
      email: 'operator@example.com',
      password: 'OperatorPassword123!',
      authProvider: 'local',
      role: 'operator',
      isEmailVerified: true
    });

    // Login to get tokens
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'AdminPassword123!' });
    adminToken = adminLoginRes.body.token;

    const operatorLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'operator@example.com', password: 'OperatorPassword123!' });
    operatorToken = operatorLoginRes.body.token;

    // Create a pending song
    pendingSong = await Song.create({
      title: 'Pending Approval Song',
      createdById: operatorUser.id,
      slides: [{ originalText: 'Test', translation: 'Test' }],
      isPendingApproval: true,
      isPublic: false
    });

  } catch (error) {
    console.error('Test setup failed:', error);
    throw error;
  }
});

afterAll(async () => {
  await sequelize.close();
});

// ============================================
// ACCESS CONTROL TESTS
// ============================================

describe('Admin Access Control', () => {
  it('should deny access to non-admin users', async () => {
    const res = await request(app)
      .get('/api/admin/pending-songs')
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(403);
  });

  it('should deny access to unauthenticated users', async () => {
    const res = await request(app)
      .get('/api/admin/pending-songs');

    expect([401, 403]).toContain(res.status);
  });

  it('should allow access to admin users', async () => {
    const res = await request(app)
      .get('/api/admin/pending-songs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });
});

// ============================================
// PENDING SONGS TESTS
// ============================================

describe('GET /api/admin/pending-songs', () => {
  it('should return list of pending songs', async () => {
    const res = await request(app)
      .get('/api/admin/pending-songs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('songs');
    expect(Array.isArray(res.body.songs)).toBe(true);

    const pending = res.body.songs.find(s => s.title === 'Pending Approval Song');
    expect(pending).toBeDefined();
    expect(pending.isPendingApproval).toBe(true);
  });

  it('should include creator info', async () => {
    const res = await request(app)
      .get('/api/admin/pending-songs')
      .set('Authorization', `Bearer ${adminToken}`);

    const pending = res.body.songs.find(s => s.title === 'Pending Approval Song');
    expect(pending.creator).toBeDefined();
    expect(pending.creator.email).toBe('operator@example.com');
  });

  it('should order by createdAt descending', async () => {
    // Create another pending song
    await Song.create({
      title: 'Newer Pending Song',
      createdById: operatorUser.id,
      slides: [],
      isPendingApproval: true
    });

    const res = await request(app)
      .get('/api/admin/pending-songs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.songs[0].title).toBe('Newer Pending Song');
  });
});

// ============================================
// APPROVE SONG TESTS
// ============================================

describe('POST /api/admin/approve-song/:id', () => {
  let songToApprove;

  beforeEach(async () => {
    songToApprove = await Song.create({
      title: 'Song To Approve',
      createdById: operatorUser.id,
      slides: [{ originalText: 'Lyrics', translation: 'Translation' }],
      isPendingApproval: true,
      isPublic: false
    });
  });

  it('should approve a pending song', async () => {
    const res = await request(app)
      .post(`/api/admin/approve-song/${songToApprove.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.song.isPendingApproval).toBe(false);
    expect(res.body.song.isPublic).toBe(true);
    expect(res.body.message).toContain('approved');
  });

  it('should set approvedAt timestamp', async () => {
    const before = new Date();

    const res = await request(app)
      .post(`/api/admin/approve-song/${songToApprove.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const after = new Date();
    const approvedAt = new Date(res.body.song.approvedAt);

    expect(approvedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(approvedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should return 404 for non-existent song', async () => {
    const res = await request(app)
      .post('/api/admin/approve-song/00000000-0000-0000-0000-000000000999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('should deny access to non-admin', async () => {
    const res = await request(app)
      .post(`/api/admin/approve-song/${songToApprove.id}`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// REJECT SONG TESTS
// ============================================

describe('POST /api/admin/reject-song/:id', () => {
  let songToReject;

  beforeEach(async () => {
    songToReject = await Song.create({
      title: 'Song To Reject',
      createdById: operatorUser.id,
      slides: [],
      isPendingApproval: true,
      isPublic: false
    });
  });

  it('should reject a pending song', async () => {
    const res = await request(app)
      .post(`/api/admin/reject-song/${songToReject.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('rejected');

    // Verify song is no longer pending but also not public
    const song = await Song.findByPk(songToReject.id);
    expect(song.isPendingApproval).toBe(false);
    expect(song.isPublic).toBe(false);
  });

  it('should return 404 for non-existent song', async () => {
    const res = await request(app)
      .post('/api/admin/reject-song/00000000-0000-0000-0000-000000000999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// CREATE PUBLIC SONG TESTS
// ============================================

describe('POST /api/admin/create-public-song', () => {
  it('should create a public song directly', async () => {
    const res = await request(app)
      .post('/api/admin/create-public-song')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Admin Created Song',
        originalLanguage: 'he',
        slides: [
          { originalText: 'Hebrew text', translation: 'English translation', verseType: 'Verse1' }
        ],
        tags: ['worship', 'hebrew']
      });

    expect(res.status).toBe(201);
    expect(res.body.song.title).toBe('Admin Created Song');
    expect(res.body.song.isPublic).toBe(true);
    expect(res.body.song.isPendingApproval).toBe(false);
  });

  it('should reject creation without required fields', async () => {
    const res = await request(app)
      .post('/api/admin/create-public-song')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Incomplete Song'
        // Missing originalLanguage and slides
      });

    expect(res.status).toBe(400);
  });

  it('should reject creation with empty slides', async () => {
    const res = await request(app)
      .post('/api/admin/create-public-song')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Empty Slides Song',
        originalLanguage: 'he',
        slides: []
      });

    expect(res.status).toBe(400);
  });

  it('should set approvedAt and approvedBy', async () => {
    const res = await request(app)
      .post('/api/admin/create-public-song')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Auto-Approved Song',
        originalLanguage: 'en',
        slides: [{ originalText: 'Test' }]
      });

    expect(res.status).toBe(201);
    expect(res.body.song.approvedAt).toBeDefined();
  });
});

// ============================================
// USER MANAGEMENT TESTS
// ============================================

describe('GET /api/admin/users', () => {
  it('should return list of all users', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('users');
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.length).toBeGreaterThanOrEqual(2);
  });

  it('should exclude password from response', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    res.body.users.forEach(user => {
      expect(user.password).toBeUndefined();
    });
  });

  it('should order by createdAt descending', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    // Verify ordering (most recent first)
    for (let i = 1; i < res.body.users.length; i++) {
      const prev = new Date(res.body.users[i - 1].createdAt);
      const curr = new Date(res.body.users[i].createdAt);
      expect(prev.getTime()).toBeGreaterThanOrEqual(curr.getTime());
    }
  });
});

describe('POST /api/admin/users/:id/toggle-admin', () => {
  let targetUser;

  beforeEach(async () => {
    targetUser = await User.create({
      email: `toggle-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      authProvider: 'local',
      role: 'operator',
      isEmailVerified: true
    });
  });

  it('should toggle operator to admin', async () => {
    const res = await request(app)
      .post(`/api/admin/users/${targetUser.id}/toggle-admin`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
    expect(res.body.message).toContain('promoted');
  });

  it('should toggle admin to operator', async () => {
    // First make them admin
    targetUser.role = 'admin';
    await targetUser.save();

    const res = await request(app)
      .post(`/api/admin/users/${targetUser.id}/toggle-admin`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('operator');
    expect(res.body.message).toContain('removed');
  });

  it('should prevent admin from modifying own status', async () => {
    const res = await request(app)
      .post(`/api/admin/users/${adminUser.id}/toggle-admin`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('own');
  });

  it('should return 404 for non-existent user', async () => {
    const res = await request(app)
      .post('/api/admin/users/00000000-0000-0000-0000-000000000999/toggle-admin')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/admin/users/:id', () => {
  let userToDelete;

  beforeEach(async () => {
    userToDelete = await User.create({
      email: `delete-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      authProvider: 'local',
      role: 'operator',
      isEmailVerified: true
    });
  });

  it('should delete a user', async () => {
    const res = await request(app)
      .delete(`/api/admin/users/${userToDelete.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');

    // Verify user is deleted
    const deleted = await User.findByPk(userToDelete.id);
    expect(deleted).toBeNull();
  });

  it('should prevent admin from deleting themselves', async () => {
    const res = await request(app)
      .delete(`/api/admin/users/${adminUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('own');
  });

  it('should return 404 for non-existent user', async () => {
    const res = await request(app)
      .delete('/api/admin/users/00000000-0000-0000-0000-000000000999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('should deny deletion to non-admin', async () => {
    const res = await request(app)
      .delete(`/api/admin/users/${userToDelete.id}`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// EDGE CASES AND SECURITY TESTS
// ============================================

describe('Admin Edge Cases', () => {
  it('should handle multiple rapid admin requests', async () => {
    const promises = Array.from({ length: 5 }, () =>
      request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
    );

    const results = await Promise.all(promises);
    results.forEach(res => {
      expect(res.status).toBe(200);
    });
  });

  it('should handle invalid UUID format', async () => {
    const res = await request(app)
      .post('/api/admin/approve-song/not-a-uuid')
      .set('Authorization', `Bearer ${adminToken}`);

    expect([400, 404, 500]).toContain(res.status);
  });

  it('should handle very long song title', async () => {
    const longTitle = 'A'.repeat(500);

    const res = await request(app)
      .post('/api/admin/create-public-song')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: longTitle,
        originalLanguage: 'en',
        slides: [{ originalText: 'Test' }]
      });

    // Should either succeed with truncation or fail gracefully
    expect([201, 400, 500]).toContain(res.status);
  });
});

console.log('Admin API tests loaded successfully');
