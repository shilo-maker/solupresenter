import { ChildProcess, spawn } from 'child_process';
import type { BrowserWindow } from 'electron';
import { getFfmpegPath } from './mediaProcessor';
import { createLogger } from '../utils/debug';

const log = createLogger('StreamingService');

export interface StreamConfig {
  rtmpUrl: string;
  streamKey: string;
  windowTitle?: string;
  audioDeviceName: string;
  videoDeviceName?: string;
  captureWindow?: BrowserWindow;
  qualityPreset: 'low' | 'medium' | 'high';
}

export interface StreamStatus {
  isStreaming: boolean;
  stopping: boolean;
  startedAt: number | null;
  fps: number;
  bitrate: string;
  droppedFrames: number;
  dupFrames: number;
  duration: string;
  error: string | null;
}

interface QualitySettings {
  fps: number;
  width: number;
  height: number;
  videoBitrate: string;
  bufsize: string;
  audioBitrate: string;
  keyint: number;
}

const QUALITY_PRESETS: Record<string, QualitySettings> = {
  low:    { fps: 30, width: 1280, height: 720,  videoBitrate: '2500k', bufsize: '5000k',  audioBitrate: '128k', keyint: 60 },
  medium: { fps: 30, width: 1920, height: 1080, videoBitrate: '4500k', bufsize: '9000k',  audioBitrate: '128k', keyint: 60 },
  high:   { fps: 60, width: 1920, height: 1080, videoBitrate: '6000k', bufsize: '12000k', audioBitrate: '192k', keyint: 120 }
};

// Regex to parse FFmpeg progress from stderr (order: frame, fps, time, bitrate)
const PROGRESS_REGEX = /frame=\s*(\d+)\s+fps=\s*([\d.]+).*?time=(\d{2}:\d{2}:\d{2}\.\d{2}).*?bitrate=\s*(\S+)/;
// Combined regex for error detection (pre-compiled for efficiency)
const ERROR_PATTERNS = [
  'Connection refused',
  'Connection timed out',
  'Server returned 4',
  'Server returned 5',
  'Input/output error',
  'Connection reset by peer',
  'Broken pipe'
];
const ERROR_REGEX = new RegExp(ERROR_PATTERNS.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));

type StatusCallback = (status: StreamStatus) => void;

/**
 * Test whether a specific H.264 encoder actually works on this hardware
 * by attempting a tiny encode. Uses 256x256 (above NVENC's minimum frame size).
 */
async function testEncoder(ffmpegPath: string, encoder: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath, [
      '-f', 'lavfi', '-i', 'color=black:s=256x256:d=0.04:r=25',
      '-c:v', encoder, '-frames:v', '1',
      '-f', 'null', process.platform === 'win32' ? 'NUL' : '/dev/null'
    ], {
      stdio: ['ignore', 'ignore', 'ignore'],
      windowsHide: true
    });

    const timeout = setTimeout(() => {
      try { proc.kill(); } catch {}
      resolve(false);
    }, 3000);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      resolve(code === 0);
    });
    proc.on('error', () => { clearTimeout(timeout); resolve(false); });
  });
}

/**
 * Detect the best available H.264 encoder by actually testing each one.
 * Prefers hardware encoders (NVENC → QSV → AMF) over software x264.
 */
async function detectEncoder(ffmpegPath: string): Promise<string> {
  const candidates = ['h264_nvenc', 'h264_qsv', 'h264_amf'];
  for (const enc of candidates) {
    if (await testEncoder(ffmpegPath, enc)) {
      log.info(`Hardware encoder detected: ${enc}`);
      return enc;
    }
  }
  log.info('No hardware encoder available, falling back to libx264');
  return 'libx264';
}

let cachedEncoder: string | null = null;

class StreamingService {
  private process: ChildProcess | null = null;
  private status: StreamStatus = {
    isStreaming: false,
    stopping: false,
    startedAt: null,
    fps: 0,
    bitrate: '',
    droppedFrames: 0,
    dupFrames: 0,
    duration: '00:00:00',
    error: null
  };
  private statusCallbacks: StatusCallback[] = [];
  private stderrBuffer = '';
  private stderrLineBuffer = '';
  private statusInterval: NodeJS.Timeout | null = null;
  private frameDeliveryInterval: NodeJS.Timeout | null = null;
  private invalidateInterval: NodeJS.Timeout | null = null;
  private paintHandler: ((...args: any[]) => void) | null = null;
  private captureWindow: BrowserWindow | null = null;
  private usingPipeCapture = false;
  private stopping = false;
  private lastEmittedJson = '';
  private static readonly MAX_STDERR_LENGTH = 8192;

  async start(config: StreamConfig): Promise<{ success: boolean; error?: string }> {
    if (this.process || this.stopping) {
      return { success: false, error: 'Already streaming' };
    }

    const ffmpegPath = getFfmpegPath();
    if (!ffmpegPath) {
      return { success: false, error: 'FFmpeg not found. Install ffmpeg-static or add ffmpeg to PATH.' };
    }

    // Validate config
    if (!config.rtmpUrl || !config.streamKey) {
      return { success: false, error: 'RTMP URL and stream key are required' };
    }
    if (!config.captureWindow && !config.windowTitle) {
      return { success: false, error: 'No display window selected' };
    }
    if (!config.audioDeviceName) {
      return { success: false, error: 'No audio device selected' };
    }

    const quality = QUALITY_PRESETS[config.qualityPreset] || QUALITY_PRESETS.medium;
    const rtmpTarget = `${config.rtmpUrl.replace(/\/+$/, '')}/${config.streamKey}`;
    const hasCamera = !!config.videoDeviceName;
    const usePipeCapture = !!config.captureWindow;

    // Detect best encoder (cached after first call)
    if (!cachedEncoder) {
      cachedEncoder = await detectEncoder(ffmpegPath);
    }
    const encoder = cachedEncoder;
    log.info(`Using encoder: ${encoder}`);
    this.usingPipeCapture = usePipeCapture;

    const args: string[] = [];
    const streamW = quality.width;
    const streamH = quality.height;

    // Use JPEG pipe for no-camera mode (20-30x less pipe data, FFmpeg decodes
    // MJPEG directly to YUV420p skipping swscale). Raw BGRA pipe only needed
    // when camera overlay requires alpha blending.
    const useJpegPipe = usePipeCapture && !hasCamera;

    if (usePipeCapture) {
      // Wall-clock timestamps prevent FPS collapse: without them, FFmpeg reads
      // pipe data in bursts, assigning sequential PTS that advance faster than
      // real-time. The overlay filter then stalls waiting for camera frames to
      // catch up, causing buffer overflow and FPS degradation.
      // For camera mode, setpts in the filter_complex (below) resets both inputs
      // to clean sequential PTS, neutralizing the render delay that wall-clock
      // timestamps encode into overlay frames.
      args.push('-use_wallclock_as_timestamps', '1');

      if (useJpegPipe) {
        // Input 0: JPEG frames piped from Electron (~100-200KB each vs ~4-8MB raw)
        args.push(
          '-probesize', '32',
          '-analyzeduration', '0',
          '-thread_queue_size', '512',
          '-f', 'image2pipe',
          '-framerate', String(quality.fps),
          '-i', 'pipe:0'
        );
      } else {
        // Input 0: Raw BGRA frames (needed for camera alpha overlay)
        args.push(
          '-probesize', '32',
          '-analyzeduration', '0',
          '-thread_queue_size', '512',
          '-f', 'rawvideo',
          '-pixel_format', 'bgra',
          '-video_size', `${streamW}x${streamH}`,
          '-framerate', String(quality.fps),
          '-i', 'pipe:0'
        );
      }
    } else {
      // Visible display window: capture via gdigrab
      args.push(
        '-f', 'gdigrab',
        '-framerate', String(quality.fps),
        '-draw_mouse', '0',
        '-i', `title=${config.windowTitle}`
      );
    }

    if (hasCamera) {
      // Input 1: Camera — DirectShow video device
      args.push('-thread_queue_size', '512',
        '-f', 'dshow', '-framerate', String(quality.fps),
        '-i', `video=${config.videoDeviceName}`);
      // Input 2: Audio — DirectShow audio device
      args.push('-thread_queue_size', '512',
        '-f', 'dshow', '-i', `audio=${config.audioDeviceName}`);
      // Camera as full-screen background, slides overlaid on top with alpha blending.
      // setpts=N/FPS/TB on both inputs: resets PTS to clean sequential values
      // (frame 0, 1, 2, ...) so the overlay filter aligns by frame number.
      // Without this, wall-clock timestamps on the pipe input encode the render
      // pipeline delay into each overlay frame's PTS, causing the overlay to
      // systematically lag behind the camera in the composited output.
      const setptsExpr = `setpts=N/${quality.fps}/TB`;
      args.push('-filter_complex',
        `[0:v]${setptsExpr}[slides];[1:v]scale=${streamW}:${streamH}:force_original_aspect_ratio=increase,crop=${streamW}:${streamH},${setptsExpr}[cam];[cam][slides]overlay=0:0:format=auto[out]`);
      args.push('-map', '[out]', '-map', '2:a');
    } else {
      // Input 1: Audio — DirectShow audio device
      args.push('-thread_queue_size', '512',
        '-f', 'dshow', '-i', `audio=${config.audioDeviceName}`);
      if (!usePipeCapture) {
        args.push('-vf', `scale=${streamW}:${streamH}`);
      }
      args.push('-map', '0:v', '-map', '1:a');
    }

    // Video encoding with constant frame rate output.
    // -fps_mode cfr: duplicate/drop frames to maintain constant frame rate,
    // compensating for irregular wall-clock timestamps from the pipe input.
    args.push('-c:v', encoder, '-fps_mode', 'cfr');
    switch (encoder) {
      case 'h264_nvenc':
        args.push('-preset', 'p1', '-tune', 'll',
          '-rc', 'cbr', '-b:v', quality.videoBitrate,
          '-maxrate', quality.videoBitrate, '-bufsize', quality.bufsize);
        break;
      case 'h264_qsv':
        args.push('-preset', 'veryfast', '-low_power', '1',
          '-b:v', quality.videoBitrate,
          '-maxrate', quality.videoBitrate, '-bufsize', quality.bufsize);
        break;
      case 'h264_amf':
        args.push('-quality', '0', '-rc', 'cbr',
          '-b:v', quality.videoBitrate,
          '-maxrate', quality.videoBitrate, '-bufsize', quality.bufsize);
        break;
      default: // libx264
        args.push('-preset', 'ultrafast', '-tune', 'zerolatency',
          '-b:v', quality.videoBitrate,
          '-maxrate', quality.videoBitrate, '-bufsize', quality.bufsize,
          '-threads', '0');
        break;
    }
    args.push(
      '-pix_fmt', 'yuv420p',
      '-g', String(quality.keyint),
      '-keyint_min', String(quality.keyint),
      // Audio encoding
      '-c:a', 'aac',
      '-b:a', quality.audioBitrate,
      '-ar', '44100',
      '-af', 'aresample=async=1',
      // Output
      '-f', 'flv',
      '-flvflags', 'no_duration_filesize',
      rtmpTarget
    );

    log.info('Starting stream:', ffmpegPath, args.join(' '));

    try {
      const proc = spawn(ffmpegPath, args, {
        stdio: ['pipe', 'ignore', 'pipe'],
        windowsHide: true
      });

      this.process = proc;
      this.stderrBuffer = '';
      this.stderrLineBuffer = '';
      this.lastEmittedJson = '';

      // Prevent async write errors from becoming uncaught exceptions.
      // When FFmpeg exits unexpectedly, pending stdin writes complete with EOF —
      // without this handler, Node throws an uncaught exception that crashes the app.
      proc.stdin?.on('error', (err) => {
        log.debug('FFmpeg stdin error (expected during shutdown):', err.message);
      });

      this.status = {
        isStreaming: true,
        stopping: false,
        startedAt: Date.now(),
        fps: 0,
        bitrate: '',
        droppedFrames: 0,
        dupFrames: 0,
        duration: '00:00:00',
        error: null
      };
      this.emitStatus();

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();

        // Append to diagnostic buffer (for error reporting on exit)
        this.stderrBuffer += text;
        if (this.stderrBuffer.length > StreamingService.MAX_STDERR_LENGTH) {
          this.stderrBuffer = this.stderrBuffer.slice(-StreamingService.MAX_STDERR_LENGTH);
        }

        // Buffer into complete lines before parsing (FFmpeg uses \r for progress)
        this.stderrLineBuffer += text;
        const lines = this.stderrLineBuffer.split(/\r|\n/);
        this.stderrLineBuffer = lines.pop() || '';

        for (const line of lines) {
          if (!line) continue;
          this.parseStderrLine(line);
        }
      });

      // Emit status every 2 seconds while streaming
      this.statusInterval = setInterval(() => {
        if (this.status.isStreaming) {
          this.emitStatus();
        }
      }, 2000);

      proc.on('close', (code) => {
        log.info('FFmpeg process exited with code:', code);
        // Only report error if this was NOT a user-initiated stop
        // (stopping = true means user clicked Stop, so exit code != 0 is expected)
        if (code !== 0 && !this.stopping && !this.status.error) {
          const lastLines = this.stderrBuffer.split('\n').filter(l => l.trim()).slice(-5).join(' ');
          this.status.error = `FFmpeg exited with code ${code}: ${lastLines.substring(0, 200)}`;
        }
        this.cleanup();
        this.status.isStreaming = false;
        this.status.stopping = false;
        this.stopping = false;
        this.emitStatus();
      });

      proc.on('error', (err) => {
        log.error('FFmpeg process error:', err);
        this.cleanup();
        this.status.isStreaming = false;
        this.status.error = `Failed to start FFmpeg: ${err.message}`;
        this.stopping = false;
        this.emitStatus();
      });

      // Start piping frames from offscreen renderer (pipe capture mode only)
      if (usePipeCapture && config.captureWindow) {
        this.startFrameCapture(config.captureWindow, quality.fps, streamW, streamH, useJpegPipe);
      }

      return { success: true };
    } catch (err: any) {
      this.cleanup();
      return { success: false, error: `Failed to start stream: ${err.message}` };
    }
  }

  async stop(): Promise<void> {
    if (!this.process || this.stopping) return;

    this.stopping = true;
    this.status.stopping = true;
    this.status.error = null;
    this.emitStatus();
    log.info('Stopping stream...');
    const proc = this.process;

    // Stop frame capture
    this.stopFrameCapture();

    if (this.usingPipeCapture) {
      // Close stdin to signal EOF — FFmpeg will finish encoding and exit cleanly
      try { proc.stdin?.end(); } catch {}
    } else {
      // gdigrab mode: send 'q' for graceful shutdown
      try { proc.stdin?.write('q'); } catch {}
    }

    // Force kill after 5 seconds if still running
    const killTimeout = setTimeout(() => {
      try {
        if (!proc.killed) {
          log.warn('Force killing FFmpeg process');
          // Use taskkill on Windows to kill entire process tree
          if (process.platform === 'win32' && proc.pid) {
            spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true }).on('error', () => {
              try { proc.kill(); } catch {}
            });
          } else {
            proc.kill('SIGKILL');
          }
        }
      } catch {
        // Already dead
      }
    }, 5000);

    proc.once('close', () => {
      clearTimeout(killTimeout);
      clearTimeout(safetyTimeout);
    });

    // Safety timeout: if close event never fires (zombie process), force-reset state
    const safetyTimeout = setTimeout(() => {
      if (this.stopping) {
        log.warn('FFmpeg close event never fired, force-resetting state');
        this.cleanup();
        this.status.isStreaming = false;
        this.status.stopping = false;
        this.stopping = false;
        this.emitStatus();
      }
    }, 12000);

    // Clear any prior error — the close handler will set isStreaming=false and emit
    this.status.error = null;
  }

  /** Immediately kill FFmpeg. Called on app quit to prevent orphan processes. */
  forceStop(): void {
    this.stopFrameCapture();
    const proc = this.process;
    if (proc && !proc.killed) {
      try {
        if (process.platform === 'win32' && proc.pid) {
          spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true }).on('error', () => {});
        } else {
          proc.kill('SIGKILL');
        }
      } catch {}
    }
    this.process = null;
  }

  getStatus(): StreamStatus {
    return { ...this.status };
  }

  onStatusChange(callback: StatusCallback): () => void {
    this.statusCallbacks.push(callback);
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
    };
  }

  async listAudioDevices(): Promise<string[]> {
    const ffmpegPath = getFfmpegPath();
    if (!ffmpegPath) return [];

    return new Promise((resolve) => {
      const proc = spawn(ffmpegPath, [
        '-list_devices', 'true',
        '-f', 'dshow',
        '-i', 'dummy'
      ], {
        stdio: ['ignore', 'ignore', 'pipe'],
        windowsHide: true
      });

      let stderr = '';
      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        try { proc.kill(); } catch {}
        resolve(parseAudioDevices(stderr));
      }, 5000);

      proc.on('close', () => {
        clearTimeout(timeout);
        resolve(parseAudioDevices(stderr));
      });

      proc.on('error', () => {
        clearTimeout(timeout);
        resolve([]);
      });
    });
  }

  async listVideoDevices(): Promise<string[]> {
    const ffmpegPath = getFfmpegPath();
    if (!ffmpegPath) return [];

    return new Promise((resolve) => {
      const proc = spawn(ffmpegPath, [
        '-list_devices', 'true',
        '-f', 'dshow',
        '-i', 'dummy'
      ], {
        stdio: ['ignore', 'ignore', 'pipe'],
        windowsHide: true
      });

      let stderr = '';
      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        try { proc.kill(); } catch {}
        resolve(parseVideoDevices(stderr));
      }, 5000);

      proc.on('close', () => {
        clearTimeout(timeout);
        resolve(parseVideoDevices(stderr));
      });

      proc.on('error', () => {
        clearTimeout(timeout);
        resolve([]);
      });
    });
  }

  /**
   * Use Electron's offscreen rendering paint event to capture frames.
   *
   * Architecture:
   * - paint event fires when content changes → converts to bitmap once, caches it
   * - setInterval re-sends the cached bitmap to FFmpeg at constant frame rate
   * - For static slides: toBitmap() runs once per slide change (not 30x/sec)
   * - invalidate() fires at 10fps to ensure prompt repainting
   *
   * This eliminates the main cause of FPS degradation: continuous GPU repaints
   * and multi-MB Buffer allocations for content that hasn't changed.
   */
  private startFrameCapture(win: BrowserWindow, fps: number, width: number, height: number, jpegMode: boolean): void {
    this.captureWindow = win;
    const frameInterval = 1000 / fps;

    // Set the offscreen renderer's target frame rate
    win.webContents.setFrameRate(fps);

    // Cache the converted frame so we only process on actual content changes.
    // For static slides: 1 conversion per slide transition, not 30/sec.
    // JPEG mode: ~100-200KB per frame (vs ~4-8MB raw BGRA). 20-30x less pipe data.
    let cachedFrame: Buffer | null = null;

    // Pipe backpressure limit — prevents unbounded memory growth if encoder falls behind.
    const maxPipeBuffer = jpegMode
      ? 1024 * 1024 * 8   // 8MB — ~40 JPEG frames buffer before dropping
      : width * height * 4 * 6; // 6 raw frames buffer

    this.paintHandler = (_event: any, _dirty: any, image: any) => {
      const imgSize = image.getSize();
      const finalImage = (imgSize.width !== width || imgSize.height !== height)
        ? image.resize({ width, height })
        : image;
      cachedFrame = jpegMode ? finalImage.toJPEG(85) : finalImage.toBitmap();
    };
    win.webContents.on('paint', this.paintHandler);

    // Deliver cached frame to FFmpeg stdin at a constant rate.
    // JPEG mode: ~200KB * 30fps = ~6MB/s pipe throughput (trivial).
    // Raw mode: ~4MB * 30fps = ~120MB/s (used only when camera needs alpha).
    this.frameDeliveryInterval = setInterval(() => {
      const stdin = this.process?.stdin;
      if (!cachedFrame || !stdin || stdin.destroyed) return;
      if (stdin.writableLength > maxPipeBuffer) return;
      try {
        stdin.write(cachedFrame);
      } catch {
        // FFmpeg process died — ignore
      }
    }, frameInterval);

    // Invalidate the offscreen renderer frequently so content changes
    // (slide transitions) are captured promptly. Offscreen windows have
    // no monitor/vsync, so they rely on invalidate() to trigger repaints.
    // 100ms (10fps) balances responsiveness vs GC pressure from toBitmap()
    // allocations (~8MB each for raw BGRA). The delivery interval above
    // still sends at the full target FPS using the cached frame.
    this.invalidateInterval = setInterval(() => {
      if (win && !win.isDestroyed()) {
        win.webContents.invalidate();
      }
    }, 100);
  }

  private parseStderrLine(line: string): void {
    // Parse progress: frame, fps, time, bitrate (groups: 1=frame, 2=fps, 3=time, 4=bitrate)
    const match = line.match(PROGRESS_REGEX);
    if (match) {
      this.status.fps = parseFloat(match[2]);
      this.status.duration = match[3].substring(0, 8); // HH:MM:SS
      this.status.bitrate = match[4];
    }

    // Check for dropped/duplicated frames (dup= from CFR mode, drop= from backpressure)
    const dropMatch = line.match(/drop=\s*(\d+)/);
    if (dropMatch) {
      this.status.droppedFrames = parseInt(dropMatch[1], 10);
    }
    const dupMatch = line.match(/dup=\s*(\d+)/);
    if (dupMatch) {
      this.status.dupFrames = parseInt(dupMatch[1], 10);
    }

    // Check for errors using pre-compiled combined regex
    if (ERROR_REGEX.test(line)) {
      const errorPattern = ERROR_PATTERNS.find(p => line.includes(p));
      if (errorPattern) {
        this.status.error = `Stream error: ${errorPattern}`;
        log.error('Stream error detected:', errorPattern);
      }
    }
  }

  private stopFrameCapture(): void {
    if (this.frameDeliveryInterval) {
      clearInterval(this.frameDeliveryInterval);
      this.frameDeliveryInterval = null;
    }
    if (this.invalidateInterval) {
      clearInterval(this.invalidateInterval);
      this.invalidateInterval = null;
    }
    if (this.paintHandler && this.captureWindow && !this.captureWindow.isDestroyed()) {
      this.captureWindow.webContents.removeListener('paint', this.paintHandler);
    }
    this.paintHandler = null;
    this.captureWindow = null;
  }

  private cleanup(): void {
    this.stopFrameCapture();
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }
    this.usingPipeCapture = false;
    this.process = null;
    this.stderrBuffer = '';
    this.stderrLineBuffer = '';
    this.lastEmittedJson = '';
  }

  private emitStatus(): void {
    const status = this.getStatus();
    // Skip emission if nothing changed
    const json = JSON.stringify(status);
    if (json === this.lastEmittedJson) return;
    this.lastEmittedJson = json;

    for (const cb of this.statusCallbacks) {
      try {
        cb(status);
      } catch (err) {
        log.error('Error in status callback:', err);
      }
    }
  }
}

/**
 * Parse DirectShow audio device names from FFmpeg stderr output.
 * FFmpeg lists devices like:
 *   [dshow @ ...] "Microphone (Realtek High Definition Audio)"
 *   [dshow @ ...]     Alternative name "@device_cm_..."
 * Audio devices appear after "DirectShow audio devices" line.
 */
function parseAudioDevices(stderr: string): string[] {
  const devices = new Set<string>();
  const lines = stderr.split('\n');
  let inAudioSection = false;

  for (const line of lines) {
    // Some ffmpeg versions list a "DirectShow audio devices" section header
    if (line.includes('DirectShow audio devices')) {
      inAudioSection = true;
      continue;
    }
    if (inAudioSection) {
      if (line.includes('dummy:')) break;
      if (line.includes('Alternative name')) continue;
      const match = line.match(/"([^"]+)"/);
      if (match) {
        devices.add(match[1]);
      }
    }
    // Other ffmpeg versions tag each device inline with (audio)/(video)/(none)
    if (!inAudioSection && line.includes('(audio)') && !line.includes('Alternative name')) {
      const match = line.match(/"([^"]+)"/);
      if (match) {
        devices.add(match[1]);
      }
    }
  }

  return [...devices];
}

/**
 * Parse DirectShow video device names from FFmpeg stderr output.
 */
function parseVideoDevices(stderr: string): string[] {
  const devices = new Set<string>();
  const lines = stderr.split('\n');
  let inVideoSection = false;

  for (const line of lines) {
    if (line.includes('DirectShow video devices')) {
      inVideoSection = true;
      continue;
    }
    if (inVideoSection) {
      if (line.includes('DirectShow audio devices') || line.includes('dummy:')) {
        inVideoSection = false;
        continue;
      }
      if (line.includes('Alternative name')) continue;
      const match = line.match(/"([^"]+)"/);
      if (match) {
        devices.add(match[1]);
      }
    }
    // Inline-tagged format: each device line has (video)
    if (!inVideoSection && line.includes('(video)') && !line.includes('Alternative name')) {
      const match = line.match(/"([^"]+)"/);
      if (match) {
        devices.add(match[1]);
      }
    }
  }

  return [...devices];
}

// Singleton instance
export const streamingService = new StreamingService();
