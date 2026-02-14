import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { generateId } from '../database';
import { createLogger } from '../utils/debug';

// Create logger for this module
const log = createLogger('MediaProcessor');

// Media library folder in app data
const mediaLibraryPath = path.join(app.getPath('userData'), 'media-library');

// Track in-progress processing for cleanup on failure
const processingFiles = new Set<string>();

// Timeout for file copy operations (2 minutes)
const FILE_COPY_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Copy file with timeout protection
 * Prevents app from hanging indefinitely on slow/hung I/O
 */
async function copyFileWithTimeout(src: string, dest: string, timeoutMs = FILE_COPY_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      reject(new Error(`File copy timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    fs.promises.copyFile(src, dest)
      .then(() => {
        clearTimeout(timeoutHandle);
        resolve();
      })
      .catch((error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });
  });
}

/**
 * Ensures the media library folder exists in the app's user data directory.
 * Creates the directory recursively if it doesn't exist.
 * Called automatically by media processing functions.
 */
export function ensureMediaLibrary(): void {
  if (!fs.existsSync(mediaLibraryPath)) {
    fs.mkdirSync(mediaLibraryPath, { recursive: true });
  }
}

/**
 * Get the path to ffmpeg executable
 * Try ffmpeg-static first, then system ffmpeg
 */
export function getFfmpegPath(): string | null {
  const isWindows = process.platform === 'win32';
  const ffmpegName = isWindows ? 'ffmpeg.exe' : 'ffmpeg';

  // In production, ffmpeg-static is in asar.unpacked
  if (app.isPackaged) {
    const unpackedPath = path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      'ffmpeg-static',
      ffmpegName
    );
    log.debug('Checking unpacked ffmpeg at:', unpackedPath);
    if (fs.existsSync(unpackedPath)) {
      log.debug('Found ffmpeg in asar.unpacked');
      return unpackedPath;
    }
  }

  // Try to use ffmpeg-static require (works in development)
  try {
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
      log.debug('Found ffmpeg-static at:', ffmpegStatic);
      return ffmpegStatic;
    }
  } catch {
    // ffmpeg-static not installed or not accessible
  }

  // Try system ffmpeg
  const commonPaths = isWindows
    ? ['C:\\ffmpeg\\bin\\ffmpeg.exe', 'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe']
    : ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      log.debug('Found system ffmpeg at:', p);
      return p;
    }
  }

  log.warn('ffmpeg not found');
  return null;
}

/**
 * Result of a media processing operation.
 */
export interface ProcessResult {
  /** Whether the processing completed successfully */
  success: boolean;
  /** Path to the processed file in the media library (empty on failure) */
  processedPath: string;
  /** Duration of the media in seconds (null if unknown or not applicable) */
  duration: number | null;
  /** Path to the generated thumbnail (null if not generated) */
  thumbnailPath: string | null;
  /** Width of the media in pixels (null if unknown) */
  width: number | null;
  /** Height of the media in pixels (null if unknown) */
  height: number | null;
  /** Error message if processing failed */
  error?: string;
}

// Thumbnail settings
const THUMBNAIL_WIDTH = 320;  // Thumbnail width in pixels
const THUMBNAIL_QUALITY = 85; // JPEG quality (1-100)

/**
 * Validate input path for security
 */
function validateInputPath(inputPath: string, fileName: string): { valid: boolean; error?: string } {
  // Check for path traversal attacks
  if (inputPath.includes('..') || fileName.includes('..')) {
    return { valid: false, error: 'Path traversal not allowed' };
  }

  // Ensure path is absolute
  if (!path.isAbsolute(inputPath)) {
    return { valid: false, error: 'Path must be absolute' };
  }

  // Sanitize filename - remove dangerous characters
  const sanitizedFileName = fileName.replace(/[\/\\:*?"<>|]/g, '_');
  if (sanitizedFileName !== fileName) {
    log.warn('Filename contained invalid characters, sanitized');
  }

  // Check if file exists
  if (!fs.existsSync(inputPath)) {
    return { valid: false, error: 'Input file does not exist' };
  }

  return { valid: true };
}

/**
 * Generate a thumbnail from a video file using ffmpeg.
 * Captures a frame at 50% of the video duration.
 */
async function generateVideoThumbnail(
  ffmpegPath: string,
  videoPath: string,
  thumbnailPath: string,
  duration: number | null
): Promise<{ success: boolean; width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    // Seek to middle of video, or 1 second if duration unknown
    const seekTime = duration ? Math.max(0, duration * 0.5) : 1;

    const args = [
      '-ss', String(seekTime),    // Seek to position
      '-i', videoPath,
      '-vframes', '1',            // Extract 1 frame
      '-vf', `scale=${THUMBNAIL_WIDTH}:-1`, // Scale to thumbnail width, maintain aspect
      '-q:v', String(Math.round((100 - THUMBNAIL_QUALITY) / 10)), // Quality (2-10, lower is better)
      '-y',                       // Overwrite output
      thumbnailPath
    ];

    const ffmpeg = spawn(ffmpegPath, args);
    const MAX_STDERR_LENGTH = 4096; // Limit stderr to prevent memory issues
    let stderr = '';
    let width: number | null = null;
    let height: number | null = null;

    ffmpeg.stderr.on('data', (data) => {
      // Limit stderr accumulation to prevent memory issues
      if (stderr.length < MAX_STDERR_LENGTH) {
        stderr += data.toString().slice(0, MAX_STDERR_LENGTH - stderr.length);
      }
      // Parse video dimensions from ffmpeg output (e.g., "1920x1080")
      const dimMatch = stderr.match(/(\d{2,5})x(\d{2,5})/);
      if (dimMatch && !width) {
        width = parseInt(dimMatch[1], 10);
        height = parseInt(dimMatch[2], 10);
      }
    });

    // Helper to clean up listeners and kill process
    const cleanup = () => {
      ffmpeg.removeAllListeners();
      try { if (!ffmpeg.killed) ffmpeg.kill('SIGKILL'); } catch {}
    };

    const timeout = setTimeout(() => {
      log.warn('Video thumbnail generation timed out after 30s');
      cleanup();
      resolve({ success: false, width, height });
    }, 30000); // 30 second timeout for thumbnail

    ffmpeg.on('close', (code) => {
      clearTimeout(timeout);
      ffmpeg.removeAllListeners();
      if (code === 0 && fs.existsSync(thumbnailPath)) {
        log.debug('Video thumbnail generated:', thumbnailPath);
        resolve({ success: true, width, height });
      } else {
        log.warn('Failed to generate video thumbnail, code:', code, 'stderr:', stderr.slice(-500));
        resolve({ success: false, width, height });
      }
    });

    ffmpeg.on('error', (err) => {
      clearTimeout(timeout);
      ffmpeg.removeAllListeners();
      log.warn('Video thumbnail ffmpeg error:', err.message);
      resolve({ success: false, width, height });
    });
  });
}

/**
 * Process a video file for optimized streaming.
 * Uses ffmpeg to remux the video with faststart flag, moving the moov atom
 * to the beginning of the file for faster web playback.
 * Also generates a thumbnail and extracts dimensions.
 *
 * @param inputPath - Absolute path to the source video file
 * @param fileName - Original filename (will be sanitized)
 * @returns Promise resolving to ProcessResult with processed file path, duration, thumbnail, and dimensions
 */
export async function processVideo(inputPath: string, fileName: string): Promise<ProcessResult> {
  // Validate input
  const validation = validateInputPath(inputPath, fileName);
  if (!validation.valid) {
    return { success: false, processedPath: '', duration: null, thumbnailPath: null, width: null, height: null, error: validation.error };
  }

  ensureMediaLibrary();

  // Sanitize filename
  const sanitizedFileName = fileName.replace(/[\/\\:*?"<>|]/g, '_');
  const baseId = generateId();
  const outputFileName = `${baseId}_${sanitizedFileName}`;
  const outputPath = path.join(mediaLibraryPath, outputFileName);
  const thumbnailFileName = `${baseId}_thumb.jpg`;
  const thumbnailPath = path.join(mediaLibraryPath, thumbnailFileName);

  const ffmpegPath = getFfmpegPath();

  if (!ffmpegPath) {
    // No ffmpeg available - just copy the file (no thumbnail or dimensions)
    log.info('ffmpeg not found, copying file as-is');
    try {
      await copyFileWithTimeout(inputPath, outputPath);
      return {
        success: true,
        processedPath: outputPath,
        duration: null,
        thumbnailPath: null,
        width: null,
        height: null
      };
    } catch (error) {
      return {
        success: false,
        processedPath: '',
        duration: null,
        thumbnailPath: null,
        width: null,
        height: null,
        error: `Failed to copy file: ${error}`
      };
    }
  }

  // Track this file for cleanup on failure
  processingFiles.add(outputPath);

  // Timeout for ffmpeg processing (5 minutes max)
  const FFMPEG_TIMEOUT_MS = 5 * 60 * 1000;

  return new Promise((resolve) => {
    log.info(`Processing video with ffmpeg: ${inputPath}`);

    const args = [
      '-i', inputPath,
      '-c', 'copy',           // Copy streams without re-encoding
      '-movflags', 'faststart', // Move moov atom to beginning
      '-y',                   // Overwrite output
      outputPath
    ];

    const ffmpeg = spawn(ffmpegPath, args);
    const MAX_STDERR_LENGTH = 8192; // Limit stderr to prevent memory issues
    let resolved = false;
    let stderr = '';
    let duration: number | null = null;
    let width: number | null = null;
    let height: number | null = null;

    // Helper to safely resolve only once
    const safeResolve = (result: ProcessResult) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutHandle);
        ffmpeg.removeAllListeners();
        resolve(result);
      }
    };

    // Helper to kill ffmpeg process and clean up listeners
    const killProcess = () => {
      try {
        ffmpeg.removeAllListeners();
        if (!ffmpeg.killed) {
          ffmpeg.kill('SIGKILL');
          log.debug('Killed ffmpeg process');
        }
      } catch (e) {
        // Ignore kill errors
      }
    };

    // Helper to clean up partial file on failure
    const cleanupOnFailure = async () => {
      processingFiles.delete(outputPath);
      killProcess();
      try {
        if (fs.existsSync(outputPath)) {
          await fs.promises.unlink(outputPath);
          log.debug('Cleaned up partial file:', outputPath);
        }
        if (fs.existsSync(thumbnailPath)) {
          await fs.promises.unlink(thumbnailPath);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    };

    // Set timeout to kill hung ffmpeg processes
    const timeoutHandle = setTimeout(async () => {
      if (!resolved) {
        log.error('ffmpeg timed out, killing process');
        await cleanupOnFailure();
        // Try to copy as fallback
        try {
          await copyFileWithTimeout(inputPath, outputPath);
          safeResolve({
            success: true,
            processedPath: outputPath,
            duration: null,
            thumbnailPath: null,
            width: null,
            height: null
          });
        } catch (copyError) {
          safeResolve({
            success: false,
            processedPath: '',
            duration: null,
            thumbnailPath: null,
            width: null,
            height: null,
            error: `ffmpeg timed out and copy failed: ${copyError}`
          });
        }
      }
    }, FFMPEG_TIMEOUT_MS);

    ffmpeg.stderr.on('data', (data) => {
      // Limit stderr accumulation to prevent memory issues
      if (stderr.length < MAX_STDERR_LENGTH) {
        stderr += data.toString().slice(0, MAX_STDERR_LENGTH - stderr.length);
      }
      // Parse duration from ffmpeg output
      const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (durationMatch) {
        const hours = parseInt(durationMatch[1], 10);
        const minutes = parseInt(durationMatch[2], 10);
        const seconds = parseInt(durationMatch[3], 10);
        const centiseconds = parseInt(durationMatch[4], 10);
        duration = hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
      }
      // Parse video dimensions from ffmpeg output (e.g., "Stream #0:0: Video: ... 1920x1080")
      const dimMatch = stderr.match(/Stream.*Video.*?(\d{2,5})x(\d{2,5})/);
      if (dimMatch && !width) {
        width = parseInt(dimMatch[1], 10);
        height = parseInt(dimMatch[2], 10);
      }
    });

    ffmpeg.on('close', async (code) => {
      if (resolved) return;
      processingFiles.delete(outputPath);

      if (code === 0) {
        log.info(`Video processed successfully: ${outputPath}`);

        // Generate thumbnail after video is processed
        let finalThumbnailPath: string | null = null;
        const thumbResult = await generateVideoThumbnail(ffmpegPath, outputPath, thumbnailPath, duration);
        if (thumbResult.success) {
          finalThumbnailPath = thumbnailPath;
        } else {
          // Clean up partial thumbnail file if generation failed
          try {
            if (fs.existsSync(thumbnailPath)) {
              await fs.promises.unlink(thumbnailPath);
              log.debug('Cleaned up failed thumbnail:', thumbnailPath);
            }
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        // Use dimensions from thumbnail generation if not already found
        if (!width && thumbResult.width) {
          width = thumbResult.width;
          height = thumbResult.height;
        }

        safeResolve({
          success: true,
          processedPath: outputPath,
          duration,
          thumbnailPath: finalThumbnailPath,
          width,
          height
        });
      } else {
        log.error(`ffmpeg failed with code ${code}: ${stderr}`);
        await cleanupOnFailure();
        // Try to copy as fallback
        try {
          await copyFileWithTimeout(inputPath, outputPath);
          safeResolve({
            success: true,
            processedPath: outputPath,
            duration: null,
            thumbnailPath: null,
            width: null,
            height: null
          });
        } catch (copyError) {
          safeResolve({
            success: false,
            processedPath: '',
            duration: null,
            thumbnailPath: null,
            width: null,
            height: null,
            error: `ffmpeg failed and copy failed: ${copyError}`
          });
        }
      }
    });

    ffmpeg.on('error', async (error) => {
      if (resolved) return;
      log.error(`ffmpeg error: ${error}`);
      await cleanupOnFailure();
      // Try to copy as fallback
      try {
        await copyFileWithTimeout(inputPath, outputPath);
        safeResolve({
          success: true,
          processedPath: outputPath,
          duration: null,
          thumbnailPath: null,
          width: null,
          height: null
        });
      } catch (copyError) {
        safeResolve({
          success: false,
          processedPath: '',
          duration: null,
          thumbnailPath: null,
          width: null,
          height: null,
          error: `ffmpeg error and copy failed: ${copyError}`
        });
      }
    });
  });
}

/**
 * Process an audio file by copying it to the media library.
 * Currently performs a simple copy; could be extended to extract duration
 * using ffprobe if needed.
 *
 * @param inputPath - Absolute path to the source audio file
 * @param fileName - Original filename (will be sanitized)
 * @returns Promise resolving to ProcessResult with copied file path
 */
export async function processAudio(inputPath: string, fileName: string): Promise<ProcessResult> {
  // Validate input
  const validation = validateInputPath(inputPath, fileName);
  if (!validation.valid) {
    return { success: false, processedPath: '', duration: null, thumbnailPath: null, width: null, height: null, error: validation.error };
  }

  ensureMediaLibrary();

  // Sanitize filename
  const sanitizedFileName = fileName.replace(/[\/\\:*?"<>|]/g, '_');
  const outputFileName = `${generateId()}_${sanitizedFileName}`;
  const outputPath = path.join(mediaLibraryPath, outputFileName);

  try {
    await copyFileWithTimeout(inputPath, outputPath);
    return {
      success: true,
      processedPath: outputPath,
      duration: null,  // Could extract with ffprobe if needed
      thumbnailPath: null,  // Audio doesn't have visual thumbnail
      width: null,
      height: null
    };
  } catch (error) {
    return {
      success: false,
      processedPath: '',
      duration: null,
      thumbnailPath: null,
      width: null,
      height: null,
      error: `Failed to copy audio: ${error}`
    };
  }
}

/**
 * Generate a thumbnail from an image file using ffmpeg.
 * Also extracts the original image dimensions.
 */
async function generateImageThumbnail(
  ffmpegPath: string,
  imagePath: string,
  thumbnailPath: string
): Promise<{ success: boolean; width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const args = [
      '-i', imagePath,
      '-vf', `scale=${THUMBNAIL_WIDTH}:-1`, // Scale to thumbnail width, maintain aspect
      '-q:v', String(Math.round((100 - THUMBNAIL_QUALITY) / 10)),
      '-y',
      thumbnailPath
    ];

    const ffmpeg = spawn(ffmpegPath, args);
    const MAX_STDERR_LENGTH = 4096; // Limit stderr to prevent memory issues
    let stderr = '';
    let width: number | null = null;
    let height: number | null = null;

    ffmpeg.stderr.on('data', (data) => {
      // Limit stderr accumulation to prevent memory issues
      if (stderr.length < MAX_STDERR_LENGTH) {
        stderr += data.toString().slice(0, MAX_STDERR_LENGTH - stderr.length);
      }
      // Parse image dimensions from ffmpeg output
      const dimMatch = stderr.match(/(\d{2,5})x(\d{2,5})/);
      if (dimMatch && !width) {
        width = parseInt(dimMatch[1], 10);
        height = parseInt(dimMatch[2], 10);
      }
    });

    // Helper to clean up listeners and kill process
    const cleanup = () => {
      ffmpeg.removeAllListeners();
      try { if (!ffmpeg.killed) ffmpeg.kill('SIGKILL'); } catch {}
    };

    const timeout = setTimeout(() => {
      log.warn('Image thumbnail generation timed out after 30s');
      cleanup();
      resolve({ success: false, width, height });
    }, 30000);

    ffmpeg.on('close', (code) => {
      clearTimeout(timeout);
      ffmpeg.removeAllListeners();
      if (code === 0 && fs.existsSync(thumbnailPath)) {
        log.debug('Image thumbnail generated:', thumbnailPath);
        resolve({ success: true, width, height });
      } else {
        log.warn('Failed to generate image thumbnail, code:', code, 'stderr:', stderr.slice(-500));
        resolve({ success: false, width, height });
      }
    });

    ffmpeg.on('error', (err) => {
      clearTimeout(timeout);
      ffmpeg.removeAllListeners();
      log.warn('Image thumbnail ffmpeg error:', err.message);
      resolve({ success: false, width, height });
    });
  });
}

/**
 * Process an image file by copying it to the media library.
 * Also generates a thumbnail and extracts dimensions.
 *
 * @param inputPath - Absolute path to the source image file
 * @param fileName - Original filename (will be sanitized)
 * @returns Promise resolving to ProcessResult with copied file path, thumbnail, and dimensions
 */
export async function processImage(inputPath: string, fileName: string): Promise<ProcessResult> {
  // Validate input
  const validation = validateInputPath(inputPath, fileName);
  if (!validation.valid) {
    return { success: false, processedPath: '', duration: null, thumbnailPath: null, width: null, height: null, error: validation.error };
  }

  ensureMediaLibrary();

  // Sanitize filename
  const sanitizedFileName = fileName.replace(/[\/\\:*?"<>|]/g, '_');
  const baseId = generateId();
  const outputFileName = `${baseId}_${sanitizedFileName}`;
  const outputPath = path.join(mediaLibraryPath, outputFileName);
  const thumbnailFileName = `${baseId}_thumb.jpg`;
  const thumbnailPath = path.join(mediaLibraryPath, thumbnailFileName);

  try {
    await copyFileWithTimeout(inputPath, outputPath);

    // Try to generate thumbnail and extract dimensions
    const ffmpegPath = getFfmpegPath();
    let finalThumbnailPath: string | null = null;
    let width: number | null = null;
    let height: number | null = null;

    if (ffmpegPath) {
      const result = await generateImageThumbnail(ffmpegPath, outputPath, thumbnailPath);
      if (result.success) {
        finalThumbnailPath = thumbnailPath;
      } else {
        // Clean up partial thumbnail file if generation failed
        try {
          if (fs.existsSync(thumbnailPath)) {
            await fs.promises.unlink(thumbnailPath);
            log.debug('Cleaned up failed image thumbnail:', thumbnailPath);
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      width = result.width;
      height = result.height;
    }

    return {
      success: true,
      processedPath: outputPath,
      duration: null,
      thumbnailPath: finalThumbnailPath,
      width,
      height
    };
  } catch (error) {
    return {
      success: false,
      processedPath: '',
      duration: null,
      thumbnailPath: null,
      width: null,
      height: null,
      error: `Failed to copy image: ${error}`
    };
  }
}

/**
 * Delete a processed media file from the media library.
 * Only deletes files within the media library directory for security.
 * Silently fails if the file doesn't exist or is outside the library.
 *
 * @param processedPath - Path to the processed file to delete
 */
export async function deleteProcessedMedia(processedPath: string): Promise<void> {
  try {
    // Validate path - must be within media library
    const normalizedPath = path.normalize(processedPath);
    if (!normalizedPath.startsWith(mediaLibraryPath)) {
      log.error('Cannot delete file outside media library:', processedPath);
      return;
    }
    // Prevent path traversal
    if (normalizedPath.includes('..')) {
      log.error('Path traversal not allowed:', processedPath);
      return;
    }
    if (fs.existsSync(normalizedPath)) {
      await fs.promises.unlink(normalizedPath);
    }
  } catch (error) {
    log.error(`Failed to delete: ${error}`);
  }
}

/**
 * Get the absolute path to the media library directory.
 * Creates the directory if it doesn't exist.
 *
 * @returns Absolute path to the media library in the app's user data folder
 */
export function getMediaLibraryPath(): string {
  ensureMediaLibrary();
  return mediaLibraryPath;
}

/**
 * Clean up any files that were being processed when the app crashed.
 * Call this on app startup to remove partial/orphaned files.
 *
 * Criteria for orphaned files:
 * - Empty files older than 1 hour (failed to write)
 * - Files currently in processingFiles set (leftover from crash)
 * - Very small files (<1KB) older than 1 hour that aren't valid media
 */
export async function cleanupOrphanedFiles(): Promise<void> {
  try {
    if (!fs.existsSync(mediaLibraryPath)) {
      return;
    }

    const files = await fs.promises.readdir(mediaLibraryPath);
    const now = Date.now();
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const MIN_VALID_SIZE = 1024; // 1KB minimum for valid media files
    let cleanedCount = 0;

    for (const file of files) {
      const filePath = path.join(mediaLibraryPath, file);

      try {
        const stat = await fs.promises.stat(filePath);
        const fileAge = now - stat.mtimeMs;
        const isOld = fileAge > ONE_HOUR_MS;

        // Check for files that should be cleaned up:
        // 1. Empty files older than 1 hour
        // 2. Very small files (<1KB) older than 1 hour (likely partial writes)
        // 3. Files still in processingFiles set (leftover from interrupted processing)
        const shouldCleanup =
          (stat.size === 0 && isOld) ||
          (stat.size < MIN_VALID_SIZE && isOld && !isValidSmallFile(file)) ||
          processingFiles.has(filePath);

        if (shouldCleanup) {
          log.info('Cleaning up orphaned file:', file, `(size: ${stat.size}, age: ${Math.round(fileAge / 1000)}s)`);
          await fs.promises.unlink(filePath);
          processingFiles.delete(filePath);
          cleanedCount++;
        }
      } catch (e) {
        // Ignore individual file errors
      }
    }

    if (cleanedCount > 0) {
      log.info(`Orphaned file cleanup complete: removed ${cleanedCount} files`);
    } else {
      log.debug('Orphaned file cleanup complete: no files to clean');
    }
  } catch (error) {
    log.error('Error during orphaned file cleanup:', error);
  }
}

/**
 * Check if a small file is a valid media file that should be kept
 * Some valid media files (like tiny icons) can be very small
 */
function isValidSmallFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  // Small SVG or ICO files might be legitimate
  return ext === '.svg' || ext === '.ico';
}

/**
 * Get count of files currently being processed.
 * Useful for UI feedback.
 */
export function getProcessingCount(): number {
  return processingFiles.size;
}
