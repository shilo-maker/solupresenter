/**
 * Debug logging utility for renderer process
 *
 * Controls console output based on environment.
 * In production, verbose logs are suppressed.
 */

// Check if we're in development mode
// In Vite, import.meta.env.DEV is true in development
const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true;

/**
 * Log levels
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  VERBOSE = 4
}

// Current log level - in production, only show errors and warnings by default
const currentLevel = isDev ? LogLevel.VERBOSE : LogLevel.WARN;

/**
 * Create a prefixed logger for a specific component/module.
 * Logs are filtered by level based on environment:
 * - Development: All logs shown
 * - Production: Only errors and warnings shown
 *
 * @param prefix - Module/component name to prefix log messages
 * @returns Logger object with error, warn, info, debug, and verbose methods
 *
 * @example
 * const log = createLogger('MediaGrid');
 * log.debug('Loading items...');
 * log.error('Failed to load:', error);
 */
export function createLogger(prefix: string) {
  return {
    error: (...args: unknown[]) => {
      if (currentLevel >= LogLevel.ERROR) {
        console.error(`[${prefix}]`, ...args);
      }
    },

    warn: (...args: unknown[]) => {
      if (currentLevel >= LogLevel.WARN) {
        console.warn(`[${prefix}]`, ...args);
      }
    },

    info: (...args: unknown[]) => {
      if (currentLevel >= LogLevel.INFO) {
        console.log(`[${prefix}]`, ...args);
      }
    },

    debug: (...args: unknown[]) => {
      if (currentLevel >= LogLevel.DEBUG) {
        console.log(`[${prefix}]`, ...args);
      }
    },

    verbose: (...args: unknown[]) => {
      if (currentLevel >= LogLevel.VERBOSE) {
        console.log(`[${prefix}]`, ...args);
      }
    }
  };
}

/**
 * Check if debug mode is enabled
 */
export function isDebugMode(): boolean {
  return isDev;
}

export default { createLogger, isDebugMode };
