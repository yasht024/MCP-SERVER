import { google, gmail_v1 } from 'googleapis';
import { GoogleAuthClient } from '../auth/oauth.js';
import { handleGoogleApiError } from '../infrastructure/errors.js';
import { globalIdempotencyStore } from '../infrastructure/idempotency.js';

export interface CreateDraftParams {
  to: string[];
  cc?: string[];
  bcc?: string[];
  reply_to?: string;
  subject: string;
  body_text?: string;
  body_html?: string;
}

export interface SendEmailParams extends CreateDraftParams {
  idempotency_key?: string;
}

export class GmailService {
  private authClient: GoogleAuthClient;
  
  constructor(authClient: GoogleAuthClient) {
    this.authClient = authClient;
  }

  private getGmailApi(): gmail_v1.Gmail {
    google.options({ auth: this.authClient.getClient() as any });
    return google.gmail({ version: 'v1' });
  }

  private createMimeMessage(params: CreateDraftParams): string {
    const boundary = 'boundary_' + Math.random().toString(36).substring(2);
    
    let message = '';
    message += `To: ${params.to.join(', ')}\r\n`;
    if (params.cc && params.cc.length > 0) message += `Cc: ${params.cc.join(', ')}\r\n`;
    if (params.bcc && params.bcc.length > 0) message += `Bcc: ${params.bcc.join(', ')}\r\n`;
    if (params.reply_to) message += `Reply-To: ${params.reply_to}\r\n`;
    
    // Header injection prevention: remove newlines from subject
    const safeSubject = params.subject.replace(/[\r\n]/g, '');
    message += `Subject: ${safeSubject}\r\n`;
    
    message += 'MIME-Version: 1.0\r\n';

    if (params.body_html && params.body_text) {
      message += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;
      
      message += `--${boundary}\r\n`;
      message += 'Content-Type: text/plain; charset="UTF-8"\r\n\r\n';
      message += `${params.body_text}\r\n\r\n`;
      
      message += `--${boundary}\r\n`;
      message += 'Content-Type: text/html; charset="UTF-8"\r\n\r\n';
      message += `${params.body_html}\r\n\r\n`;
      
      message += `--${boundary}--\r\n`;
    } else if (params.body_html) {
      message += 'Content-Type: text/html; charset="UTF-8"\r\n\r\n';
      message += `${params.body_html}\r\n`;
    } else if (params.body_text) {
      message += 'Content-Type: text/plain; charset="UTF-8"\r\n\r\n';
      message += `${params.body_text}\r\n`;
    }

    return Buffer.from(message).toString('base64url');
  }

  public async createDraft(params: CreateDraftParams) {
    await this.authClient.validateAuth();
    const gmail = this.getGmailApi();
    const raw = this.createMimeMessage(params);

    try {
      const response = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw
          }
        }
      });

      return {
        status: 'draft_created',
        draft_id: response.data.id,
        message_id: response.data.message?.id,
        thread_id: response.data.message?.threadId,
      };
    } catch (error: any) {
      throw handleGoogleApiError(error);
    }
  }

  public async sendEmail(params: SendEmailParams) {
    await this.authClient.validateAuth();
    
    if (params.idempotency_key) {
      const existing = globalIdempotencyStore.get(params.idempotency_key);
      if (existing) {
        return existing;
      }
    }

    const gmail = this.getGmailApi();
    const raw = this.createMimeMessage(params);

    try {
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw
        }
      });

      const result = {
        status: 'sent',
        message_id: response.data.id,
        thread_id: response.data.threadId,
      };

      if (params.idempotency_key) {
        globalIdempotencyStore.set(params.idempotency_key, result);
      }

      return result;
    } catch (error: any) {
      throw handleGoogleApiError(error);
    }
  }
}
