export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const currentLogLevel = process.env.LOG_LEVEL?.toUpperCase() === 'DEBUG' ? LogLevel.DEBUG :
  process.env.LOG_LEVEL?.toUpperCase() === 'WARN' ? LogLevel.WARN :
  process.env.LOG_LEVEL?.toUpperCase() === 'ERROR' ? LogLevel.ERROR :
  LogLevel.INFO;

export class Logger {
  static debug(message: string, meta?: Record<string, any>) {
    if (currentLogLevel <= LogLevel.DEBUG) {
      console.error(JSON.stringify({ level: 'DEBUG', timestamp: new Date().toISOString(), message, ...meta }));
    }
  }

  static info(message: string, meta?: Record<string, any>) {
    if (currentLogLevel <= LogLevel.INFO) {
      console.error(JSON.stringify({ level: 'INFO', timestamp: new Date().toISOString(), message, ...meta }));
    }
  }

  static warn(message: string, meta?: Record<string, any>) {
    if (currentLogLevel <= LogLevel.WARN) {
      console.error(JSON.stringify({ level: 'WARN', timestamp: new Date().toISOString(), message, ...meta }));
    }
  }

  static error(message: string, meta?: Record<string, any>) {
    if (currentLogLevel <= LogLevel.ERROR) {
      console.error(JSON.stringify({ level: 'ERROR', timestamp: new Date().toISOString(), message, ...meta }));
    }
  }
}
