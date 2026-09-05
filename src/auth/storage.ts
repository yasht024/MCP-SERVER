import fs from 'fs';
import path from 'path';
import { Logger } from '../infrastructure/logger.js';
import { Credentials } from 'google-auth-library';

export class TokenStorage {
  private filePath: string;

  constructor(filePath: string = process.env.TOKEN_STORAGE_PATH || 'tokens.json') {
    this.filePath = path.resolve(process.cwd(), filePath);
  }

  public getTokens(): Credentials | null {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(data) as Credentials;
      }
    } catch (error) {
      Logger.error('Failed to read token storage', { error });
    }
    return null;
  }

  public saveTokens(tokens: Credentials): void {
    try {
      // Ensure we merge with existing tokens if partial
      const existing = this.getTokens() || {};
      const newTokens = { ...existing, ...tokens };
      fs.writeFileSync(this.filePath, JSON.stringify(newTokens, null, 2), 'utf-8');
      Logger.info('Tokens saved successfully.');
    } catch (error) {
      Logger.error('Failed to save token storage', { error });
    }
  }

  public clearTokens(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
    } catch (error) {
      Logger.error('Failed to clear token storage', { error });
    }
  }
}
