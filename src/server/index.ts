import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import { GoogleAuthClient } from '../auth/oauth.js';
import { GmailService } from '../services/gmail.js';
import { DocsService } from '../services/docs.js';
import { registerTools } from '../tools/index.js';
import { Logger } from '../infrastructure/logger.js';
import { getConfig } from './config.js';

async function main() {
  Logger.info('Starting Generic Gmail and Google Docs MCP Server...');

  // Ensure config is loaded
  getConfig();

  // Initialize Auth
  const authClient = new GoogleAuthClient();

  // Initialize Services
  const gmailService = new GmailService(authClient);
  const docsService = new DocsService(authClient);

  // Initialize MCP Server
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

  // Register Tools
  registerTools(server, gmailService, docsService);

  // Set up Express and SSE transport
  const app = express();
  let transport: SSEServerTransport;

  app.get('/sse', async (req, res) => {
    transport = new SSEServerTransport('/messages', res);
    await server.connect(transport);
    Logger.info('Client connected via SSE');
  });

  app.post('/messages', async (req, res) => {
    if (!transport) {
      res.status(400).send('SSE not initialized');
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    Logger.info(`MCP Server running on SSE at http://localhost:${port}/sse`);
  });
}

main().catch((error) => {
  Logger.error('Fatal error during startup', { error });
  process.exit(1);
});
