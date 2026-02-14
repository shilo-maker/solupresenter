import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateId,
  rowsToObjects,
  getSelectedThemeIds,
  saveSelectedThemeId,
  CLASSIC_THEME_ID,
  CLASSIC_STAGE_THEME_ID,
  CLASSIC_BIBLE_THEME_ID,
  CLASSIC_OBS_SONGS_THEME_ID,
  CLASSIC_OBS_BIBLE_THEME_ID,
  CLASSIC_PRAYER_THEME_ID,
  CLASSIC_OBS_PRAYER_THEME_ID
} from './index';

describe('database index module', () => {
  // ============================================================
  // generateId() tests
  // ============================================================
  describe('generateId', () => {
    it('should return a string of length 36', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBe(36);
    });

    it('should have hyphens at positions 8, 13, 18, 23', () => {
      const id = generateId();
      expect(id[8]).toBe('-');
      expect(id[13]).toBe('-');
      expect(id[18]).toBe('-');
      expect(id[23]).toBe('-');
    });

    it('should have the UUID version 4 indicator at position 14', () => {
      const id = generateId();
      expect(id[14]).toBe('4');
    });

    it('should have a valid variant character at position 19 (one of 8, 9, a, b)', () => {
      // Run multiple times to increase confidence
      for (let i = 0; i < 50; i++) {
        const id = generateId();
        expect(['8', '9', 'a', 'b']).toContain(id[19]);
      }
    });

    it('should match the UUID v4 regex pattern', () => {
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
      for (let i = 0; i < 20; i++) {
        const id = generateId();
        expect(id).toMatch(uuidV4Regex);
      }
    });

    it('should only contain lowercase hex characters and hyphens', () => {
      const id = generateId();
      expect(id).toMatch(/^[0-9a-f-]+$/);
    });

    it('should have exactly 4 hyphens', () => {
      const id = generateId();
      const hyphenCount = (id.match(/-/g) || []).length;
      expect(hyphenCount).toBe(4);
    });

    it('should have 5 groups of correct lengths (8-4-4-4-12)', () => {
      const id = generateId();
      const parts = id.split('-');
      expect(parts.length).toBe(5);
      expect(parts[0].length).toBe(8);
      expect(parts[1].length).toBe(4);
      expect(parts[2].length).toBe(4);
      expect(parts[3].length).toBe(4);
      expect(parts[4].length).toBe(12);
    });

    it('should generate unique IDs across many calls', () => {
      const ids = new Set<string>();
      const count = 1000;
      for (let i = 0; i < count; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(count);
    });

    it('should generate different IDs on consecutive calls', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  // ============================================================
  // rowsToObjects() tests
  // ============================================================
  describe('rowsToObjects', () => {
    it('should convert a basic result with columns and values to objects', () => {
      const result = [{
        columns: ['id', 'name', 'age'],
        values: [
          ['1', 'Alice', 30],
          ['2', 'Bob', 25]
        ]
      }];

      const objects = rowsToObjects(result);

      expect(objects).toHaveLength(2);
      expect(objects[0]).toEqual({ id: '1', name: 'Alice', age: 30 });
      expect(objects[1]).toEqual({ id: '2', name: 'Bob', age: 25 });
    });

    it('should return an empty array for null input', () => {
      expect(rowsToObjects(null as any)).toEqual([]);
    });

    it('should return an empty array for undefined input', () => {
      expect(rowsToObjects(undefined as any)).toEqual([]);
    });

    it('should return an empty array for empty array input', () => {
      expect(rowsToObjects([])).toEqual([]);
    });

    it('should return an empty array when first result has no columns', () => {
      const result = [{ values: [['val1']] }];
      expect(rowsToObjects(result as any)).toEqual([]);
    });

    it('should return an empty array when first result has no values', () => {
      const result = [{ columns: ['col1'] }];
      expect(rowsToObjects(result as any)).toEqual([]);
    });

    it('should return an empty array when first result is null', () => {
      const result = [null];
      expect(rowsToObjects(result as any)).toEqual([]);
    });

    it('should return an empty array when first result is undefined', () => {
      const result = [undefined];
      expect(rowsToObjects(result as any)).toEqual([]);
    });

    it('should handle a single row with a single column', () => {
      const result = [{
        columns: ['count'],
        values: [[42]]
      }];

      const objects = rowsToObjects(result);

      expect(objects).toHaveLength(1);
      expect(objects[0]).toEqual({ count: 42 });
    });

    it('should auto-parse JSON array strings', () => {
      const jsonArray = JSON.stringify(['a', 'b', 'c']);
      const result = [{
        columns: ['id', 'tags'],
        values: [['1', jsonArray]]
      }];

      const objects = rowsToObjects(result);

      expect(objects[0].tags).toEqual(['a', 'b', 'c']);
      expect(Array.isArray(objects[0].tags)).toBe(true);
    });

    it('should auto-parse JSON object strings', () => {
      const jsonObj = JSON.stringify({ key: 'value', nested: { a: 1 } });
      const result = [{
        columns: ['id', 'config'],
        values: [['1', jsonObj]]
      }];

      const objects = rowsToObjects(result);

      expect(objects[0].config).toEqual({ key: 'value', nested: { a: 1 } });
      expect(typeof objects[0].config).toBe('object');
    });

    it('should not parse non-JSON strings', () => {
      const result = [{
        columns: ['id', 'name'],
        values: [['1', 'Hello World']]
      }];

      const objects = rowsToObjects(result);

      expect(objects[0].name).toBe('Hello World');
    });

    it('should not parse strings that start with [ but are not valid JSON', () => {
      const result = [{
        columns: ['id', 'data'],
        values: [['1', '[not valid json']]
      }];

      const objects = rowsToObjects(result);

      // Invalid JSON should remain as the original string
      expect(objects[0].data).toBe('[not valid json');
    });

    it('should not parse strings that start with { but are not valid JSON', () => {
      const result = [{
        columns: ['id', 'data'],
        values: [['1', '{not valid json']]
      }];

      const objects = rowsToObjects(result);

      expect(objects[0].data).toBe('{not valid json');
    });

    it('should preserve null values without parsing', () => {
      const result = [{
        columns: ['id', 'optional'],
        values: [['1', null]]
      }];

      const objects = rowsToObjects(result);

      expect(objects[0].optional).toBeNull();
    });

    it('should preserve numeric values', () => {
      const result = [{
        columns: ['id', 'count', 'ratio'],
        values: [[1, 42, 3.14]]
      }];

      const objects = rowsToObjects(result);

      expect(objects[0].id).toBe(1);
      expect(objects[0].count).toBe(42);
      expect(objects[0].ratio).toBe(3.14);
    });

    it('should preserve boolean-like integer values (0 and 1)', () => {
      const result = [{
        columns: ['isDefault', 'isBuiltIn'],
        values: [[0, 1]]
      }];

      const objects = rowsToObjects(result);

      expect(objects[0].isDefault).toBe(0);
      expect(objects[0].isBuiltIn).toBe(1);
    });

    it('should handle more columns than values gracefully', () => {
      const result = [{
        columns: ['col1', 'col2', 'col3'],
        values: [['val1', 'val2']] // only 2 values for 3 columns
      }];

      const objects = rowsToObjects(result);

      expect(objects).toHaveLength(1);
      expect(objects[0].col1).toBe('val1');
      expect(objects[0].col2).toBe('val2');
      expect(objects[0].col3).toBeUndefined();
    });

    it('should handle multiple rows with mixed types', () => {
      const result = [{
        columns: ['id', 'name', 'slides', 'count'],
        values: [
          ['abc-123', 'Song A', '["slide1","slide2"]', 5],
          ['def-456', 'Song B', '[]', 0],
          ['ghi-789', 'Song C', null, null]
        ]
      }];

      const objects = rowsToObjects(result);

      expect(objects).toHaveLength(3);
      expect(objects[0]).toEqual({
        id: 'abc-123',
        name: 'Song A',
        slides: ['slide1', 'slide2'],
        count: 5
      });
      expect(objects[1]).toEqual({
        id: 'def-456',
        name: 'Song B',
        slides: [],
        count: 0
      });
      expect(objects[2]).toEqual({
        id: 'ghi-789',
        name: 'Song C',
        slides: null,
        count: null
      });
    });

    it('should parse nested JSON objects', () => {
      const nested = JSON.stringify({
        original: { fontSize: 178, fontWeight: '700', color: '#ffffff' },
        transliteration: { fontSize: 136, fontWeight: '400', color: '#ffffff' }
      });
      const result = [{
        columns: ['id', 'lineStyles'],
        values: [['theme-1', nested]]
      }];

      const objects = rowsToObjects(result);

      expect(objects[0].lineStyles.original.fontSize).toBe(178);
      expect(objects[0].lineStyles.transliteration.fontWeight).toBe('400');
    });

    it('should handle empty string values without parsing', () => {
      const result = [{
        columns: ['id', 'backgroundImage'],
        values: [['1', '']]
      }];

      const objects = rowsToObjects(result);

      expect(objects[0].backgroundImage).toBe('');
    });

    it('should handle an empty values array', () => {
      const result = [{
        columns: ['id', 'name'],
        values: []
      }];

      const objects = rowsToObjects(result);

      expect(objects).toEqual([]);
    });

    it('should only process the first result set', () => {
      const result = [
        {
          columns: ['id'],
          values: [['first']]
        },
        {
          columns: ['id'],
          values: [['second']]
        }
      ];

      const objects = rowsToObjects(result);

      expect(objects).toHaveLength(1);
      expect(objects[0].id).toBe('first');
    });
  });

  // ============================================================
  // getSelectedThemeIds() - DB not initialized path
  // ============================================================
  describe('getSelectedThemeIds', () => {
    it('should return null for all theme types when DB is not initialized', () => {
      // The module-level `db` is null by default since we never called initDatabase()
      const themeIds = getSelectedThemeIds();

      expect(themeIds).toEqual({
        viewerThemeId: null,
        stageThemeId: null,
        bibleThemeId: null,
        obsThemeId: null,
        obsBibleThemeId: null,
        prayerThemeId: null,
        obsPrayerThemeId: null
      });
    });

    it('should return an object with exactly 7 keys', () => {
      const themeIds = getSelectedThemeIds();

      expect(Object.keys(themeIds)).toHaveLength(7);
    });

    it('should have the correct property names', () => {
      const themeIds = getSelectedThemeIds();

      expect(themeIds).toHaveProperty('viewerThemeId');
      expect(themeIds).toHaveProperty('stageThemeId');
      expect(themeIds).toHaveProperty('bibleThemeId');
      expect(themeIds).toHaveProperty('obsThemeId');
      expect(themeIds).toHaveProperty('obsBibleThemeId');
      expect(themeIds).toHaveProperty('prayerThemeId');
      expect(themeIds).toHaveProperty('obsPrayerThemeId');
    });
  });

  // ============================================================
  // saveSelectedThemeId() - DB not initialized path
  // ============================================================
  describe('saveSelectedThemeId', () => {
    it('should be a no-op when DB is not initialized (viewer)', () => {
      // Should not throw
      expect(() => saveSelectedThemeId('viewer', 'some-theme-id')).not.toThrow();
    });

    it('should be a no-op when DB is not initialized (stage)', () => {
      expect(() => saveSelectedThemeId('stage', 'some-theme-id')).not.toThrow();
    });

    it('should be a no-op when DB is not initialized (bible)', () => {
      expect(() => saveSelectedThemeId('bible', null)).not.toThrow();
    });

    it('should be a no-op when DB is not initialized (obs)', () => {
      expect(() => saveSelectedThemeId('obs', 'some-theme-id')).not.toThrow();
    });

    it('should be a no-op when DB is not initialized (obsBible)', () => {
      expect(() => saveSelectedThemeId('obsBible', 'some-theme-id')).not.toThrow();
    });

    it('should be a no-op when DB is not initialized (prayer)', () => {
      expect(() => saveSelectedThemeId('prayer', 'some-theme-id')).not.toThrow();
    });

    it('should be a no-op when DB is not initialized (obsPrayer)', () => {
      expect(() => saveSelectedThemeId('obsPrayer', null)).not.toThrow();
    });
  });

  // ============================================================
  // Exported constants
  // ============================================================
  describe('exported theme ID constants', () => {
    it('should export CLASSIC_THEME_ID as expected UUID', () => {
      expect(CLASSIC_THEME_ID).toBe('00000000-0000-0000-0000-000000000001');
    });

    it('should export CLASSIC_STAGE_THEME_ID as expected UUID', () => {
      expect(CLASSIC_STAGE_THEME_ID).toBe('00000000-0000-0000-0000-000000000002');
    });

    it('should export CLASSIC_BIBLE_THEME_ID as expected UUID', () => {
      expect(CLASSIC_BIBLE_THEME_ID).toBe('00000000-0000-0000-0000-000000000003');
    });

    it('should export CLASSIC_OBS_SONGS_THEME_ID as expected UUID', () => {
      expect(CLASSIC_OBS_SONGS_THEME_ID).toBe('00000000-0000-0000-0000-000000000004');
    });

    it('should export CLASSIC_OBS_BIBLE_THEME_ID as expected UUID', () => {
      expect(CLASSIC_OBS_BIBLE_THEME_ID).toBe('00000000-0000-0000-0000-000000000005');
    });

    it('should export CLASSIC_PRAYER_THEME_ID as expected UUID', () => {
      expect(CLASSIC_PRAYER_THEME_ID).toBe('00000000-0000-0000-0000-000000000006');
    });

    it('should export CLASSIC_OBS_PRAYER_THEME_ID as expected UUID', () => {
      expect(CLASSIC_OBS_PRAYER_THEME_ID).toBe('00000000-0000-0000-0000-000000000008');
    });

    it('should have all theme IDs as valid UUID format (36 chars with hyphens)', () => {
      const allIds = [
        CLASSIC_THEME_ID,
        CLASSIC_STAGE_THEME_ID,
        CLASSIC_BIBLE_THEME_ID,
        CLASSIC_OBS_SONGS_THEME_ID,
        CLASSIC_OBS_BIBLE_THEME_ID,
        CLASSIC_PRAYER_THEME_ID,
        CLASSIC_OBS_PRAYER_THEME_ID
      ];

      for (const id of allIds) {
        expect(id.length).toBe(36);
        expect(id.split('-').length).toBe(5);
      }
    });

    it('should have all unique theme IDs', () => {
      const allIds = [
        CLASSIC_THEME_ID,
        CLASSIC_STAGE_THEME_ID,
        CLASSIC_BIBLE_THEME_ID,
        CLASSIC_OBS_SONGS_THEME_ID,
        CLASSIC_OBS_BIBLE_THEME_ID,
        CLASSIC_PRAYER_THEME_ID,
        CLASSIC_OBS_PRAYER_THEME_ID
      ];

      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });
  });
});
