import * as esbuild from 'esbuild';
import { readdirSync, statSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const isWatch = process.argv.includes('--watch');
const shouldClean = !isWatch; // Clean on full builds, not watch mode

// Get all TypeScript files from a directory recursively
function getEntryPoints(dir, baseDir = dir) {
  const entries = [];
  const files = readdirSync(dir);

  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      entries.push(...getEntryPoints(fullPath, baseDir));
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts') && !file.includes('.test.') && !file.includes('.spec.')) {
      entries.push(fullPath);
    }
  }

  return entries;
}

const commonOptions = {
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  logLevel: 'warning',
};

async function build() {
  const startTime = Date.now();

  try {
    // Clean output directories on full builds to prevent stale/corrupted files
    if (shouldClean) {
      const mainOutDir = join(rootDir, 'dist/main/main');
      const preloadOutDir = join(rootDir, 'dist/main/preload');

      if (existsSync(mainOutDir)) {
        rmSync(mainOutDir, { recursive: true, force: true });
      }
      if (existsSync(preloadOutDir)) {
        rmSync(preloadOutDir, { recursive: true, force: true });
      }
    }

    // Get entry points
    const mainEntries = getEntryPoints(join(rootDir, 'src/main'));
    const preloadEntries = getEntryPoints(join(rootDir, 'src/preload'));

    // Build main process files
    await esbuild.build({
      ...commonOptions,
      entryPoints: mainEntries,
      outdir: join(rootDir, 'dist/main/main'),
      outbase: join(rootDir, 'src/main'),
    });

    // Build preload scripts
    await esbuild.build({
      ...commonOptions,
      entryPoints: preloadEntries,
      outdir: join(rootDir, 'dist/main/preload'),
      outbase: join(rootDir, 'src/preload'),
    });

    console.log(`[esbuild] Main process compiled in ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error('[esbuild] Build failed:', error.message);
    if (!isWatch) process.exit(1);
  }
}

if (isWatch) {
  console.log('[esbuild] Watching for changes...');

  // Get all entry points for watching
  const mainEntries = getEntryPoints(join(rootDir, 'src/main'));
  const preloadEntries = getEntryPoints(join(rootDir, 'src/preload'));
  const allEntries = [...mainEntries, ...preloadEntries];

  // Create watch contexts
  const mainCtx = await esbuild.context({
    ...commonOptions,
    entryPoints: mainEntries,
    outdir: join(rootDir, 'dist/main/main'),
    outbase: join(rootDir, 'src/main'),
    plugins: [{
      name: 'rebuild-notify',
      setup(build) {
        build.onEnd(result => {
          if (result.errors.length === 0) {
            console.log(`[esbuild] Main rebuilt at ${new Date().toLocaleTimeString()}`);
          }
        });
      }
    }]
  });

  const preloadCtx = await esbuild.context({
    ...commonOptions,
    entryPoints: preloadEntries,
    outdir: join(rootDir, 'dist/main/preload'),
    outbase: join(rootDir, 'src/preload'),
    plugins: [{
      name: 'rebuild-notify',
      setup(build) {
        build.onEnd(result => {
          if (result.errors.length === 0) {
            console.log(`[esbuild] Preload rebuilt at ${new Date().toLocaleTimeString()}`);
          }
        });
      }
    }]
  });

  // Initial build
  await build();

  // Start watching
  await mainCtx.watch();
  await preloadCtx.watch();

  // Keep process alive
  process.on('SIGINT', async () => {
    await mainCtx.dispose();
    await preloadCtx.dispose();
    process.exit(0);
  });
} else {
  await build();
}
