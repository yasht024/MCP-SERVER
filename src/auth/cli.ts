import { randomBytes } from "node:crypto";
import express from 'express';
import dotenv from 'dotenv';
import { GoogleAuthClient } from './oauth.js';
import { Logger } from '../infrastructure/logger.js';

// Load environment variables for the CLI
dotenv.config();

const app = express();
const port = process.env.AUTH_PORT || 3000;
const authClient = new GoogleAuthClient();
const state = randomBytes(32).toString("hex");

app.get('/oauth2callback', async (req, res) => {
  if (req.query.state !== state) {
    res.status(400).send("Invalid authorization state. Restart sign-in.");
    return;
  }
  const code = req.query.code as string;
  if (!code) {
    res.status(400).send('No code provided');
    return;
  }

  try {
    await authClient.getTokensFromCode(code);
    res.send('Authentication successful! You can close this tab and return to the terminal.');
    Logger.info('Successfully authenticated and saved tokens.');
    // Exit after a short delay to allow the response to be sent
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  } catch (error) {
    Logger.error('Failed to get tokens. Google sign-in must be retried.');
    res.status(500).send('Authentication failed. Check the server logs.');
  }
});

app.listen(Number(port), "127.0.0.1", () => {
  console.log(`Starting local auth server on port ${port}...`);
  console.log('Please visit the following URL to authorize the application:');
  console.log('\n' + authClient.getAuthUrl(state, process.env.GOOGLE_LOGIN_HINT) + '\n');
});
