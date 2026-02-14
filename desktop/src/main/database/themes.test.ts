import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock database state
let mockDb: any = null;
let mockData: {
  viewer_themes: any[];
  display_theme_overrides: any[];
} = {
  viewer_themes: [],
  display_theme_overrides: []
};

// Mock the database index module
vi.mock('./index', () => {
  return {
    CLASSIC_THEME_ID: '00000000-0000-0000-0000-000000000001',
    getDb: () => mockDb,
    saveDatabase: vi.fn(),
    createBackup: vi.fn(),
    generateId: () => `test-id-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    queryAll: (sql: string, _params: any[] = []) => {
      if (!mockDb) return [];

      if (sql.includes('viewer_themes')) {
        // Return all themes sorted by isBuiltIn DESC, name ASC
        return [...mockData.viewer_themes].sort((a, b) => {
          if (b.isBuiltIn !== a.isBuiltIn) return b.isBuiltIn - a.isBuiltIn;
          return a.name.localeCompare(b.name);
        });
      }
      return [];
    },
    queryOne: (sql: string, params: any[] = []) => {
      if (!mockDb) return null;

      if (sql.includes('viewer_themes')) {
        if (sql.includes('WHERE id = ?')) {
          return mockData.viewer_themes.find(t => t.id === params[0]) || null;
        }
        if (sql.includes('WHERE isDefault = 1')) {
          return mockData.viewer_themes.find(t => t.isDefault === 1) || null;
        }
      }
      return null;
    }
  };
});

// Import functions after mocking
import {
  getThemes,
  getTheme,
  getDefaultTheme,
  createTheme,
  updateTheme,
  deleteTheme
} from './themes';

describe('themes database functions', () => {
  beforeEach(() => {
    mockDb = {
      run: vi.fn((sql: string, params?: any[]) => {
        // Simulate INSERT operations
        if (sql.includes('INSERT INTO viewer_themes')) {
          const [id, name, lineOrder, lineStyles, positioning, container, viewerBackground, linePositions, canvasDimensions, backgroundBoxes, createdAt, updatedAt] = params || [];
          mockData.viewer_themes.push({
            id,
            name,
            isBuiltIn: 0,
            isDefault: 0,
            lineOrder: lineOrder ? JSON.parse(lineOrder) : null,
            lineStyles: lineStyles ? JSON.parse(lineStyles) : null,
            positioning: positioning ? JSON.parse(positioning) : null,
            container: container ? JSON.parse(container) : null,
            viewerBackground: viewerBackground ? JSON.parse(viewerBackground) : null,
            linePositions: linePositions ? JSON.parse(linePositions) : null,
            canvasDimensions: canvasDimensions ? JSON.parse(canvasDimensions) : null,
            backgroundBoxes: backgroundBoxes ? JSON.parse(backgroundBoxes) : null,
            createdAt,
            updatedAt
          });
        }
        // Simulate UPDATE operations
        if (sql.includes('UPDATE viewer_themes SET')) {
          // The last param is always the id (WHERE id = ?)
          const id = params?.[params.length - 1];
          const theme = mockData.viewer_themes.find(t => t.id === id);
          if (theme) {
            // Parse the SET clause to figure out which fields are being updated
            const setClause = sql.match(/SET (.+) WHERE/)?.[1] || '';
            const fields = setClause.split(',').map(f => f.trim().split(' = ')[0]);
            let paramIdx = 0;
            for (const field of fields) {
              if (params && paramIdx < params.length - 1) {
                const value = params[paramIdx];
                if (['lineOrder', 'lineStyles', 'positioning', 'container', 'viewerBackground', 'linePositions', 'canvasDimensions', 'backgroundBoxes'].includes(field)) {
                  theme[field] = value ? JSON.parse(value) : null;
                } else {
                  theme[field] = value;
                }
                paramIdx++;
              }
            }
          }
        }
        // Simulate DELETE operations
        if (sql.includes('DELETE FROM viewer_themes WHERE id = ?')) {
          const [id] = params || [];
          mockData.viewer_themes = mockData.viewer_themes.filter(t => t.id !== id);
        }
        if (sql.includes('DELETE FROM display_theme_overrides WHERE themeId = ?')) {
          const [themeId] = params || [];
          mockData.display_theme_overrides = mockData.display_theme_overrides.filter(o => o.themeId !== themeId);
        }
      }),
      exec: vi.fn()
    };
    mockData = {
      viewer_themes: [],
      display_theme_overrides: []
    };
  });

  afterEach(() => {
    mockDb = null;
    vi.clearAllMocks();
  });

  // ─── Helper: seed a theme directly into mock data ────────────────────
  function seedTheme(overrides: Partial<any> = {}): any {
    const theme = {
      id: overrides.id || `seed-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name: overrides.name || 'Seeded Theme',
      isBuiltIn: overrides.isBuiltIn ?? 0,
      isDefault: overrides.isDefault ?? 0,
      lineOrder: overrides.lineOrder || ['original', 'transliteration', 'translation'],
      lineStyles: overrides.lineStyles || { original: { fontSize: 100 } },
      positioning: overrides.positioning || { vertical: 'center', horizontal: 'center' },
      container: overrides.container || { maxWidth: '100%' },
      viewerBackground: overrides.viewerBackground || { type: 'inherit', color: null },
      linePositions: overrides.linePositions || null,
      canvasDimensions: overrides.canvasDimensions || { width: 1920, height: 1080 },
      backgroundBoxes: overrides.backgroundBoxes || null,
      createdAt: overrides.createdAt || new Date().toISOString(),
      updatedAt: overrides.updatedAt || new Date().toISOString()
    };
    mockData.viewer_themes.push(theme);
    return theme;
  }

  // ═════════════════════════════════════════════════════════════════════
  //  getThemes
  // ═════════════════════════════════════════════════════════════════════
  describe('getThemes', () => {
    it('should return all themes', async () => {
      seedTheme({ name: 'Alpha' });
      seedTheme({ name: 'Beta' });
      seedTheme({ name: 'Gamma' });

      const themes = await getThemes();

      expect(themes).toHaveLength(3);
    });

    it('should return themes ordered by isBuiltIn DESC, name ASC', async () => {
      seedTheme({ name: 'Zebra', isBuiltIn: 0 });
      seedTheme({ name: 'Alpha', isBuiltIn: 1 });
      seedTheme({ name: 'Beta', isBuiltIn: 0 });

      const themes = await getThemes();

      // Built-in first, then alphabetical within each group
      expect(themes[0].name).toBe('Alpha');
      expect(themes[0].isBuiltIn).toBe(1);
      expect(themes[1].name).toBe('Beta');
      expect(themes[2].name).toBe('Zebra');
    });

    it('should return empty array when no themes exist', async () => {
      const themes = await getThemes();
      expect(themes).toEqual([]);
    });

    it('should return empty array when db is not initialized', async () => {
      mockDb = null;
      const themes = await getThemes();
      expect(themes).toEqual([]);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  getTheme
  // ═════════════════════════════════════════════════════════════════════
  describe('getTheme', () => {
    it('should return a theme by id', async () => {
      const seeded = seedTheme({ id: 'theme-abc', name: 'My Theme' });

      const theme = await getTheme('theme-abc');

      expect(theme).toBeDefined();
      expect(theme?.id).toBe('theme-abc');
      expect(theme?.name).toBe('My Theme');
    });

    it('should return null for non-existent id', async () => {
      const theme = await getTheme('non-existent-id');
      expect(theme).toBeNull();
    });

    it('should return null when db is not initialized', async () => {
      mockDb = null;
      const theme = await getTheme('some-id');
      expect(theme).toBeNull();
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  getDefaultTheme
  // ═════════════════════════════════════════════════════════════════════
  describe('getDefaultTheme', () => {
    it('should return the theme marked as default', async () => {
      seedTheme({ name: 'Not Default', isDefault: 0 });
      seedTheme({ name: 'Default Theme', isDefault: 1 });

      const theme = await getDefaultTheme();

      expect(theme).toBeDefined();
      expect(theme?.name).toBe('Default Theme');
      expect(theme?.isDefault).toBe(1);
    });

    it('should fall back to classic theme when no default is set', async () => {
      seedTheme({ id: '00000000-0000-0000-0000-000000000001', name: 'Classic', isDefault: 0 });
      seedTheme({ name: 'Other Theme', isDefault: 0 });

      const theme = await getDefaultTheme();

      expect(theme).toBeDefined();
      expect(theme?.id).toBe('00000000-0000-0000-0000-000000000001');
      expect(theme?.name).toBe('Classic');
    });

    it('should return null when no default and no classic theme exists', async () => {
      seedTheme({ name: 'Some Theme', isDefault: 0 });

      const theme = await getDefaultTheme();

      expect(theme).toBeNull();
    });

    it('should return null when db is not initialized', async () => {
      mockDb = null;
      const theme = await getDefaultTheme();
      expect(theme).toBeNull();
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  createTheme
  // ═════════════════════════════════════════════════════════════════════
  describe('createTheme', () => {
    it('should create a theme with all data provided', async () => {
      const data = {
        name: 'Full Theme',
        lineOrder: ['translation', 'original'],
        lineStyles: { original: { fontSize: 80, fontWeight: '700', color: '#000000', opacity: 1, visible: true } },
        positioning: { vertical: 'top', horizontal: 'left' },
        container: { maxWidth: '80%', padding: '10px', backgroundColor: '#333', borderRadius: '8px' },
        viewerBackground: { type: 'color', color: '#112233' },
        linePositions: { original: { x: 10, y: 20 } },
        canvasDimensions: { width: 3840, height: 2160 },
        backgroundBoxes: [{ x: 0, y: 0, width: 100, height: 50, color: '#FF0000' }]
      };

      const theme = await createTheme(data);

      expect(theme).toBeDefined();
      expect(theme.id).toBeDefined();
      expect(theme.name).toBe('Full Theme');
      expect(theme.isBuiltIn).toBe(0);
      expect(theme.isDefault).toBe(0);
      expect(theme.lineOrder).toEqual(['translation', 'original']);
      expect(theme.lineStyles).toEqual(data.lineStyles);
      expect(theme.positioning).toEqual({ vertical: 'top', horizontal: 'left' });
      expect(theme.container).toEqual(data.container);
      expect(theme.viewerBackground).toEqual({ type: 'color', color: '#112233' });
      expect(theme.linePositions).toEqual({ original: { x: 10, y: 20 } });
      expect(theme.canvasDimensions).toEqual({ width: 3840, height: 2160 });
      expect(theme.backgroundBoxes).toEqual(data.backgroundBoxes);
      expect(theme.createdAt).toBeDefined();
      expect(theme.updatedAt).toBeDefined();
      expect(theme.createdAt).toBe(theme.updatedAt);
    });

    it('should create a theme with minimal data (uses defaults)', async () => {
      const theme = await createTheme({ name: 'Minimal Theme' });

      expect(theme.name).toBe('Minimal Theme');
      expect(theme.isBuiltIn).toBe(0);
      expect(theme.isDefault).toBe(0);

      // Check defaults
      expect(theme.lineOrder).toEqual(['original', 'transliteration', 'translation']);
      expect(theme.lineStyles).toEqual({
        original: { fontSize: 100, fontWeight: '500', color: '#FFFFFF', opacity: 1, visible: true },
        transliteration: { fontSize: 90, fontWeight: '400', color: '#FFFFFF', opacity: 0.95, visible: true },
        translation: { fontSize: 90, fontWeight: '400', color: '#FFFFFF', opacity: 0.95, visible: true }
      });
      expect(theme.positioning).toEqual({ vertical: 'center', horizontal: 'center' });
      expect(theme.container).toEqual({ maxWidth: '100%', padding: '2vh 6vw', backgroundColor: 'transparent', borderRadius: '0px' });
      expect(theme.viewerBackground).toEqual({ type: 'inherit', color: null });
      expect(theme.linePositions).toBeNull();
      expect(theme.canvasDimensions).toEqual({ width: 1920, height: 1080 });
      expect(theme.backgroundBoxes).toBeNull();
    });

    it('should call saveDatabase after creating', async () => {
      const { saveDatabase } = await import('./index');

      await createTheme({ name: 'Test' });

      expect(saveDatabase).toHaveBeenCalled();
    });

    it('should persist theme to mock data store', async () => {
      expect(mockData.viewer_themes).toHaveLength(0);

      await createTheme({ name: 'Persisted Theme' });

      expect(mockData.viewer_themes).toHaveLength(1);
      expect(mockData.viewer_themes[0].name).toBe('Persisted Theme');
    });

    it('should generate unique ids for each theme', async () => {
      const theme1 = await createTheme({ name: 'Theme 1' });
      const theme2 = await createTheme({ name: 'Theme 2' });

      expect(theme1.id).not.toBe(theme2.id);
    });

    it('should throw error when database is not initialized', async () => {
      mockDb = null;

      await expect(createTheme({ name: 'Fail' })).rejects.toThrow('Database not initialized');
    });

    it('should set createdAt and updatedAt to the same ISO timestamp', async () => {
      const theme = await createTheme({ name: 'Timestamped' });

      expect(theme.createdAt).toBe(theme.updatedAt);
      // Verify it is a valid ISO date string
      expect(() => new Date(theme.createdAt)).not.toThrow();
      expect(new Date(theme.createdAt).toISOString()).toBe(theme.createdAt);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  updateTheme
  // ═════════════════════════════════════════════════════════════════════
  describe('updateTheme', () => {
    it('should update the name of an existing theme', async () => {
      const seeded = seedTheme({ name: 'Original Name' });

      const updated = await updateTheme(seeded.id, { name: 'Updated Name' });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Name');
    });

    it('should partially update only the provided fields', async () => {
      const seeded = seedTheme({
        name: 'Original',
        positioning: { vertical: 'center', horizontal: 'center' },
        container: { maxWidth: '100%' }
      });

      const updated = await updateTheme(seeded.id, {
        positioning: { vertical: 'top', horizontal: 'left' }
      });

      expect(updated?.positioning).toEqual({ vertical: 'top', horizontal: 'left' });
      // Name and container should remain unchanged
      expect(updated?.name).toBe('Original');
      expect(updated?.container).toEqual({ maxWidth: '100%' });
    });

    it('should update lineOrder', async () => {
      const seeded = seedTheme();

      const updated = await updateTheme(seeded.id, {
        lineOrder: ['translation', 'original']
      });

      expect(updated?.lineOrder).toEqual(['translation', 'original']);
    });

    it('should update lineStyles', async () => {
      const seeded = seedTheme();
      const newStyles = { original: { fontSize: 120, fontWeight: '700', color: '#FF0000', opacity: 0.8, visible: true } };

      const updated = await updateTheme(seeded.id, { lineStyles: newStyles });

      expect(updated?.lineStyles).toEqual(newStyles);
    });

    it('should update container', async () => {
      const seeded = seedTheme();
      const newContainer = { maxWidth: '80%', padding: '10px', backgroundColor: '#222', borderRadius: '12px' };

      const updated = await updateTheme(seeded.id, { container: newContainer });

      expect(updated?.container).toEqual(newContainer);
    });

    it('should update viewerBackground', async () => {
      const seeded = seedTheme();

      const updated = await updateTheme(seeded.id, {
        viewerBackground: { type: 'color', color: '#FF0000' }
      });

      expect(updated?.viewerBackground).toEqual({ type: 'color', color: '#FF0000' });
    });

    it('should update linePositions', async () => {
      const seeded = seedTheme();

      const updated = await updateTheme(seeded.id, {
        linePositions: { original: { x: 50, y: 100 } }
      });

      expect(updated?.linePositions).toEqual({ original: { x: 50, y: 100 } });
    });

    it('should update canvasDimensions', async () => {
      const seeded = seedTheme();

      const updated = await updateTheme(seeded.id, {
        canvasDimensions: { width: 3840, height: 2160 }
      });

      expect(updated?.canvasDimensions).toEqual({ width: 3840, height: 2160 });
    });

    it('should update backgroundBoxes', async () => {
      const seeded = seedTheme();
      const boxes = [{ x: 0, y: 0, width: 200, height: 100, color: '#00FF00' }];

      const updated = await updateTheme(seeded.id, { backgroundBoxes: boxes });

      expect(updated?.backgroundBoxes).toEqual(boxes);
    });

    it('should update multiple fields at once', async () => {
      const seeded = seedTheme({ name: 'Original' });

      const updated = await updateTheme(seeded.id, {
        name: 'Multi-Updated',
        positioning: { vertical: 'bottom', horizontal: 'right' },
        canvasDimensions: { width: 2560, height: 1440 }
      });

      expect(updated?.name).toBe('Multi-Updated');
      expect(updated?.positioning).toEqual({ vertical: 'bottom', horizontal: 'right' });
      expect(updated?.canvasDimensions).toEqual({ width: 2560, height: 1440 });
    });

    it('should set updatedAt to a new timestamp', async () => {
      const seeded = seedTheme({ updatedAt: '2020-01-01T00:00:00.000Z' });

      const updated = await updateTheme(seeded.id, { name: 'New Name' });

      expect(updated?.updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
      expect(new Date(updated?.updatedAt).getTime()).toBeGreaterThan(new Date('2020-01-01').getTime());
    });

    it('should call saveDatabase after updating', async () => {
      const { saveDatabase } = await import('./index');
      const seeded = seedTheme();

      await updateTheme(seeded.id, { name: 'Saved' });

      expect(saveDatabase).toHaveBeenCalled();
    });

    it('should return null for non-existent theme id', async () => {
      const result = await updateTheme('non-existent-id', { name: 'Nope' });
      expect(result).toBeNull();
    });

    it('should return null when database is not initialized', async () => {
      mockDb = null;
      const result = await updateTheme('some-id', { name: 'Fail' });
      expect(result).toBeNull();
    });

    it('should throw error when trying to modify a built-in theme', async () => {
      seedTheme({ id: 'builtin-theme', name: 'Classic', isBuiltIn: 1 });

      await expect(updateTheme('builtin-theme', { name: 'Hacked' }))
        .rejects.toThrow('Cannot modify built-in theme');
    });

    it('should not modify built-in theme data even when throw occurs', async () => {
      seedTheme({ id: 'builtin-theme', name: 'Classic', isBuiltIn: 1 });

      try {
        await updateTheme('builtin-theme', { name: 'Hacked' });
      } catch {
        // expected
      }

      const theme = mockData.viewer_themes.find(t => t.id === 'builtin-theme');
      expect(theme?.name).toBe('Classic');
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  deleteTheme
  // ═════════════════════════════════════════════════════════════════════
  describe('deleteTheme', () => {
    it('should delete an existing non-built-in theme', async () => {
      const seeded = seedTheme({ name: 'Deletable' });

      const result = await deleteTheme(seeded.id);

      expect(result).toBe(true);
      expect(mockData.viewer_themes).toHaveLength(0);
    });

    it('should call createBackup before deleting', async () => {
      const { createBackup } = await import('./index');
      const seeded = seedTheme({ name: 'Backed Up' });

      await deleteTheme(seeded.id);

      expect(createBackup).toHaveBeenCalledWith('delete_theme');
    });

    it('should call saveDatabase after deleting', async () => {
      const { saveDatabase } = await import('./index');
      const seeded = seedTheme({ name: 'Saved Delete' });

      await deleteTheme(seeded.id);

      expect(saveDatabase).toHaveBeenCalled();
    });

    it('should cascade delete display_theme_overrides referencing the theme', async () => {
      const seeded = seedTheme({ name: 'Has Overrides' });
      // Seed some display_theme_overrides
      mockData.display_theme_overrides.push(
        { id: 'override-1', themeId: seeded.id, displayId: 'display-1' },
        { id: 'override-2', themeId: seeded.id, displayId: 'display-2' },
        { id: 'override-3', themeId: 'other-theme-id', displayId: 'display-3' }
      );

      await deleteTheme(seeded.id);

      // Only overrides for the deleted theme should be removed
      expect(mockData.display_theme_overrides).toHaveLength(1);
      expect(mockData.display_theme_overrides[0].id).toBe('override-3');
    });

    it('should not remove overrides for other themes', async () => {
      const theme1 = seedTheme({ name: 'Theme 1' });
      const theme2 = seedTheme({ name: 'Theme 2' });
      mockData.display_theme_overrides.push(
        { id: 'o1', themeId: theme1.id, displayId: 'd1' },
        { id: 'o2', themeId: theme2.id, displayId: 'd2' }
      );

      await deleteTheme(theme1.id);

      expect(mockData.display_theme_overrides).toHaveLength(1);
      expect(mockData.display_theme_overrides[0].themeId).toBe(theme2.id);
      // theme2 still exists
      expect(mockData.viewer_themes).toHaveLength(1);
      expect(mockData.viewer_themes[0].id).toBe(theme2.id);
    });

    it('should throw error when trying to delete a built-in theme', async () => {
      seedTheme({ id: 'builtin-theme', name: 'Classic', isBuiltIn: 1 });

      await expect(deleteTheme('builtin-theme'))
        .rejects.toThrow('Cannot delete built-in theme');
    });

    it('should not remove built-in theme when throw occurs', async () => {
      seedTheme({ id: 'builtin-theme', name: 'Classic', isBuiltIn: 1 });

      try {
        await deleteTheme('builtin-theme');
      } catch {
        // expected
      }

      expect(mockData.viewer_themes).toHaveLength(1);
      expect(mockData.viewer_themes[0].id).toBe('builtin-theme');
    });

    it('should return false for non-existent theme id', async () => {
      const result = await deleteTheme('non-existent-id');
      expect(result).toBe(false);
    });

    it('should return false when database is not initialized', async () => {
      mockDb = null;
      const result = await deleteTheme('some-id');
      expect(result).toBe(false);
    });

    it('should return false for empty string id', async () => {
      const result = await deleteTheme('');
      expect(result).toBe(false);
    });

    it('should return false for invalid id type', async () => {
      const result = await deleteTheme(null as any);
      expect(result).toBe(false);
    });

    it('should only delete the specified theme, leaving others untouched', async () => {
      const theme1 = seedTheme({ name: 'Keep Me' });
      const theme2 = seedTheme({ name: 'Delete Me' });
      const theme3 = seedTheme({ name: 'Keep Me Too' });

      await deleteTheme(theme2.id);

      expect(mockData.viewer_themes).toHaveLength(2);
      expect(mockData.viewer_themes.find(t => t.id === theme1.id)).toBeDefined();
      expect(mockData.viewer_themes.find(t => t.id === theme3.id)).toBeDefined();
      expect(mockData.viewer_themes.find(t => t.id === theme2.id)).toBeUndefined();
    });
  });
});
