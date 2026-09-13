# MCP access and Google authorization

Every request to `/mcp` requires `Authorization: Bearer <MCP_ACCESS_TOKEN>`.
Set a randomly generated secret of at least 32 characters in Railway and the matching
`REPORT_MCP_TOKEN` in the report app's server environment. Never expose this secret
through frontend variables, URLs, or public configuration. Missing server configuration
fails closed; `/health` remains public and contains no account information.

`google_auth_status` checks Google token availability/refresh without creating an email
or changing a document. Listing tools alone does not establish Google authorization.
Known Google failures are returned as structured errors and omit credential details.

To renew the existing Google connection, use the existing OAuth client credentials and
run `npm run auth` locally. The callback is bound to loopback and validates a random
state. Complete Google consent for the intended account, then securely transfer the
resulting ignored `tokens.json` into Railway's `GOOGLE_TOKENS` secret and redeploy.
Do not commit tokens or include them in deployment uploads. `.railwayignore` excludes
credential files, local dependencies, and diagnostic scripts.

Validation: `npm run build` then `node --test tests/access.test.mjs`.
