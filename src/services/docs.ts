import { google, docs_v1 } from 'googleapis';
import { GoogleAuthClient } from '../auth/oauth.js';
import { handleGoogleApiError, McpError, ErrorCode } from '../infrastructure/errors.js';
import { globalIdempotencyStore } from '../infrastructure/idempotency.js';

export interface AppendTextParams {
  document_id: string;
  text: string;
  prepend_newline?: boolean;
  append_newline?: boolean;
  idempotency_key?: string;
}

export class DocsService {
  private authClient: GoogleAuthClient;
  
  constructor(authClient: GoogleAuthClient) {
    this.authClient = authClient;
  }

  private getDocsApi(): docs_v1.Docs {
    google.options({ auth: this.authClient.getClient() as any });
    return google.docs({ version: 'v1' });
  }

  public async appendText(params: AppendTextParams) {
    await this.authClient.validateAuth();

    if (params.idempotency_key) {
      const existing = globalIdempotencyStore.get(params.idempotency_key);
      if (existing) {
        return existing;
      }
    }

    const docs = this.getDocsApi();
    
    // First, fetch the document to find the end index of the body
    let document;
    try {
      const response = await docs.documents.get({
        documentId: params.document_id,
      });
      document = response.data;
    } catch (error: any) {
      throw handleGoogleApiError(error);
    }

    if (!document.body || !document.body.content) {
      throw new McpError(ErrorCode.INTERNAL_ERROR, 'Document body could not be parsed.');
    }

    // The last structural element is usually the end of the body.
    // The endIndex of the body content is the very end of the document, minus 1 for the terminal newline.
    let endIndex = 1;
    const content = document.body.content;
    if (content.length > 0) {
      const lastElement = content[content.length - 1];
      endIndex = (lastElement.endIndex || 2) - 1; 
    }

    let textToInsert = params.text;
    if (params.prepend_newline) {
      textToInsert = '\n' + textToInsert;
    }
    if (params.append_newline) {
      textToInsert = textToInsert + '\n';
    }

    try {
      await docs.documents.batchUpdate({
        documentId: params.document_id,
        requestBody: {
          requests: [
            {
              insertText: {
                location: {
                  index: endIndex,
                },
                text: textToInsert,
              },
            },
          ],
        },
      });

      const result = {
        status: 'appended',
        document_id: params.document_id,
        characters_appended: textToInsert.length,
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
