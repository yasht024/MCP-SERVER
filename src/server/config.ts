import dotenv from 'dotenv';
import { Logger } from '../infrastructure/logger.js';

// Load environment variables
dotenv.config();

export interface ServerConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenStoragePath: string;
  idempotencyStoragePath: string;
  logLevel: string;
}

export function getConfig(): ServerConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    Logger.error('Missing required GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables.');
    // Don't throw immediately, allow tools discovery, but they will fail during auth validation
  }

  return {
    clientId: clientId || '',
    clientSecret: clientSecret || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback',
    tokenStoragePath: process.env.TOKEN_STORAGE_PATH || 'tokens.json',
    idempotencyStoragePath: process.env.IDEMPOTENCY_STORAGE_PATH || 'idempotency.json',
    logLevel: process.env.LOG_LEVEL || 'info',
  };
}
