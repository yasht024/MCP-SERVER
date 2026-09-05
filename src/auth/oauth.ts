import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { TokenStorage } from './storage.js';
import { Logger } from '../infrastructure/logger.js';
import { McpError, ErrorCode } from '../infrastructure/errors.js';

// Scopes required for Gmail drafting/sending and Google Docs appending
export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/documents'
];

export class GoogleAuthClient {
  private oauth2Client: OAuth2Client;
  private tokenStorage: TokenStorage;

  constructor() {
    this.tokenStorage = new TokenStorage();

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

    if (!clientId || !clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required.');
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Listen for token updates to save refresh tokens
    this.oauth2Client.on('tokens', (tokens) => {
      this.tokenStorage.saveTokens(tokens);
    });

    const savedTokens = this.tokenStorage.getTokens();
    if (savedTokens) {
      this.oauth2Client.setCredentials(savedTokens);
    }
  }

  public getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Required to receive a refresh token
      prompt: 'consent',      // Force consent to always get a refresh token
      scope: SCOPES,
    });
  }

  public async getTokensFromCode(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    this.tokenStorage.saveTokens(tokens);
    return tokens;
  }

  public getClient(): OAuth2Client {
    return this.oauth2Client;
  }

  public async validateAuth(): Promise<void> {
    const tokens = this.tokenStorage.getTokens();
    if (!tokens || !tokens.access_token) {
      throw new McpError(ErrorCode.AUTHENTICATION_REQUIRED, 'Authentication is missing. Please authorize the application.');
    }
    
    // Test auth by fetching token info (or just assume it refreshes automatically since google-auth-library handles it)
    try {
      await this.oauth2Client.getAccessToken();
    } catch (error) {
      throw new McpError(ErrorCode.AUTHENTICATION_REQUIRED, 'Authentication token is invalid or expired. Please reauthorize.', false, error);
    }
  }
}
