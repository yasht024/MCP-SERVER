import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import cors from 'cors';
import { GoogleAuthClient } from '../auth/oauth.js';
import { GmailService } from '../services/gmail.js';
import { DocsService } from '../services/docs.js';
import { registerTools } from '../tools/index.js';
import { Logger } from '../infrastructure/logger.js';
import { getConfig } from './config.js';

function createMcpServer(): Server {
  const authClient = new GoogleAuthClient();
  const gmailService = new GmailService(authClient);
  const docsService = new DocsService(authClient);

  const server = new Server(
    {
      name: 'gmail-docs-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  registerTools(server, gmailService, docsService);
  return server;
}

async function main() {
  Logger.info('Starting Generic Gmail and Google Docs MCP Server...');

  // Ensure config is loaded
  getConfig();

  const app = express();
  // Browser-based MCP clients (e.g. remote connector wizards) need CORS,
  // with these response headers exposed so they can read session/auth
  // negotiation state instead of failing discovery silently.
  app.use(
    cors({
      origin: '*',
      exposedHeaders: ['Mcp-Session-Id', 'WWW-Authenticate', 'Last-Event-Id', 'Mcp-Protocol-Version'],
    })
  );
  app.use(express.json());

  // Stateless Streamable HTTP: a fresh server + transport per request, no
  // session state kept between calls. Simple and sufficient for a
  // single-user personal MCP connector.
  app.post('/mcp', async (req, res) => {
    try {
      const server = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      res.on('close', () => {
        transport.close();
        server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      Logger.error('Error handling MCP request', { error });
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  app.get('/mcp', async (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed.' },
      id: null,
    });
  });

  app.delete('/mcp', async (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed.' },
      id: null,
    });
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    Logger.info(`MCP Server running (Streamable HTTP) at http://localhost:${port}/mcp`);
  });
}

main().catch((error) => {
  Logger.error('Fatal error during startup', { error });
  process.exit(1);
});
