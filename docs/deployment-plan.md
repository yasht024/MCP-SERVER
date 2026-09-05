# Railway Deployment Plan for MCP Server

Deploying your MCP Server to Railway requires a few architectural adjustments since Railway is a cloud environment. The plan below outlines exactly what needs to be changed and configured to successfully host your server.

## 1. Transport Layer Adaptation (Crucial)
Currently, your server uses `StdioServerTransport` (Standard I/O). On Railway, applications run in containers, making local `stdio` communication unfeasible for a remote client. 

**Action Required:**
You must switch to HTTP Server-Sent Events (SSE) so remote clients can communicate with your server over the internet.
- Install `express` and expose your MCP server using `SSEServerTransport`.
- Bind the Express server to the `PORT` environment variable (Railway injects this automatically).

## 2. Token Storage Handling
Your server previously stored Google OAuth tokens in a local file (`tokens.json`). Railway containers have ephemeral filesystems, meaning any files written locally are deleted upon deployment. To make this extremely easy on Railway, we've updated the code so the server can read your tokens directly from a **Railway Environment Variable**.

**Action Required:**
- You do NOT need to set up a Railway Volume.
- Simply copy the entire JSON contents of your local `tokens.json` file.
- Paste it as the value for the `GOOGLE_TOKENS` environment variable in Railway.

## 3. Environment Variables Configuration
In the Railway Dashboard, navigate to your service's **Variables** tab and configure the following:

| Variable | Description / Value |
| :--- | :--- |
| `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth Client Secret |
| `GOOGLE_REDIRECT_URI` | Your new public Railway domain (e.g., `https://your-app.up.railway.app/oauth2callback`) |
| `GOOGLE_TOKENS` | Paste the exact JSON contents of your `tokens.json` here |
| `LOG_LEVEL` | `info` |

> [!WARNING]
> Remember to update your Google Cloud Console OAuth consent screen with your new Railway domain as an Authorized Redirect URI.

## 4. Build and Start Commands
Railway uses Nixpacks, which is smart enough to auto-detect Node.js applications. 
Your `package.json` is already perfectly configured for this:
- **Build**: Railway will automatically detect and run `npm run build` (`tsc`).
- **Start**: Railway will automatically detect and run `npm start` (`node build/server/index.js`).

## 5. Step-by-Step Deployment Guide
1. Push your code to GitHub.
2. Log into Railway and click **New Project** -> **Deploy from GitHub repo**.
3. Go to **Settings -> Networking** and click **Generate Domain** to get your public HTTPS URL.
4. Go to **Variables** and paste your environment variables (including `GOOGLE_TOKENS`).
5. Trigger a manual redeploy if the variables weren't picked up automatically.
