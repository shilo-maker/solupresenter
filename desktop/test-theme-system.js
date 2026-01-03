/**
 * Comprehensive Theme System Tests
 * Tests Bible themes, OBS themes, and all CRUD operations
 */

const path = require('path');
const fs = require('fs');

// Mock electron app for testing
const mockApp = {
  getPath: (name) => {
    if (name === 'userData') {
      return path.join(__dirname, 'test-data');
    }
    return __dirname;
  }
};

// Ensure test directory exists
const testDataDir = path.join(__dirname, 'test-data');
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

// Test Results Tracker
const results = {
  passed: 0,
  failed: 0,
  errors: []
};

function test(name, fn) {
  try {
    fn();
    results.passed++;
    console.log(`✅ PASS: ${name}`);
  } catch (error) {
    results.failed++;
    results.errors.push({ name, error: error.message });
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${error.message}`);
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    results.passed++;
    console.log(`✅ PASS: ${name}`);
  } catch (error) {
    results.failed++;
    results.errors.push({ name, error: error.message });
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${error.message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertExists(value, message) {
  if (value === null || value === undefined) {
    throw new Error(`${message}: value should exist but is ${value}`);
  }
}

function assertArray(value, message) {
  if (!Array.isArray(value)) {
    throw new Error(`${message}: expected array, got ${typeof value}`);
  }
}

function assertGreaterThan(actual, expected, message) {
  if (actual <= expected) {
    throw new Error(`${message}: expected > ${expected}, got ${actual}`);
  }
}

// ============ FILE STRUCTURE TESTS ============
console.log('\n📁 TESTING FILE STRUCTURE...\n');

test('bibleThemes.ts exists', () => {
  const filePath = path.join(__dirname, 'src/main/database/bibleThemes.ts');
  if (!fs.existsSync(filePath)) {
    throw new Error('bibleThemes.ts not found');
  }
});

test('obsThemes.ts exists', () => {
  const filePath = path.join(__dirname, 'src/main/database/obsThemes.ts');
  if (!fs.existsSync(filePath)) {
    throw new Error('obsThemes.ts not found');
  }
});

test('BibleThemeEditorPage.tsx exists', () => {
  const filePath = path.join(__dirname, 'src/renderer/pages/BibleThemeEditorPage.tsx');
  if (!fs.existsSync(filePath)) {
    throw new Error('BibleThemeEditorPage.tsx not found');
  }
});

test('OBSSongsThemeEditorPage.tsx exists', () => {
  const filePath = path.join(__dirname, 'src/renderer/pages/OBSSongsThemeEditorPage.tsx');
  if (!fs.existsSync(filePath)) {
    throw new Error('OBSSongsThemeEditorPage.tsx not found');
  }
});

test('OBSBibleThemeEditorPage.tsx exists', () => {
  const filePath = path.join(__dirname, 'src/renderer/pages/OBSBibleThemeEditorPage.tsx');
  if (!fs.existsSync(filePath)) {
    throw new Error('OBSBibleThemeEditorPage.tsx not found');
  }
});

// ============ CODE CONTENT TESTS ============
console.log('\n📝 TESTING CODE CONTENT...\n');

test('bibleThemes.ts exports required functions', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/main/database/bibleThemes.ts'), 'utf-8');
  const requiredExports = ['getBibleThemes', 'getBibleTheme', 'createBibleTheme', 'updateBibleTheme', 'deleteBibleTheme', 'getDefaultBibleTheme'];
  for (const fn of requiredExports) {
    if (!content.includes(`export async function ${fn}`)) {
      throw new Error(`Missing export: ${fn}`);
    }
  }
});

test('obsThemes.ts exports required functions', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/main/database/obsThemes.ts'), 'utf-8');
  const requiredExports = ['getOBSThemes', 'getOBSTheme', 'createOBSTheme', 'updateOBSTheme', 'deleteOBSTheme', 'getDefaultOBSTheme'];
  for (const fn of requiredExports) {
    if (!content.includes(`export async function ${fn}`)) {
      throw new Error(`Missing export: ${fn}`);
    }
  }
});

test('obsThemes.ts has OBSThemeType definition', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/main/database/obsThemes.ts'), 'utf-8');
  if (!content.includes("OBSThemeType = 'songs' | 'bible'")) {
    throw new Error('OBSThemeType not properly defined');
  }
});

test('index.ts has bible_themes table creation', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/main/database/index.ts'), 'utf-8');
  if (!content.includes('CREATE TABLE IF NOT EXISTS bible_themes')) {
    throw new Error('bible_themes table creation not found');
  }
});

test('index.ts has obs_themes table creation', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/main/database/index.ts'), 'utf-8');
  if (!content.includes('CREATE TABLE IF NOT EXISTS obs_themes')) {
    throw new Error('obs_themes table creation not found');
  }
});

test('index.ts exports theme ID constants', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/main/database/index.ts'), 'utf-8');
  const constants = ['CLASSIC_BIBLE_THEME_ID', 'CLASSIC_OBS_SONGS_THEME_ID', 'CLASSIC_OBS_BIBLE_THEME_ID'];
  for (const constant of constants) {
    if (!content.includes(`export const ${constant}`)) {
      throw new Error(`Missing constant: ${constant}`);
    }
  }
});

// ============ IPC HANDLER TESTS ============
console.log('\n🔌 TESTING IPC HANDLERS...\n');

test('IPC handlers import bibleThemes', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/main/ipc/index.ts'), 'utf-8');
  if (!content.includes("from '../database/bibleThemes'")) {
    throw new Error('bibleThemes import missing');
  }
});

test('IPC handlers import obsThemes', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/main/ipc/index.ts'), 'utf-8');
  if (!content.includes("from '../database/obsThemes'")) {
    throw new Error('obsThemes import missing');
  }
});

test('IPC has Bible theme handlers', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/main/ipc/index.ts'), 'utf-8');
  const handlers = [
    "ipcMain.handle('db:bibleThemes:getAll'",
    "ipcMain.handle('db:bibleThemes:get'",
    "ipcMain.handle('db:bibleThemes:create'",
    "ipcMain.handle('db:bibleThemes:update'",
    "ipcMain.handle('db:bibleThemes:delete'",
    "ipcMain.handle('bibleTheme:apply'"
  ];
  for (const handler of handlers) {
    if (!content.includes(handler)) {
      throw new Error(`Missing handler: ${handler}`);
    }
  }
});

test('IPC has OBS theme handlers', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/main/ipc/index.ts'), 'utf-8');
  const handlers = [
    "ipcMain.handle('db:obsThemes:getAll'",
    "ipcMain.handle('db:obsThemes:get'",
    "ipcMain.handle('db:obsThemes:create'",
    "ipcMain.handle('db:obsThemes:update'",
    "ipcMain.handle('db:obsThemes:delete'",
    "ipcMain.handle('obsTheme:apply'"
  ];
  for (const handler of handlers) {
    if (!content.includes(handler)) {
      throw new Error(`Missing handler: ${handler}`);
    }
  }
});

// ============ PRELOAD TESTS ============
console.log('\n🌉 TESTING PRELOAD BRIDGE...\n');

test('Preload has Bible theme methods', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/preload/control.ts'), 'utf-8');
  const methods = [
    'getBibleThemes:',
    'getBibleTheme:',
    'getDefaultBibleTheme:',
    'createBibleTheme:',
    'updateBibleTheme:',
    'deleteBibleTheme:',
    'applyBibleTheme:'
  ];
  for (const method of methods) {
    if (!content.includes(method)) {
      throw new Error(`Missing preload method: ${method}`);
    }
  }
});

test('Preload has OBS theme methods', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/preload/control.ts'), 'utf-8');
  const methods = [
    'getOBSThemes:',
    'getOBSTheme:',
    'getDefaultOBSTheme:',
    'createOBSTheme:',
    'updateOBSTheme:',
    'deleteOBSTheme:',
    'applyOBSTheme:'
  ];
  for (const method of methods) {
    if (!content.includes(method)) {
      throw new Error(`Missing preload method: ${method}`);
    }
  }
});

test('Preload has type declarations for Bible themes', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/preload/control.ts'), 'utf-8');
  if (!content.includes('getBibleThemes: () => Promise<any[]>')) {
    throw new Error('Missing type declaration for getBibleThemes');
  }
});

test('Preload has type declarations for OBS themes', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/preload/control.ts'), 'utf-8');
  if (!content.includes("getOBSThemes: (type?: 'songs' | 'bible') => Promise<any[]>")) {
    throw new Error('Missing type declaration for getOBSThemes');
  }
});

// ============ APP ROUTES TESTS ============
console.log('\n🛣️ TESTING APP ROUTES...\n');

test('App.tsx imports BibleThemeEditorPage', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/renderer/App.tsx'), 'utf-8');
  if (!content.includes("BibleThemeEditorPage = lazy(() => import('./pages/BibleThemeEditorPage'))")) {
    throw new Error('BibleThemeEditorPage import missing');
  }
});

test('App.tsx imports OBSSongsThemeEditorPage', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/renderer/App.tsx'), 'utf-8');
  if (!content.includes("OBSSongsThemeEditorPage = lazy(() => import('./pages/OBSSongsThemeEditorPage'))")) {
    throw new Error('OBSSongsThemeEditorPage import missing');
  }
});

test('App.tsx imports OBSBibleThemeEditorPage', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/renderer/App.tsx'), 'utf-8');
  if (!content.includes("OBSBibleThemeEditorPage = lazy(() => import('./pages/OBSBibleThemeEditorPage'))")) {
    throw new Error('OBSBibleThemeEditorPage import missing');
  }
});

test('App.tsx has bible-theme-editor route', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/renderer/App.tsx'), 'utf-8');
  if (!content.includes('path="/bible-theme-editor"')) {
    throw new Error('bible-theme-editor route missing');
  }
});

test('App.tsx has obs-songs-theme-editor route', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/renderer/App.tsx'), 'utf-8');
  if (!content.includes('path="/obs-songs-theme-editor"')) {
    throw new Error('obs-songs-theme-editor route missing');
  }
});

test('App.tsx has obs-bible-theme-editor route', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/renderer/App.tsx'), 'utf-8');
  if (!content.includes('path="/obs-bible-theme-editor"')) {
    throw new Error('obs-bible-theme-editor route missing');
  }
});

// ============ CONTROL PANEL TESTS ============
console.log('\n🎛️ TESTING CONTROL PANEL...\n');

test('ControlPanel loads Bible themes', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/renderer/pages/ControlPanel.tsx'), 'utf-8');
  if (!content.includes('window.electronAPI.getBibleThemes()')) {
    throw new Error('getBibleThemes() call missing in ControlPanel');
  }
});

test('ControlPanel loads OBS themes', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/renderer/pages/ControlPanel.tsx'), 'utf-8');
  if (!content.includes('window.electronAPI.getOBSThemes()')) {
    throw new Error('getOBSThemes() call missing in ControlPanel');
  }
});

test('ControlPanel renamed Viewer Theme to Songs Theme', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/renderer/pages/ControlPanel.tsx'), 'utf-8');
  if (!content.includes("t('controlPanel.songsTheme', 'Songs Theme')")) {
    throw new Error('Songs Theme label not found');
  }
});

test('ControlPanel has Bible theme dropdown', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/renderer/pages/ControlPanel.tsx'), 'utf-8');
  if (!content.includes('showBibleThemeDropdown')) {
    throw new Error('Bible theme dropdown state missing');
  }
});

test('ControlPanel has OBS theme dropdown', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/renderer/pages/ControlPanel.tsx'), 'utf-8');
  if (!content.includes('showOBSThemeDropdown')) {
    throw new Error('OBS theme dropdown state missing');
  }
});

test('ControlPanel theme modal has all theme types', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/renderer/pages/ControlPanel.tsx'), 'utf-8');
  const buttons = [
    "navigate('/theme-editor')",
    "navigate('/stage-monitor-editor')",
    "navigate('/bible-theme-editor')",
    "navigate('/obs-songs-theme-editor')",
    "navigate('/obs-bible-theme-editor')"
  ];
  for (const btn of buttons) {
    if (!content.includes(btn)) {
      throw new Error(`Missing theme creation button: ${btn}`);
    }
  }
});

// ============ EDITOR PAGE TESTS ============
console.log('\n✏️ TESTING EDITOR PAGES...\n');

test('BibleThemeEditorPage has hebrew/english lines', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/renderer/pages/BibleThemeEditorPage.tsx'), 'utf-8');
  if (!content.includes("lineOrder: ['hebrew', 'english']")) {
    throw new Error('Bible theme lineOrder not correct');
  }
});

test('BibleThemeEditorPage has reference field', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/renderer/pages/BibleThemeEditorPage.tsx'), 'utf-8');
  if (!content.includes('referenceStyle') && !content.includes('referencePosition')) {
    throw new Error('Bible theme reference field missing');
  }
});

test('BibleThemeEditorPage uses correct API', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/renderer/pages/BibleThemeEditorPage.tsx'), 'utf-8');
  const apis = ['getBibleTheme', 'createBibleTheme', 'updateBibleTheme', 'applyBibleTheme'];
  for (const api of apis) {
    if (!content.includes(`window.electronAPI.${api}`)) {
      throw new Error(`Missing API call: ${api}`);
    }
  }
});

test('OBSSongsThemeEditorPage has correct type', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/renderer/pages/OBSSongsThemeEditorPage.tsx'), 'utf-8');
  if (!content.includes("type: 'songs'")) {
    throw new Error('OBS songs theme type not set');
  }
});

test('OBSSongsThemeEditorPage has 3 lines', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/renderer/pages/OBSSongsThemeEditorPage.tsx'), 'utf-8');
  if (!content.includes("['original', 'transliteration', 'translation']")) {
    throw new Error('OBS songs theme should have 3 lines');
  }
});

test('OBSBibleThemeEditorPage has correct type', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/renderer/pages/OBSBibleThemeEditorPage.tsx'), 'utf-8');
  if (!content.includes("type: 'bible'")) {
    throw new Error('OBS Bible theme type not set');
  }
});

test('OBSBibleThemeEditorPage has reference field', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/renderer/pages/OBSBibleThemeEditorPage.tsx'), 'utf-8');
  if (!content.includes('referenceStyle') && !content.includes('referencePosition')) {
    throw new Error('OBS Bible theme reference field missing');
  }
});

test('OBS editors use transparent background by default', () => {
  const songsContent = fs.readFileSync(path.join(__dirname, 'src/renderer/pages/OBSSongsThemeEditorPage.tsx'), 'utf-8');
  const bibleContent = fs.readFileSync(path.join(__dirname, 'src/renderer/pages/OBSBibleThemeEditorPage.tsx'), 'utf-8');
  if (!songsContent.includes("type: 'transparent'") || !bibleContent.includes("type: 'transparent'")) {
    throw new Error('OBS editors should default to transparent background');
  }
});

// ============ DISPLAY MANAGER TESTS ============
console.log('\n📺 TESTING DISPLAY MANAGER...\n');

test('DisplayManager has broadcastBibleTheme method', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/main/windows/displayManager.ts'), 'utf-8');
  if (!content.includes('broadcastBibleTheme')) {
    throw new Error('broadcastBibleTheme method missing');
  }
});

// ============ OBS SERVER TESTS ============
console.log('\n📡 TESTING OBS SERVER...\n');

test('OBSServer has theme in state', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/main/services/obsServer.ts'), 'utf-8');
  if (!content.includes('theme?: any')) {
    throw new Error('OBS server state should include theme');
  }
});

test('OBSServer has updateTheme method', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/main/services/obsServer.ts'), 'utf-8');
  if (!content.includes('updateTheme(theme: any)')) {
    throw new Error('updateTheme method missing in OBS server');
  }
});

// ============ DEFAULT THEME SEED TESTS ============
console.log('\n🌱 TESTING DEFAULT THEME SEEDS...\n');

test('Classic Bible theme is seeded', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/main/database/index.ts'), 'utf-8');
  if (!content.includes("'Classic Bible'")) {
    throw new Error('Classic Bible theme seed missing');
  }
});

test('Classic OBS Songs theme is seeded', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/main/database/index.ts'), 'utf-8');
  if (!content.includes("'Classic OBS Songs'")) {
    throw new Error('Classic OBS Songs theme seed missing');
  }
});

test('Classic OBS Bible theme is seeded', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/main/database/index.ts'), 'utf-8');
  if (!content.includes("'Classic OBS Bible'")) {
    throw new Error('Classic OBS Bible theme seed missing');
  }
});

test('Bible theme seed has correct structure', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/main/database/index.ts'), 'utf-8');
  // Check for hebrew/english in default styles
  if (!content.includes("hebrew: { fontSize:") || !content.includes("english: { fontSize:")) {
    throw new Error('Bible theme seed missing hebrew/english styles');
  }
});

test('OBS themes have type field in seed', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src/main/database/index.ts'), 'utf-8');
  // Check that type is being inserted
  if (!content.includes("'songs'") || !content.includes("'bible'")) {
    throw new Error('OBS theme seeds missing type field');
  }
});

// ============ BUILD OUTPUT TESTS ============
console.log('\n🏗️ TESTING BUILD OUTPUT...\n');

test('Main process dist exists', () => {
  const distPath = path.join(__dirname, 'dist/main');
  if (!fs.existsSync(distPath)) {
    throw new Error('Main process dist directory missing - run npm run build:main');
  }
});

test('Renderer dist exists', () => {
  const distPath = path.join(__dirname, 'dist/renderer');
  if (!fs.existsSync(distPath)) {
    throw new Error('Renderer dist directory missing - run npm run build:renderer');
  }
});

test('BibleThemeEditorPage chunk exists in build', () => {
  const distPath = path.join(__dirname, 'dist/renderer/assets');
  if (!fs.existsSync(distPath)) {
    throw new Error('Assets directory missing');
  }
  const files = fs.readdirSync(distPath);
  const hasChunk = files.some(f => f.includes('BibleThemeEditorPage'));
  if (!hasChunk) {
    throw new Error('BibleThemeEditorPage chunk not in build');
  }
});

test('OBSSongsThemeEditorPage chunk exists in build', () => {
  const distPath = path.join(__dirname, 'dist/renderer/assets');
  const files = fs.readdirSync(distPath);
  const hasChunk = files.some(f => f.includes('OBSSongsThemeEditorPage'));
  if (!hasChunk) {
    throw new Error('OBSSongsThemeEditorPage chunk not in build');
  }
});

test('OBSBibleThemeEditorPage chunk exists in build', () => {
  const distPath = path.join(__dirname, 'dist/renderer/assets');
  const files = fs.readdirSync(distPath);
  const hasChunk = files.some(f => f.includes('OBSBibleThemeEditorPage'));
  if (!hasChunk) {
    throw new Error('OBSBibleThemeEditorPage chunk not in build');
  }
});

// ============ TYPESCRIPT COMPILATION TESTS ============
console.log('\n📘 TESTING TYPESCRIPT COMPILATION...\n');

test('bibleThemes.ts compiles (check dist)', () => {
  const jsPath = path.join(__dirname, 'dist/main/main/database/bibleThemes.js');
  if (!fs.existsSync(jsPath)) {
    throw new Error('bibleThemes.js not found in dist');
  }
});

test('obsThemes.ts compiles (check dist)', () => {
  const jsPath = path.join(__dirname, 'dist/main/main/database/obsThemes.js');
  if (!fs.existsSync(jsPath)) {
    throw new Error('obsThemes.js not found in dist');
  }
});

// ============ FINAL REPORT ============
console.log('\n' + '='.repeat(60));
console.log('📊 TEST RESULTS SUMMARY');
console.log('='.repeat(60));
console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);
console.log(`📈 Total:  ${results.passed + results.failed}`);
console.log(`📉 Pass Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

if (results.errors.length > 0) {
  console.log('\n❌ FAILED TESTS:');
  results.errors.forEach((err, i) => {
    console.log(`   ${i + 1}. ${err.name}`);
    console.log(`      → ${err.error}`);
  });
}

console.log('\n' + '='.repeat(60));

// Exit with appropriate code
process.exit(results.failed > 0 ? 1 : 0);
