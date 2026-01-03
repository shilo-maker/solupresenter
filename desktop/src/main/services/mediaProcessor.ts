import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { generateId } from '../database';

// Media library folder in app data
const mediaLibraryPath = path.join(app.getPath('userData'), 'media-library');

// Ensure media library folder exists
export function ensureMediaLibrary(): void {
  if (!fs.existsSync(mediaLibraryPath)) {
    fs.mkdirSync(mediaLibraryPath, { recursive: true });
  }
}

/**
 * Get the path to ffmpeg executable
 * Try ffmpeg-static first, then system ffmpeg
 */
function getFfmpegPath(): string | null {
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
    console.log('[mediaProcessor] Checking unpacked ffmpeg at:', unpackedPath);
    if (fs.existsSync(unpackedPath)) {
      console.log('[mediaProcessor] Found ffmpeg in asar.unpacked');
      return unpackedPath;
    }
  }

  // Try to use ffmpeg-static require (works in development)
  try {
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
      console.log('[mediaProcessor] Found ffmpeg-static at:', ffmpegStatic);
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
      console.log('[mediaProcessor] Found system ffmpeg at:', p);
      return p;
    }
  }

  console.warn('[mediaProcessor] ffmpeg not found');
  return null;
}

export interface ProcessResult {
  success: boolean;
  processedPath: string;
  duration: number | null;
  error?: string;
}

/**
 * Process a video file to optimize for streaming (move moov atom to beginning)
 */
export async function processVideo(inputPath: string, fileName: string): Promise<ProcessResult> {
  ensureMediaLibrary();

  const outputFileName = `${generateId()}_${fileName}`;
  const outputPath = path.join(mediaLibraryPath, outputFileName);

  const ffmpegPath = getFfmpegPath();

  if (!ffmpegPath) {
    // No ffmpeg available - just copy the file
    console.log('[mediaProcessor] ffmpeg not found, copying file as-is');
    try {
      await fs.promises.copyFile(inputPath, outputPath);
      return {
        success: true,
        processedPath: outputPath,
        duration: null
      };
    } catch (error) {
      return {
        success: false,
        processedPath: '',
        duration: null,
        error: `Failed to copy file: ${error}`
      };
    }
  }

  // Use ffmpeg to remux with faststart
  return new Promise((resolve) => {
    console.log(`[mediaProcessor] Processing video with ffmpeg: ${inputPath}`);

    const args = [
      '-i', inputPath,
      '-c', 'copy',           // Copy streams without re-encoding
      '-movflags', 'faststart', // Move moov atom to beginning
      '-y',                   // Overwrite output
      outputPath
    ];

    const ffmpeg = spawn(ffmpegPath, args);

    let stderr = '';
    let duration: number | null = null;

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
      // Parse duration from ffmpeg output
      const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (durationMatch) {
        const hours = parseInt(durationMatch[1], 10);
        const minutes = parseInt(durationMatch[2], 10);
        const seconds = parseInt(durationMatch[3], 10);
        const centiseconds = parseInt(durationMatch[4], 10);
        duration = hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
      }
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`[mediaProcessor] Video processed successfully: ${outputPath}`);
        resolve({
          success: true,
          processedPath: outputPath,
          duration
        });
      } else {
        console.error(`[mediaProcessor] ffmpeg failed with code ${code}: ${stderr}`);
        // Try to copy as fallback
        fs.promises.copyFile(inputPath, outputPath)
          .then(() => {
            resolve({
              success: true,
              processedPath: outputPath,
              duration: null
            });
          })
          .catch((error) => {
            resolve({
              success: false,
              processedPath: '',
              duration: null,
              error: `ffmpeg failed and copy failed: ${error}`
            });
          });
      }
    });

    ffmpeg.on('error', (error) => {
      console.error(`[mediaProcessor] ffmpeg error: ${error}`);
      // Try to copy as fallback
      fs.promises.copyFile(inputPath, outputPath)
        .then(() => {
          resolve({
            success: true,
            processedPath: outputPath,
            duration: null
          });
        })
        .catch((copyError) => {
          resolve({
            success: false,
            processedPath: '',
            duration: null,
            error: `ffmpeg error and copy failed: ${copyError}`
          });
        });
    });
  });
}

/**
 * Process an audio file (just copy to media library)
 */
export async function processAudio(inputPath: string, fileName: string): Promise<ProcessResult> {
  ensureMediaLibrary();

  const outputFileName = `${generateId()}_${fileName}`;
  const outputPath = path.join(mediaLibraryPath, outputFileName);

  try {
    await fs.promises.copyFile(inputPath, outputPath);
    return {
      success: true,
      processedPath: outputPath,
      duration: null  // Could extract with ffprobe if needed
    };
  } catch (error) {
    return {
      success: false,
      processedPath: '',
      duration: null,
      error: `Failed to copy audio: ${error}`
    };
  }
}

/**
 * Process an image file (just copy to media library)
 */
export async function processImage(inputPath: string, fileName: string): Promise<ProcessResult> {
  ensureMediaLibrary();

  const outputFileName = `${generateId()}_${fileName}`;
  const outputPath = path.join(mediaLibraryPath, outputFileName);

  try {
    await fs.promises.copyFile(inputPath, outputPath);
    return {
      success: true,
      processedPath: outputPath,
      duration: null
    };
  } catch (error) {
    return {
      success: false,
      processedPath: '',
      duration: null,
      error: `Failed to copy image: ${error}`
    };
  }
}

/**
 * Delete a processed media file
 */
export async function deleteProcessedMedia(processedPath: string): Promise<void> {
  try {
    if (fs.existsSync(processedPath)) {
      await fs.promises.unlink(processedPath);
    }
  } catch (error) {
    console.error(`[mediaProcessor] Failed to delete: ${error}`);
  }
}

/**
 * Get media library path
 */
export function getMediaLibraryPath(): string {
  ensureMediaLibrary();
  return mediaLibraryPath;
}
