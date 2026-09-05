import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { 
  gmailCreateDraftSchema, 
  gmailSendEmailSchema, 
  googleDocsAppendTextSchema,
  MAX_RECIPIENTS,
  MAX_APPEND_SIZE
} from './schemas.js';
import { GmailService } from '../services/gmail.js';
import { DocsService } from '../services/docs.js';
import { McpError, ErrorCode } from '../infrastructure/errors.js';
import { Logger } from '../infrastructure/logger.js';

export function registerTools(
  server: Server,
  gmailService: GmailService,
  docsService: DocsService
) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'gmail_create_draft',
          description: 'Creates a Gmail draft but does not send it. Use this to prepare an email for human review.',
          inputSchema: {
            type: 'object',
            properties: {
              to: { type: 'array', items: { type: 'string' }, description: 'List of recipient email addresses' },
              cc: { type: 'array', items: { type: 'string' }, description: 'List of CC email addresses' },
              bcc: { type: 'array', items: { type: 'string' }, description: 'List of BCC email addresses' },
              reply_to: { type: 'string', description: 'Reply-To email address' },
              subject: { type: 'string', description: 'Subject of the email' },
              body_text: { type: 'string', description: 'Plain text body of the email' },
              body_html: { type: 'string', description: 'HTML body of the email' },
            },
            required: ['to', 'subject'],
          },
        },
        {
          name: 'gmail_send_email',
          description: 'Creates and immediately sends a Gmail message. This is an external side-effecting action.',
          inputSchema: {
            type: 'object',
            properties: {
              to: { type: 'array', items: { type: 'string' }, description: 'List of recipient email addresses' },
              cc: { type: 'array', items: { type: 'string' }, description: 'List of CC email addresses' },
              bcc: { type: 'array', items: { type: 'string' }, description: 'List of BCC email addresses' },
              reply_to: { type: 'string', description: 'Reply-To email address' },
              subject: { type: 'string', description: 'Subject of the email' },
              body_text: { type: 'string', description: 'Plain text body of the email' },
              body_html: { type: 'string', description: 'HTML body of the email' },
              idempotency_key: { type: 'string', description: 'Optional unique key to prevent duplicate sends' },
            },
            required: ['to', 'subject'],
          },
        },
        {
          name: 'google_docs_append_text',
          description: 'Appends plain text to the end of an existing Google Doc.',
          inputSchema: {
            type: 'object',
            properties: {
              document_id: { type: 'string', description: 'The ID of the Google Document (found in its URL)' },
              text: { type: 'string', description: 'The plain text to append' },
              prepend_newline: { type: 'boolean', description: 'Whether to add a newline before the text' },
              append_newline: { type: 'boolean', description: 'Whether to add a newline after the text' },
              idempotency_key: { type: 'string', description: 'Optional unique key to prevent duplicate appends' },
            },
            required: ['document_id', 'text'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      if (request.params.name === 'gmail_create_draft') {
        const params = gmailCreateDraftSchema.parse(request.params.arguments);
        if (params.to.length + (params.cc?.length || 0) + (params.bcc?.length || 0) > MAX_RECIPIENTS) {
          throw new McpError(ErrorCode.INVALID_INPUT, `Too many recipients. Maximum is ${MAX_RECIPIENTS}.`);
        }
        const result = await gmailService.createDraft(params);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } 
      
      else if (request.params.name === 'gmail_send_email') {
        const params = gmailSendEmailSchema.parse(request.params.arguments);
        if (params.to.length + (params.cc?.length || 0) + (params.bcc?.length || 0) > MAX_RECIPIENTS) {
          throw new McpError(ErrorCode.INVALID_INPUT, `Too many recipients. Maximum is ${MAX_RECIPIENTS}.`);
        }
        const result = await gmailService.sendEmail(params);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } 
      
      else if (request.params.name === 'google_docs_append_text') {
        const params = googleDocsAppendTextSchema.parse(request.params.arguments);
        if (params.text.length > MAX_APPEND_SIZE) {
          throw new McpError(ErrorCode.INVALID_INPUT, `Text is too long to append. Maximum is ${MAX_APPEND_SIZE} characters.`);
        }
        const result = await docsService.appendText(params);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } 
      
      else {
        throw new McpError(ErrorCode.INVALID_INPUT, `Unknown tool: ${request.params.name}`);
      }
    } catch (error: any) {
      Logger.error(`Tool execution failed for ${request.params.name}`, { error });
      
      let errorResponse;
      if (error instanceof McpError) {
        errorResponse = error.toJSON();
      } else if (error.name === 'ZodError') {
        errorResponse = new McpError(ErrorCode.INVALID_INPUT, 'Invalid input parameters.', false, error.issues).toJSON();
      } else {
        errorResponse = new McpError(ErrorCode.INTERNAL_ERROR, 'An unexpected error occurred.').toJSON();
      }

      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify(errorResponse, null, 2) }]
      };
    }
  });
}
