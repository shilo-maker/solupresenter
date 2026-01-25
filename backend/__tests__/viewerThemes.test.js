/**
 * Comprehensive Viewer Themes API Tests
 * Tests all viewer theme endpoints for SoluPresenter
 */

const request = require('supertest');
const express = require('express');
const { sequelize, User, ViewerTheme } = require('../models');

let app;
let authToken;
let otherUserToken;
let testUser;
let otherUser;
let testTheme;

// Helper function to create test app
const createTestApp = () => {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(express.urlencoded({ extended: true }));

  const authRoutes = require('../routes/auth');
  const viewerThemesRoutes = require('../routes/viewerThemes');

  testApp.use('/api/auth', authRoutes);
  testApp.use('/api/viewer-themes', viewerThemesRoutes);

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

    // Create test users
    testUser = await User.create({
      email: 'themetest@example.com',
      password: 'TestPassword123!',
      authProvider: 'local',
      isEmailVerified: true
    });

    otherUser = await User.create({
      email: 'otheruser@example.com',
      password: 'TestPassword123!',
      authProvider: 'local',
      isEmailVerified: true
    });

    // Login to get tokens
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'themetest@example.com', password: 'TestPassword123!' });
    authToken = loginRes.body.token;

    const otherLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'otheruser@example.com', password: 'TestPassword123!' });
    otherUserToken = otherLoginRes.body.token;

    // Seed the classic theme
    await ViewerTheme.seedClassicTheme();

  } catch (error) {
    console.error('Test setup failed:', error);
    throw error;
  }
});

afterAll(async () => {
  await sequelize.close();
});

// ============================================
// GET /api/viewer-themes TESTS
// ============================================

describe('GET /api/viewer-themes', () => {
  it('should return built-in themes for authenticated user', async () => {
    const res = await request(app)
      .get('/api/viewer-themes')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('themes');
    expect(Array.isArray(res.body.themes)).toBe(true);

    // Should have at least the Classic theme
    const classicTheme = res.body.themes.find(t => t.name === 'Classic');
    expect(classicTheme).toBeDefined();
    expect(classicTheme.isBuiltIn).toBe(true);
  });

  it('should return user\'s own themes', async () => {
    // Create a theme for the user
    testTheme = await ViewerTheme.create({
      name: 'My Custom Theme',
      createdById: testUser.id,
      isBuiltIn: false
    });

    const res = await request(app)
      .get('/api/viewer-themes')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const customTheme = res.body.themes.find(t => t.name === 'My Custom Theme');
    expect(customTheme).toBeDefined();
    expect(customTheme.isBuiltIn).toBe(false);
  });

  it('should not return other users themes', async () => {
    // Create a theme for other user
    await ViewerTheme.create({
      name: 'Other User Theme',
      createdById: otherUser.id,
      isBuiltIn: false
    });

    const res = await request(app)
      .get('/api/viewer-themes')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const otherTheme = res.body.themes.find(t => t.name === 'Other User Theme');
    expect(otherTheme).toBeUndefined();
  });

  it('should reject unauthenticated request', async () => {
    const res = await request(app)
      .get('/api/viewer-themes');

    expect([401, 403]).toContain(res.status);
  });
});

// ============================================
// GET /api/viewer-themes/default TESTS
// ============================================

describe('GET /api/viewer-themes/default', () => {
  it('should return Classic theme as default when no preference set', async () => {
    const res = await request(app)
      .get('/api/viewer-themes/default')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('defaultThemeId');
    expect(res.body).toHaveProperty('theme');
    expect(res.body.theme.name).toBe('Classic');
  });

  it('should return user\'s custom default when set', async () => {
    // Set custom theme as default
    await request(app)
      .post(`/api/viewer-themes/${testTheme.id}/set-default`)
      .set('Authorization', `Bearer ${authToken}`);

    const res = await request(app)
      .get('/api/viewer-themes/default')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.theme.name).toBe('My Custom Theme');
  });
});

// ============================================
// POST /api/viewer-themes/clear-default TESTS
// ============================================

describe('POST /api/viewer-themes/clear-default', () => {
  it('should clear user\'s default theme preference', async () => {
    const res = await request(app)
      .post('/api/viewer-themes/clear-default')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Default theme cleared');

    // Verify it's now returning Classic as default
    const defaultRes = await request(app)
      .get('/api/viewer-themes/default')
      .set('Authorization', `Bearer ${authToken}`);

    expect(defaultRes.body.theme.name).toBe('Classic');
  });
});

// ============================================
// GET /api/viewer-themes/:id TESTS
// ============================================

describe('GET /api/viewer-themes/:id', () => {
  it('should return theme by id', async () => {
    const res = await request(app)
      .get(`/api/viewer-themes/${testTheme.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.theme.name).toBe('My Custom Theme');
  });

  it('should return built-in theme to any user', async () => {
    const classicTheme = await ViewerTheme.findOne({ where: { isBuiltIn: true } });

    const res = await request(app)
      .get(`/api/viewer-themes/${classicTheme.id}`)
      .set('Authorization', `Bearer ${otherUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.theme.name).toBe('Classic');
  });

  it('should deny access to other user\'s private theme', async () => {
    const res = await request(app)
      .get(`/api/viewer-themes/${testTheme.id}`)
      .set('Authorization', `Bearer ${otherUserToken}`);

    expect(res.status).toBe(403);
  });

  it('should return 404 for non-existent theme', async () => {
    const res = await request(app)
      .get('/api/viewer-themes/00000000-0000-0000-0000-000000000999')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// POST /api/viewer-themes TESTS
// ============================================

describe('POST /api/viewer-themes', () => {
  it('should create a new theme with valid data', async () => {
    const res = await request(app)
      .post('/api/viewer-themes')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'New Theme',
        lineOrder: ['translation', 'original', 'transliteration'],
        lineStyles: {
          original: { fontSize: 110, fontWeight: '600', color: '#FFFF00', opacity: 1, visible: true },
          transliteration: { fontSize: 80, fontWeight: '400', color: '#00FF00', opacity: 0.9, visible: true },
          translation: { fontSize: 90, fontWeight: '500', color: '#FF0000', opacity: 0.95, visible: true }
        }
      });

    expect(res.status).toBe(201);
    expect(res.body.theme.name).toBe('New Theme');
    expect(res.body.theme.lineOrder).toEqual(['translation', 'original', 'transliteration']);
    expect(res.body.theme.lineStyles.original.fontSize).toBe(110);
  });

  it('should create theme with background boxes', async () => {
    const res = await request(app)
      .post('/api/viewer-themes')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Theme with Boxes',
        backgroundBoxes: [
          { id: 'box1', x: 10, y: 10, width: 80, height: 30, color: '#000000', opacity: 0.5, borderRadius: 10 }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.theme.backgroundBoxes).toHaveLength(1);
    expect(res.body.theme.backgroundBoxes[0].id).toBe('box1');
  });

  it('should create theme with WYSIWYG positions', async () => {
    const res = await request(app)
      .post('/api/viewer-themes')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'WYSIWYG Theme',
        linePositions: {
          original: { x: 10, y: 20, width: 80, height: 10 },
          transliteration: { x: 10, y: 35, width: 80, height: 10 },
          translation: { x: 10, y: 50, width: 80, height: 10 }
        },
        canvasDimensions: { width: 3840, height: 2160 }
      });

    expect(res.status).toBe(201);
    expect(res.body.theme.linePositions.original.x).toBe(10);
    expect(res.body.theme.canvasDimensions.width).toBe(3840);
  });

  it('should reject theme without name', async () => {
    const res = await request(app)
      .post('/api/viewer-themes')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        lineStyles: {}
      });

    expect(res.status).toBe(400);
  });

  it('should use default values when not provided', async () => {
    const res = await request(app)
      .post('/api/viewer-themes')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Minimal Theme'
      });

    expect(res.status).toBe(201);
    expect(res.body.theme.lineOrder).toEqual(['original', 'transliteration', 'translation']);
    expect(res.body.theme.canvasDimensions).toEqual({ width: 1920, height: 1080 });
  });
});

// ============================================
// PUT /api/viewer-themes/:id TESTS
// ============================================

describe('PUT /api/viewer-themes/:id', () => {
  it('should update own theme', async () => {
    const res = await request(app)
      .put(`/api/viewer-themes/${testTheme.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Updated Theme Name',
        lineStyles: {
          original: { fontSize: 130, fontWeight: '700', color: '#FFFFFF', opacity: 1, visible: true }
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.theme.name).toBe('Updated Theme Name');
    expect(res.body.theme.lineStyles.original.fontSize).toBe(130);
  });

  it('should reject update of built-in theme', async () => {
    const classicTheme = await ViewerTheme.findOne({ where: { isBuiltIn: true } });

    const res = await request(app)
      .put(`/api/viewer-themes/${classicTheme.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Hacked Classic'
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('built-in');
  });

  it('should reject update of other user\'s theme', async () => {
    const res = await request(app)
      .put(`/api/viewer-themes/${testTheme.id}`)
      .set('Authorization', `Bearer ${otherUserToken}`)
      .send({
        name: 'Hacked Theme'
      });

    expect(res.status).toBe(403);
  });

  it('should return 404 for non-existent theme', async () => {
    const res = await request(app)
      .put('/api/viewer-themes/00000000-0000-0000-0000-000000000999')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'New Name' });

    expect(res.status).toBe(404);
  });
});

// ============================================
// DELETE /api/viewer-themes/:id TESTS
// ============================================

describe('DELETE /api/viewer-themes/:id', () => {
  let themeToDelete;

  beforeEach(async () => {
    themeToDelete = await ViewerTheme.create({
      name: 'Theme To Delete',
      createdById: testUser.id,
      isBuiltIn: false
    });
  });

  it('should delete own theme', async () => {
    const res = await request(app)
      .delete(`/api/viewer-themes/${themeToDelete.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);

    // Verify it's deleted
    const deleted = await ViewerTheme.findByPk(themeToDelete.id);
    expect(deleted).toBeNull();
  });

  it('should clear default preference when deleting default theme', async () => {
    // Set as default
    await request(app)
      .post(`/api/viewer-themes/${themeToDelete.id}/set-default`)
      .set('Authorization', `Bearer ${authToken}`);

    // Delete it
    await request(app)
      .delete(`/api/viewer-themes/${themeToDelete.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    // Verify default is now classic
    const defaultRes = await request(app)
      .get('/api/viewer-themes/default')
      .set('Authorization', `Bearer ${authToken}`);

    expect(defaultRes.body.theme.name).toBe('Classic');
  });

  it('should reject deletion of built-in theme', async () => {
    const classicTheme = await ViewerTheme.findOne({ where: { isBuiltIn: true } });

    const res = await request(app)
      .delete(`/api/viewer-themes/${classicTheme.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(403);
  });

  it('should reject deletion of other user\'s theme', async () => {
    const res = await request(app)
      .delete(`/api/viewer-themes/${themeToDelete.id}`)
      .set('Authorization', `Bearer ${otherUserToken}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// POST /api/viewer-themes/:id/set-default TESTS
// ============================================

describe('POST /api/viewer-themes/:id/set-default', () => {
  it('should set own theme as default', async () => {
    const res = await request(app)
      .post(`/api/viewer-themes/${testTheme.id}/set-default`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.defaultThemeId).toBe(testTheme.id);
  });

  it('should set built-in theme as default', async () => {
    const classicTheme = await ViewerTheme.findOne({ where: { isBuiltIn: true } });

    const res = await request(app)
      .post(`/api/viewer-themes/${classicTheme.id}/set-default`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.defaultThemeId).toBe(classicTheme.id);
  });

  it('should reject setting other user\'s theme as default', async () => {
    const res = await request(app)
      .post(`/api/viewer-themes/${testTheme.id}/set-default`)
      .set('Authorization', `Bearer ${otherUserToken}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// POST /api/viewer-themes/:id/duplicate TESTS
// ============================================

describe('POST /api/viewer-themes/:id/duplicate', () => {
  it('should duplicate own theme', async () => {
    const res = await request(app)
      .post(`/api/viewer-themes/${testTheme.id}/duplicate`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Duplicated Theme' });

    expect(res.status).toBe(201);
    expect(res.body.theme.name).toBe('Duplicated Theme');
    expect(res.body.theme.isBuiltIn).toBe(false);
    expect(res.body.theme.id).not.toBe(testTheme.id);
  });

  it('should duplicate built-in theme', async () => {
    const classicTheme = await ViewerTheme.findOne({ where: { isBuiltIn: true } });

    const res = await request(app)
      .post(`/api/viewer-themes/${classicTheme.id}/duplicate`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'My Classic Copy' });

    expect(res.status).toBe(201);
    expect(res.body.theme.name).toBe('My Classic Copy');
    expect(res.body.theme.isBuiltIn).toBe(false);
    expect(res.body.theme.createdById).toBe(testUser.id);
  });

  it('should use default copy name when not provided', async () => {
    const res = await request(app)
      .post(`/api/viewer-themes/${testTheme.id}/duplicate`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.theme.name).toContain('(Copy)');
  });

  it('should reject duplicating other user\'s private theme', async () => {
    const res = await request(app)
      .post(`/api/viewer-themes/${testTheme.id}/duplicate`)
      .set('Authorization', `Bearer ${otherUserToken}`);

    expect(res.status).toBe(403);
  });

  it('should copy all theme properties', async () => {
    // Create a theme with all properties set
    const complexTheme = await ViewerTheme.create({
      name: 'Complex Theme',
      createdById: testUser.id,
      isBuiltIn: false,
      lineOrder: ['translation', 'original'],
      lineStyles: {
        original: { fontSize: 120, fontWeight: '700', color: '#FF0000', opacity: 1, visible: true }
      },
      positioning: { vertical: 'top', horizontal: 'left' },
      backgroundBoxes: [
        { id: 'box1', x: 0, y: 0, width: 100, height: 50, color: '#000', opacity: 0.5, borderRadius: 0 }
      ]
    });

    const res = await request(app)
      .post(`/api/viewer-themes/${complexTheme.id}/duplicate`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Complex Copy' });

    expect(res.status).toBe(201);
    expect(res.body.theme.lineOrder).toEqual(['translation', 'original']);
    expect(res.body.theme.lineStyles.original.fontSize).toBe(120);
    expect(res.body.theme.positioning.vertical).toBe('top');
    expect(res.body.theme.backgroundBoxes).toHaveLength(1);
  });
});

// ============================================
// EDGE CASES AND SECURITY TESTS
// ============================================

describe('Edge Cases and Security', () => {
  it('should handle very long theme names', async () => {
    const longName = 'A'.repeat(255);

    const res = await request(app)
      .post('/api/viewer-themes')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: longName });

    // Should either succeed with truncation or return an error
    expect([201, 400, 500]).toContain(res.status);
  });

  it('should handle special characters in theme name', async () => {
    const res = await request(app)
      .post('/api/viewer-themes')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Theme <script>alert("xss")</script>' });

    expect(res.status).toBe(201);
    // Name should be stored (not sanitized, but output should be escaped by frontend)
    expect(res.body.theme.name).toContain('script');
  });

  it('should handle Hebrew theme names', async () => {
    const res = await request(app)
      .post('/api/viewer-themes')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'עיצוב בעברית' });

    expect(res.status).toBe(201);
    expect(res.body.theme.name).toBe('עיצוב בעברית');
  });

  it('should handle invalid UUID in path', async () => {
    const res = await request(app)
      .get('/api/viewer-themes/not-a-uuid')
      .set('Authorization', `Bearer ${authToken}`);

    expect([400, 404, 500]).toContain(res.status);
  });

  it('should handle concurrent theme creation', async () => {
    const promises = Array.from({ length: 5 }, (_, i) =>
      request(app)
        .post('/api/viewer-themes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: `Concurrent Theme ${i}` })
    );

    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.status === 201).length;
    expect(successCount).toBe(5);
  });
});

console.log('Viewer Themes API tests loaded successfully');
