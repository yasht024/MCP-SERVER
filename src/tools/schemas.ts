import { z } from 'zod';

export const gmailCreateDraftSchema = z.object({
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  reply_to: z.string().email().optional(),
  subject: z.string().min(1),
  body_text: z.string().optional(),
  body_html: z.string().optional(),
}).refine(data => data.body_text || data.body_html, {
  message: "Either body_text or body_html must be provided.",
  path: ["body_text"],
});

export const gmailSendEmailSchema = gmailCreateDraftSchema.extend({
  idempotency_key: z.string().optional(),
});

export const googleDocsAppendTextSchema = z.object({
  document_id: z.string().min(1),
  text: z.string().min(1),
  prepend_newline: z.boolean().optional(),
  append_newline: z.boolean().optional(),
  idempotency_key: z.string().optional(),
});

// Enforcing maximum sizes (e.g., from env variables or defaults)
export const MAX_RECIPIENTS = parseInt(process.env.MAX_RECIPIENTS || '50', 10);
export const MAX_APPEND_SIZE = parseInt(process.env.MAX_APPEND_SIZE || '50000', 10);
