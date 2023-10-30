/**
 * obsidian-tray v0.3.3
 * (c) 2023 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/obsidian-tray/) under the MIT license
 */

export type LogLevel = 'ALL' | 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL' | 'MARK' | 'OFF';

export const LogLevels: Record<LogLevel, LogLevel> = {
  ALL: 'ALL',
  TRACE: 'TRACE',
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  FATAL: 'FATAL',
  MARK: 'MARK',
  OFF: 'OFF'
};

const LOG_PREFIX = 'mycoshiro-tray';

export const logMessage = (message: string, level?: LogLevel) => {
  console.log(`${LOG_PREFIX}: ${message}`);
};

export const logInfo = (message: string) => {
  logMessage(message, 'INFO');
};

export const logError = (message: string) => {
  logMessage(message, 'WARN');
};

export const logWarning = (message: string) => {
  logMessage(message, 'ERROR');
};
