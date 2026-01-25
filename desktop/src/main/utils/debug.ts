/**
 * Debug logging utility
 *
 * Controls console output based on environment.
 * In production, verbose logs are suppressed unless DEBUG env var is set.
 */

const isDev = process.env.NODE_ENV === 'development';
const isDebug = isDev || process.env.DEBUG === 'true';

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
const currentLevel = isDebug ? LogLevel.VERBOSE : LogLevel.WARN;

/**
 * Create a prefixed logger for a specific module
 */
export function createLogger(prefix: string) {
  return {
    error: (...args: any[]) => {
      if (currentLevel >= LogLevel.ERROR) {
        console.error(`[${prefix}]`, ...args);
      }
    },

    warn: (...args: any[]) => {
      if (currentLevel >= LogLevel.WARN) {
        console.warn(`[${prefix}]`, ...args);
      }
    },

    info: (...args: any[]) => {
      if (currentLevel >= LogLevel.INFO) {
        console.log(`[${prefix}]`, ...args);
      }
    },

    debug: (...args: any[]) => {
      if (currentLevel >= LogLevel.DEBUG) {
        console.log(`[${prefix}]`, ...args);
      }
    },

    verbose: (...args: any[]) => {
      if (currentLevel >= LogLevel.VERBOSE) {
        console.log(`[${prefix}]`, ...args);
      }
    }
  };
}

/**
 * Global debug log - only logs in development/debug mode
 */
export function debugLog(prefix: string, ...args: any[]): void {
  if (isDebug) {
    console.log(`[${prefix}]`, ...args);
  }
}

/**
 * Always logs regardless of mode (for critical info)
 */
export function alwaysLog(prefix: string, ...args: any[]): void {
  console.log(`[${prefix}]`, ...args);
}

/**
 * Check if debug mode is enabled
 */
export function isDebugMode(): boolean {
  return isDebug;
}

export default { createLogger, debugLog, alwaysLog, isDebugMode };
