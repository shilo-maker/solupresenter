import { getDb, saveDatabase, generateId, createBackup, beginTransaction, commitTransaction, rollbackTransaction } from './index';
import { getThemes, createTheme } from './themes';
import { getStageThemes, createStageTheme } from './stageThemes';
import { getBibleThemes, createBibleTheme } from './bibleThemes';
import { getPrayerThemes, createPrayerTheme } from './prayerThemes';
import { getOBSThemes, createOBSTheme } from './obsThemes';

interface ThemeExportData {
  version: number;
  exportedAt: string;
  viewerThemes: any[];
  stageThemes: any[];
  bibleThemes: any[];
  prayerThemes: any[];
  obsThemes: any[];
}

/**
 * Export all themes to JSON format
 */
export async function exportThemesToJSON(): Promise<string> {
  // Get all themes from all tables
  const viewerThemes = await getThemes();
  const stageThemes = await getStageThemes();
  const bibleThemes = await getBibleThemes();
  const prayerThemes = await getPrayerThemes();
  const obsThemes = await getOBSThemes();

  // Helper to parse JSON fields
  const parseJsonFields = (theme: any, fields: string[]) => {
    const result = { ...theme };
    for (const field of fields) {
      if (result[field] && typeof result[field] === 'string') {
        try {
          result[field] = JSON.parse(result[field]);
        } catch (e) {
          // Keep as is if not valid JSON
        }
      }
    }
    return result;
  };

  // Clean up themes for export (exclude built-in themes, parse JSON fields)
  const exportViewerThemes = viewerThemes
    .filter(t => !t.isBuiltIn)
    .map(t => {
      const theme = parseJsonFields(t, ['lineOrder', 'lineStyles', 'positioning', 'container', 'viewerBackground', 'linePositions', 'canvasDimensions', 'backgroundBoxes']);
      // Remove internal fields
      delete theme.isBuiltIn;
      delete theme.isDefault;
      delete theme.createdAt;
      delete theme.updatedAt;
      return theme;
    });

  const exportStageThemes = stageThemes
    .filter(t => !t.isBuiltIn)
    .map(t => {
      const theme = parseJsonFields(t, ['colors', 'elements', 'currentSlideText', 'nextSlideText']);
      delete theme.isBuiltIn;
      delete theme.isDefault;
      delete theme.createdAt;
      delete theme.updatedAt;
      return theme;
    });

  const exportBibleThemes = bibleThemes
    .filter(t => !t.isBuiltIn)
    .map(t => {
      const theme = parseJsonFields(t, ['lineOrder', 'lineStyles', 'linePositions', 'referenceStyle', 'referencePosition', 'referenceEnglishStyle', 'referenceEnglishPosition', 'container', 'viewerBackground', 'canvasDimensions', 'backgroundBoxes']);
      delete theme.isBuiltIn;
      delete theme.isDefault;
      delete theme.createdAt;
      delete theme.updatedAt;
      return theme;
    });

  const exportPrayerThemes = prayerThemes
    .filter(t => !t.isBuiltIn)
    .map(t => {
      const theme = parseJsonFields(t, ['lineOrder', 'lineStyles', 'linePositions', 'referenceStyle', 'referencePosition', 'referenceTranslationStyle', 'referenceTranslationPosition', 'container', 'viewerBackground', 'canvasDimensions', 'backgroundBoxes']);
      delete theme.isBuiltIn;
      delete theme.isDefault;
      delete theme.createdAt;
      delete theme.updatedAt;
      return theme;
    });

  const exportOBSThemes = obsThemes
    .filter(t => !t.isBuiltIn)
    .map(t => {
      const theme = parseJsonFields(t, ['lineOrder', 'lineStyles', 'linePositions', 'referenceStyle', 'referencePosition', 'referenceEnglishStyle', 'referenceEnglishPosition', 'viewerBackground', 'canvasDimensions', 'backgroundBoxes']);
      delete theme.isBuiltIn;
      delete theme.isDefault;
      delete theme.createdAt;
      delete theme.updatedAt;
      return theme;
    });

  const exportData: ThemeExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    viewerThemes: exportViewerThemes,
    stageThemes: exportStageThemes,
    bibleThemes: exportBibleThemes,
    prayerThemes: exportPrayerThemes,
    obsThemes: exportOBSThemes
  };

  return JSON.stringify(exportData, null, 2);
}

interface ImportResult {
  viewerThemes: { imported: number; skipped: number; errors: number };
  stageThemes: { imported: number; skipped: number; errors: number };
  bibleThemes: { imported: number; skipped: number; errors: number };
  prayerThemes: { imported: number; skipped: number; errors: number };
  obsThemes: { imported: number; skipped: number; errors: number };
  total: { imported: number; skipped: number; errors: number };
}

/**
 * Import themes from JSON data
 */
export async function importThemesFromJSON(jsonData: string): Promise<ImportResult> {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  const result: ImportResult = {
    viewerThemes: { imported: 0, skipped: 0, errors: 0 },
    stageThemes: { imported: 0, skipped: 0, errors: 0 },
    bibleThemes: { imported: 0, skipped: 0, errors: 0 },
    prayerThemes: { imported: 0, skipped: 0, errors: 0 },
    obsThemes: { imported: 0, skipped: 0, errors: 0 },
    total: { imported: 0, skipped: 0, errors: 0 }
  };

  try {
    const data: ThemeExportData = JSON.parse(jsonData);

    if (!data.version || typeof data.version !== 'number') {
      throw new Error('Invalid theme export format: missing version');
    }

    // Create backup before import
    createBackup('import_themes_json');

    // Use transaction for bulk import
    beginTransaction();
    try {
      // Import viewer themes
      if (Array.isArray(data.viewerThemes)) {
        const existingViewerThemes = await getThemes();
        const existingNames = new Set(existingViewerThemes.map(t => t.name.toLowerCase()));

        for (const theme of data.viewerThemes) {
          try {
            if (!theme.name || typeof theme.name !== 'string') {
              result.viewerThemes.errors++;
              continue;
            }

            // Skip if theme with same name exists
            if (existingNames.has(theme.name.toLowerCase())) {
              result.viewerThemes.skipped++;
              continue;
            }

            await createTheme({
              name: theme.name,
              lineOrder: theme.lineOrder,
              lineStyles: theme.lineStyles,
              positioning: theme.positioning,
              container: theme.container,
              viewerBackground: theme.viewerBackground,
              linePositions: theme.linePositions,
              canvasDimensions: theme.canvasDimensions,
              backgroundBoxes: theme.backgroundBoxes
            });
            result.viewerThemes.imported++;
            existingNames.add(theme.name.toLowerCase());
          } catch (e) {
            console.error('Error importing viewer theme:', e);
            result.viewerThemes.errors++;
          }
        }
      }

      // Import stage themes
      if (Array.isArray(data.stageThemes)) {
        const existingStageThemes = await getStageThemes();
        const existingNames = new Set(existingStageThemes.map(t => t.name.toLowerCase()));

        for (const theme of data.stageThemes) {
          try {
            if (!theme.name || typeof theme.name !== 'string') {
              result.stageThemes.errors++;
              continue;
            }

            if (existingNames.has(theme.name.toLowerCase())) {
              result.stageThemes.skipped++;
              continue;
            }

            await createStageTheme({
              name: theme.name,
              colors: theme.colors,
              elements: theme.elements,
              currentSlideText: theme.currentSlideText,
              nextSlideText: theme.nextSlideText
            });
            result.stageThemes.imported++;
            existingNames.add(theme.name.toLowerCase());
          } catch (e) {
            console.error('Error importing stage theme:', e);
            result.stageThemes.errors++;
          }
        }
      }

      // Import bible themes
      if (Array.isArray(data.bibleThemes)) {
        const existingBibleThemes = await getBibleThemes();
        const existingNames = new Set(existingBibleThemes.map(t => t.name.toLowerCase()));

        for (const theme of data.bibleThemes) {
          try {
            if (!theme.name || typeof theme.name !== 'string') {
              result.bibleThemes.errors++;
              continue;
            }

            if (existingNames.has(theme.name.toLowerCase())) {
              result.bibleThemes.skipped++;
              continue;
            }

            await createBibleTheme({
              name: theme.name,
              lineOrder: theme.lineOrder,
              lineStyles: theme.lineStyles,
              linePositions: theme.linePositions,
              referenceStyle: theme.referenceStyle,
              referencePosition: theme.referencePosition,
              referenceEnglishStyle: theme.referenceEnglishStyle,
              referenceEnglishPosition: theme.referenceEnglishPosition,
              container: theme.container,
              viewerBackground: theme.viewerBackground,
              canvasDimensions: theme.canvasDimensions,
              backgroundBoxes: theme.backgroundBoxes
            });
            result.bibleThemes.imported++;
            existingNames.add(theme.name.toLowerCase());
          } catch (e) {
            console.error('Error importing bible theme:', e);
            result.bibleThemes.errors++;
          }
        }
      }

      // Import prayer themes
      if (Array.isArray(data.prayerThemes)) {
        const existingPrayerThemes = await getPrayerThemes();
        const existingNames = new Set(existingPrayerThemes.map(t => t.name.toLowerCase()));

        for (const theme of data.prayerThemes) {
          try {
            if (!theme.name || typeof theme.name !== 'string') {
              result.prayerThemes.errors++;
              continue;
            }

            if (existingNames.has(theme.name.toLowerCase())) {
              result.prayerThemes.skipped++;
              continue;
            }

            await createPrayerTheme({
              name: theme.name,
              lineOrder: theme.lineOrder,
              lineStyles: theme.lineStyles,
              linePositions: theme.linePositions,
              referenceStyle: theme.referenceStyle,
              referencePosition: theme.referencePosition,
              referenceTranslationStyle: theme.referenceTranslationStyle,
              referenceTranslationPosition: theme.referenceTranslationPosition,
              container: theme.container,
              viewerBackground: theme.viewerBackground,
              canvasDimensions: theme.canvasDimensions,
              backgroundBoxes: theme.backgroundBoxes
            });
            result.prayerThemes.imported++;
            existingNames.add(theme.name.toLowerCase());
          } catch (e) {
            console.error('Error importing prayer theme:', e);
            result.prayerThemes.errors++;
          }
        }
      }

      // Import OBS themes
      if (Array.isArray(data.obsThemes)) {
        const existingOBSThemes = await getOBSThemes();
        const existingNames = new Set(existingOBSThemes.map(t => `${t.type}:${t.name.toLowerCase()}`));

        for (const theme of data.obsThemes) {
          try {
            if (!theme.name || typeof theme.name !== 'string') {
              result.obsThemes.errors++;
              continue;
            }

            const themeKey = `${theme.type || 'songs'}:${theme.name.toLowerCase()}`;
            if (existingNames.has(themeKey)) {
              result.obsThemes.skipped++;
              continue;
            }

            await createOBSTheme({
              name: theme.name,
              type: theme.type || 'songs',
              lineOrder: theme.lineOrder,
              lineStyles: theme.lineStyles,
              linePositions: theme.linePositions,
              referenceStyle: theme.referenceStyle,
              referencePosition: theme.referencePosition,
              referenceEnglishStyle: theme.referenceEnglishStyle,
              referenceEnglishPosition: theme.referenceEnglishPosition,
              viewerBackground: theme.viewerBackground,
              canvasDimensions: theme.canvasDimensions,
              backgroundBoxes: theme.backgroundBoxes
            });
            result.obsThemes.imported++;
            existingNames.add(themeKey);
          } catch (e) {
            console.error('Error importing OBS theme:', e);
            result.obsThemes.errors++;
          }
        }
      }

      commitTransaction();
    } catch (e) {
      rollbackTransaction();
      throw e;
    }

    // Calculate totals
    result.total.imported = result.viewerThemes.imported + result.stageThemes.imported +
      result.bibleThemes.imported + result.prayerThemes.imported + result.obsThemes.imported;
    result.total.skipped = result.viewerThemes.skipped + result.stageThemes.skipped +
      result.bibleThemes.skipped + result.prayerThemes.skipped + result.obsThemes.skipped;
    result.total.errors = result.viewerThemes.errors + result.stageThemes.errors +
      result.bibleThemes.errors + result.prayerThemes.errors + result.obsThemes.errors;

    return result;
  } catch (error) {
    console.error('Import themes failed:', error);
    throw error;
  }
}
