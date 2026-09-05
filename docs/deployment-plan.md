# Railway Deployment Plan for MCP Server

Deploying your MCP Server to Railway requires a few architectural adjustments since Railway is a cloud environment. The plan below outlines exactly what needs to be changed and configured to successfully host your server.

## 1. Transport Layer Adaptation (Crucial)
Currently, your server uses `StdioServerTransport` (Standard I/O). On Railway, applications run in containers, making local `stdio` communication unfeasible for a remote client. 

**Action Required:**
You must switch to HTTP Server-Sent Events (SSE) so remote clients can communicate with your server over the internet.
- Install `express` and expose your MCP server using `SSEServerTransport`.
- Bind the Express server to the `PORT` environment variable (Railway injects this automatically).

## 2. Ephemeral Storage Handling (Volumes)
Your server currently stores Google OAuth tokens and idempotency keys in local files (`tokens.json` and `idempotency.json`). Railway containers have ephemeral filesystems; any files written locally will be deleted upon the next deployment or container restart.

**Action Required:**
- You will need to provision a **Railway Volume** to persist these files.
- Mount the volume to a specific path in your container (e.g., `/app/data`).
- Update your `.env` to point `TOKEN_STORAGE_PATH` and `IDEMPOTENCY_STORAGE_PATH` to the volume path.

## 3. Environment Variables Configuration
In the Railway Dashboard, navigate to your service's **Variables** tab and configure the following:

| Variable | Description / Value |
| :--- | :--- |
| `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth Client Secret |
| `GOOGLE_REDIRECT_URI` | Your new public Railway domain (e.g., `https://your-app.up.railway.app/oauth2callback`) |
| `TOKEN_STORAGE_PATH` | `/app/data/tokens.json` (pointing to your Railway volume) |
| `IDEMPOTENCY_STORAGE_PATH` | `/app/data/idempotency.json` (pointing to your Railway volume) |
| `LOG_LEVEL` | `info` |

> [!WARNING]
> Remember to update your Google Cloud Console OAuth consent screen with your new Railway domain as an Authorized Redirect URI.

## 4. Build and Start Commands
Railway uses Nixpacks, which is smart enough to auto-detect Node.js applications. 
Your `package.json` is already perfectly configured for this:
- **Build**: Railway will automatically detect and run `npm run build` (`tsc`).
- **Start**: Railway will automatically detect and run `npm start` (`node build/server/index.js`).

## 5. Step-by-Step Deployment Guide
1. Push your latest code (including the SSE transport changes) to GitHub.
2. Log into Railway and click **New Project** -> **Deploy from GitHub repo**.
3. Once the service is created, go to **Settings -> Volumes** and create a new volume mounted at `/app/data`.
4. Go to **Settings -> Networking** and click **Generate Domain** to get your public HTTPS URL.
5. Go to **Variables** and paste your environment variables.
6. Trigger a manual redeploy for the variables and volume to take effect.
