import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

/** Authenticate every MCP request before constructing a Google client. */
export function requireMcpToken(token = process.env.MCP_ACCESS_TOKEN): RequestHandler {
  return (req, res, next) => {
    if (!token || token.length < 32) {
      res.status(503).json({error: 'MCP access is not configured.'});
      return;
    }
    const expected = Buffer.from(`Bearer ${token}`);
    const received = Buffer.from(req.get('Authorization') || '');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      res.set('WWW-Authenticate', 'Bearer realm="mcp"');
      res.status(401).json({error: 'Authentication required.'});
      return;
    }
    next();
  };
}
