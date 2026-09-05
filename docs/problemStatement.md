# Problem Statement: Generic Gmail and Google Docs MCP Server

## 1. Summary

Build a production-ready Model Context Protocol (MCP) server that enables any MCP-compatible AI agent to:

1. Create Gmail drafts.
2. Send emails through Gmail.
3. Append content to an existing Google Doc.

The server must be agent-agnostic, secure, predictable, and easy to configure. It must expose clearly defined MCP tools rather than contain agent-specific prompts, business logic, or UI assumptions.

## 2. Problem Statement

AI agents often need to turn generated output into actions in a user's workspace. Two common actions are composing or sending an email and adding information to a shared document. Direct integrations are frequently built for one agent or application, creating duplicated code, inconsistent authentication, and unsafe handling of credentials and side effects.

We need a reusable MCP server that provides a standard interface between MCP-compatible agents and Google APIs. It should allow an agent to draft or send Gmail messages and append text to Google Docs while enforcing input validation, least-privilege authorization, explicit action boundaries, useful error responses, and protection of sensitive data.

## 3. Goals

- Provide reusable Gmail and Google Docs capabilities to any MCP-compatible client.
- Support both email drafting and direct email sending.
- Append content to an existing Google Doc without replacing existing content.
- Use Google OAuth 2.0 and least-privilege scopes.
- Return structured, deterministic results that agents can reliably interpret.
- Make local setup, credential configuration, testing, and operation straightforward.
- Prevent accidental duplicate sends or appends where practical.

## 4. Non-goals for Version 1

- Reading, searching, deleting, or organizing Gmail messages.
- Reading or replacing Google Doc content.
- Creating or deleting Google Docs.
- Uploading arbitrary Gmail attachments.
- Rich HTML email authoring beyond accepting a validated optional HTML body.
- Advanced Google Docs formatting, tables, images, comments, or suggestions.
- A standalone web UI or email composer.
- Agent orchestration, prompt management, or approval UI.
- Multi-tenant credential administration as a hosted SaaS product.

## 5. Target Users

- Developers building AI agents that support MCP.
- Internal automation teams that need a shared Google Workspace integration.
- Individuals running an MCP server locally for their own Google account.
- Platform teams embedding the server into a controlled agent environment.

## 6. Primary Use Cases

### UC-1: Create an email draft

An AI agent prepares an email and saves it in Gmail for a human to review and send later.

### UC-2: Send an email

An AI agent sends an email after the calling application has obtained any approval required by its own policy.

### UC-3: Append notes to a Google Doc

An AI agent appends meeting notes, research output, a status update, or other plain-text content to an existing Google Doc.

## 7. User Stories

- As an agent developer, I want stable tool schemas so that I can use the server without writing custom Google API integrations.
- As a user, I want emails saved as drafts so that I can review sensitive messages before they are sent.
- As a user, I want an explicitly named send action so that drafting cannot accidentally trigger delivery.
- As a user, I want content appended to a document so that existing content is preserved.
- As an operator, I want credentials stored outside source code and logs so that secrets are not exposed.
- As an agent, I want structured success and failure responses so that I can explain outcomes and recover from errors.

## 8. Functional Requirements

### 8.1 MCP compatibility

- Implement the server using an official or well-maintained MCP SDK.
- Expose capabilities as MCP tools with JSON-schema-compatible input definitions.
- Support `stdio` transport for local MCP clients.
- Keep transport concerns separate from Google service logic so a remote transport can be added later without changing tool behavior.
- Do not depend on Cursor, Antigravity, or any other specific AI agent.
- Include tool descriptions detailed enough for an agent to know when to use each tool and which actions have external side effects.

### 8.2 Tool: `gmail_create_draft`

Creates a Gmail draft but does not send it.

Required input:

```json
{
  "to": ["recipient@example.com"],
  "subject": "Project update",
  "body_text": "Hello, here is the latest update."
}
```

Optional input:

```json
{
  "cc": ["cc@example.com"],
  "bcc": ["bcc@example.com"],
  "reply_to": "reply@example.com",
  "body_html": "<p>Hello, here is the latest update.</p>"
}
```

Requirements:

- Validate all email addresses and reject malformed input.
- Require at least one `to` recipient.
- Require a non-empty subject and at least one non-empty body representation.
- Create a standards-compliant MIME message.
- If both text and HTML are provided, create a multipart alternative message.
- Return a structured result containing at least `status`, `draft_id`, and `thread_id` when available.
- Never send a message from this tool.

Example success result:

```json
{
  "status": "draft_created",
  "draft_id": "draft-id",
  "message_id": "message-id",
  "thread_id": "thread-id"
}
```

### 8.3 Tool: `gmail_send_email`

Creates and sends a Gmail message.

Inputs are the same as `gmail_create_draft`, with this additional optional field:

```json
{
  "idempotency_key": "caller-generated-unique-value"
}
```

Requirements:

- Clearly describe this tool as an external side-effecting action.
- Apply the same validation and MIME requirements as draft creation.
- Send only after the tool is explicitly invoked; creating a draft must never invoke it indirectly.
- When an `idempotency_key` is supplied, prevent the same operation from being sent twice within a configurable retention period.
- If robust idempotency storage is not configured, document the limitation and never claim duplicate prevention.
- Return a structured result containing at least `status`, `message_id`, and `thread_id` when available.
- Do not return a success response unless Gmail confirms message creation/send.

Example success result:

```json
{
  "status": "sent",
  "message_id": "message-id",
  "thread_id": "thread-id"
}
```

### 8.4 Tool: `google_docs_append_text`

Appends plain text to an existing Google Doc.

Required input:

```json
{
  "document_id": "google-document-id",
  "text": "New notes to append."
}
```

Optional input:

```json
{
  "prepend_newline": true,
  "append_newline": true,
  "idempotency_key": "caller-generated-unique-value"
}
```

Requirements:

- Accept a Google document ID, not an unrestricted URL. If URL support is added, safely extract and validate the ID.
- Reject empty content and enforce a configurable maximum content size.
- Append at the end of the document body while preserving all existing content.
- Make newline behavior explicit and deterministic.
- Return the document ID and enough update metadata to confirm the operation.
- When an `idempotency_key` is supplied, prevent the same append operation from being applied twice within a configurable retention period.
- If the document is inaccessible, missing, or not editable, return a specific structured error.

Example success result:

```json
{
  "status": "appended",
  "document_id": "google-document-id",
  "characters_appended": 20
}
```

## 9. Common Tool Behavior

- Reject unknown or incorrectly typed fields unless there is a documented compatibility reason not to.
- Normalize results into machine-readable JSON rather than relying only on prose.
- Never include OAuth tokens, client secrets, raw authorization headers, or full MIME payloads in responses or logs.
- Use stable error codes such as:
  - `INVALID_INPUT`
  - `AUTHENTICATION_REQUIRED`
  - `PERMISSION_DENIED`
  - `RESOURCE_NOT_FOUND`
  - `RATE_LIMITED`
  - `CONFLICT_OR_DUPLICATE`
  - `GOOGLE_API_ERROR`
  - `INTERNAL_ERROR`
- Mark errors as retryable or non-retryable when the distinction is known.
- Preserve Google's relevant request/correlation identifier when safe and available.
- Apply bounded retries with exponential backoff only to transient failures. Never automatically retry an email send when the first outcome is ambiguous unless idempotency makes that safe.

Example error result:

```json
{
  "status": "error",
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "The authenticated account cannot edit this document.",
    "retryable": false
  }
}
```

## 10. Authentication and Authorization

- Use Google OAuth 2.0; do not use a user's Google password.
- Support an interactive local authorization flow for development.
- Store refresh tokens outside source control using a configurable secure location.
- Request only the scopes required for enabled tools.
- Separate Gmail and Google Docs scopes where possible so operators can disable either integration.
- Validate required scopes at startup or before tool execution and return actionable errors.
- Provide a documented reauthorization procedure for expired, revoked, or expanded permissions.
- Ensure `.gitignore` excludes OAuth client credentials, tokens, local databases, and environment files containing secrets.
- Treat service-account support and domain-wide delegation as optional future deployment modes, not the default.

## 11. Safety and Privacy Requirements

- Sending email must be exposed as a separate, unambiguously named tool from creating a draft.
- The server must not silently upgrade a draft request into a send request.
- The calling agent or host is responsible for collecting user approval; the MCP server must make side effects clear enough for hosts to enforce approval policies.
- Sanitize log output and use metadata-only logging by default (for example, operation name, timestamp, outcome, and latency).
- Do not log email bodies, recipient lists, document content, or tokens by default.
- Add configurable limits for recipient count, email body size, and append size.
- Prevent header injection through subject, recipient, and reply-to fields.
- Do not expose arbitrary Google API requests or accept arbitrary HTTP endpoints.
- Avoid displaying raw upstream errors when they may contain sensitive data.

## 12. Configuration

Use environment variables or a validated configuration file. At minimum, document configuration for:

- Google OAuth client ID and client secret source.
- OAuth redirect/local callback settings, if applicable.
- Token storage path or secure token-store adapter.
- Enabled services and tools.
- MCP transport settings.
- Log level.
- Maximum recipients and content sizes.
- Retry policy.
- Idempotency storage and retention period.

Include a safe `.env.example` containing placeholders only.

## 13. Suggested Architecture

Keep the code modular so that MCP, authentication, and Google API behavior can be tested independently:

```text
MCP transport
  -> tool registration and schemas
     -> input validation and policy limits
        -> Gmail service / Google Docs service
           -> OAuth credential provider
              -> Google APIs

Shared components:
- structured result/error mapper
- sanitized logger
- retry policy
- optional idempotency store
- configuration loader
```

Recommended boundaries:

- `server`: MCP startup, transport, and tool registration.
- `tools`: agent-facing tool definitions and result shaping.
- `services`: Gmail and Google Docs API operations.
- `auth`: OAuth flow, token refresh, and credential storage abstraction.
- `validation`: schemas and security constraints.
- `infrastructure`: logging, retries, configuration, and idempotency.

## 14. Non-functional Requirements

- **Portability:** Run on common developer environments with documented prerequisites.
- **Reliability:** Distinguish confirmed success, confirmed failure, and ambiguous upstream outcomes.
- **Security:** No hard-coded secrets; least-privilege access; sanitized logs.
- **Maintainability:** Clear module boundaries and typed or schema-validated interfaces.
- **Testability:** Google API clients must be injectable or mockable.
- **Observability:** Structured logs and operation latency without sensitive message or document content.
- **Performance:** Normal tool calls should add minimal overhead beyond Google API latency.
- **Compatibility:** Tool names and schemas should remain stable within a major version.

## 15. Deliverables

The implementation is complete when it includes:

- MCP server source code.
- The three tools defined in this document.
- OAuth setup and token refresh handling.
- Configuration validation.
- Sanitized structured logging.
- Unit tests for validation, MIME creation, result mapping, and append-position logic.
- Integration tests using mocked Google APIs, plus optional live smoke-test instructions.
- A `README.md` with Google Cloud project setup, API enablement, OAuth consent/client configuration, local authorization, MCP client configuration, and example tool calls.
- A placeholder-only `.env.example`.
- A secure `.gitignore`.
- A sample generic MCP client configuration using `stdio`.
- Clear run, test, lint, and build commands.
- A license and versioning approach if the server will be shared outside the organization.

## 16. Acceptance Criteria

### Gmail draft

- Given valid recipients, subject, and body, `gmail_create_draft` creates exactly one Gmail draft and returns its ID.
- The draft is visible in the authenticated user's Gmail account.
- Invoking the draft tool never sends the message.
- Invalid addresses and header-injection attempts are rejected before calling Google.

### Gmail send

- Given valid input and authorization, `gmail_send_email` sends exactly one message and returns the confirmed message ID.
- Draft creation and sending remain separate code paths and tools.
- A known duplicate `idempotency_key` does not produce a second send when idempotency is enabled.
- Ambiguous send failures are reported as ambiguous/non-retry-safe rather than automatically retried.

### Google Docs append

- Given an editable document ID and non-empty text, `google_docs_append_text` adds content at the end of the document body.
- Existing document content remains unchanged.
- Newline options produce deterministic output.
- Missing documents and insufficient edit permissions return distinct errors.
- A known duplicate `idempotency_key` does not produce a second append when idempotency is enabled.

### Cross-cutting

- The server can be launched and discovered by a generic MCP client over `stdio`.
- Tool schemas are available through MCP discovery and match the documented contracts.
- OAuth tokens and message/document contents do not appear in default logs.
- All automated tests pass from a clean checkout using documented commands.
- Setup works without modifying source code or committing secrets.

## 17. Testing Requirements

- Schema tests for required, optional, malformed, oversized, and unexpected input.
- MIME tests for text-only, HTML-only, multipart, CC, BCC, Unicode, and injection attempts.
- Gmail service tests for success, auth failure, permission failure, throttling, transient errors, and ambiguous send outcomes.
- Google Docs tests for correct end-of-body insertion, empty text, newline options, read-only access, missing documents, and large content.
- Idempotency tests for first execution, duplicate execution, expired keys, and storage failure.
- MCP-level tests that invoke every tool through the selected transport and validate structured output.
- A manual smoke-test checklist that uses a dedicated test account and test document.

## 18. Dependencies and Setup Assumptions

Assumptions to validate before implementation:

- A Google Cloud project can be created or reused.
- Gmail API and Google Docs API can be enabled for that project.
- An OAuth consent screen and OAuth client can be configured.
- The target Google account is permitted to authorize the application.
- Initial deployment is local or single-user through `stdio`.
- Version 1 appends plain text only; formatting is deferred.

## 19. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| An agent sends an unintended email | High | Separate draft and send tools; clear side-effect descriptions; rely on host approval policy; support draft-first workflows. |
| Duplicate sends or appends after retries | High | Accept idempotency keys, persist outcomes, and avoid unsafe automatic send retries. |
| OAuth credentials or content leak through logs | High | Secret-safe storage, default metadata-only logs, redaction, and tests for sensitive output. |
| Excessive OAuth permissions | High | Request least-privilege scopes per enabled capability and document them. |
| Google API quota or rate limits | Medium | Return structured rate-limit errors and use bounded backoff for safe transient operations. |
| Append location is incorrect due to document structure | Medium | Test end-of-body index calculation and isolate Docs-specific logic. |
| Tool schema changes break clients | Medium | Version releases and preserve backward compatibility within a major version. |
| Remote deployment introduces multi-user credential risks | High | Keep hosted multi-tenant deployment out of V1 and design credential storage behind an interface. |

## 20. Open Questions

These questions should be resolved before moving beyond a local/single-user MVP:

1. Which implementation language and runtime should be used (for example, TypeScript/Node.js or Python)?
2. Is the initial deployment local-only, or must it support a remote MCP transport?
3. Which Google account types must be supported: personal Gmail, Google Workspace, or both?
4. Must every send require an approval token enforced by the server, or is client-side approval sufficient?
5. Is HTML email required for V1, or should V1 be text-only?
6. What are the maximum allowed recipients, email body size, and append size?
7. Is durable idempotency required for V1, and which storage backend is acceptable?
8. Should the server support multiple Google identities, or exactly one configured identity per process?
9. Are audit records required, and what privacy/retention policy applies?

## 21. Recommended MVP Decisions

Unless the project owner specifies otherwise, implement Version 1 with these defaults:

- Single configured Google identity per server process.
- Local `stdio` MCP transport.
- Plain-text Google Docs append.
- Plain-text email plus optional sanitized HTML alternative.
- Draft-first usage recommended, with send available as a separate tool.
- File-backed encrypted token storage where the runtime/platform supports it; otherwise a clearly documented restricted local token file.
- Local persistent idempotency store for send and append operations.
- No attachments, remote hosting, or multi-tenant support.

## 22. Definition of Done

The project is done when a developer can clone the repository, follow the README, authorize a Google test account, connect any standards-compliant MCP client over `stdio`, discover the three tools, create a Gmail draft, send a test email, and append text to a test Google Doc—with predictable structured results, no committed credentials, no sensitive default logs, and all acceptance tests passing.
