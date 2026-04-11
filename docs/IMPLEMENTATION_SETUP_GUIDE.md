# Implementation & Setup Guide - DevOps Agent

Complete guide to set up, configure, and run the DevOps Agent demo showcasing Okta Brokered Consent (OAuth-STS) for GitHub integration.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Okta Configuration](#okta-configuration)
3. [GitHub Configuration](#github-configuration)
4. [Backend Setup](#backend-setup)
5. [Frontend Setup](#frontend-setup)
6. [Running the Application](#running-the-application)
7. [Testing OAuth-STS Flow](#testing-oauth-sts-flow)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements
- ✅ Node.js 18+ (you have v20.20.1)
- ✅ Python 3.10+ (venv configured with Python 3.10)
- ✅ npm 8+ (you have v10.8.2)

### Okta Requirements
- Okta OIE org with `SECURE_AI_AGENTS` and `SECURE_AI_OAUTH_STS` flags enabled
- Admin access to Okta Admin Console
- Ability to create AI Agents and Managed Connections

### GitHub Requirements
- GitHub account or organization
- Ability to create GitHub Apps
- Admin access if using organization

---

## Okta Configuration

### Step 1: Create OIDC Application (For User Login)

1. **Login to Okta Admin Console:**
   ```
   https://your-org.oktapreview.com/admin
   ```

2. **Create OIDC App:**
   - Navigate: `Applications` → `Applications` → `Create App Integration`
   - Type: **OIDC - OpenID Connect**
   - Application type: **Web Application**

3. **Configure Application:**
   - **App name:** DevOps Agent Frontend
   - **Grant types:** Authorization Code, Refresh Token
   - **Sign-in redirect URIs:**
     ```
     http://localhost:3000/api/auth/callback/okta
     https://your-vercel-domain.vercel.app/api/auth/callback/okta
     ```
   - **Sign-out redirect URIs:**
     ```
     http://localhost:3000/login
     http://localhost:3000
     https://your-vercel-domain.vercel.app/login
     ```
   - **Controlled access:** Choose appropriate access level

4. **Save and Copy:**
   - ✅ Client ID (starts with `0oa`)
   - ✅ Client Secret (click to reveal and copy)

### Step 2: Create AI Agent Entity

1. **Navigate to AI Agents:**
   ```
   Directory → AI Agents → Create AI Agent
   ```

2. **Configure AI Agent:**
   - **Name:** DevOps Agent
   - **Description:** GitHub integration via OAuth-STS
   - **Owner:** Select an owner (requires Access Governance SKU)

3. **Generate Key Pair:**
   - Click **"Generate public/private key pair"**
   - Download the **private JWK** (JSON format)
   - Save securely - this is used for client assertions

4. **Link OIDC Application:**
   - Link the OIDC app created in Step 1
   - This becomes the "linked application" that users log into

5. **Save and Copy:**
   - ✅ AI Agent ID (starts with `wlp`)

### Step 3: Configure GitHub in Okta (OIN App)

1. **Add GitHub App from OIN:**
   - Navigate: `Applications` → `Browse App Catalog`
   - Search for: **"GitHub Enterprise Cloud"**
   - Add one of: GitHub Enterprise Cloud - Organization, GitHub EMU, or GitHub Enterprise

2. **Configure Resource Server Tab:**
   - Click on the GitHub app instance
   - Go to **"Resource server"** tab (new feature for OAuth-STS)
   - **Client ID:** Your GitHub App's Client ID (from GitHub)
   - **Client Secret:** Your GitHub App's Client Secret (from GitHub)
   - **Scopes:** (if required) `repo read:user` or leave empty
   - **Save**

### Step 4: Create Managed Connection

1. **Go to AI Agent:**
   ```
   Directory → AI Agents → [Your DevOps Agent]
   ```

2. **Add Managed Connection:**
   - Click: **"Managed connections"** tab
   - Click: **"Add connection"**

3. **Configure Connection:**
   - **Resource type:** Application
   - **Application Instance:** Select the GitHub app from Step 3
   - **Resource Indicator:** Choose format
     - Default ORN: `orn:oktapreview:idp:{idp-id}:client-auth-settings:rs`
     - Or custom: `your-org:github:application`
   - **Save**

4. **Copy Resource Indicator:**
   - ✅ Copy the resource indicator value shown
   - You'll need this for backend configuration

---

## GitHub Configuration

### Step 1: Create GitHub App

1. **Login to GitHub:**
   ```
   https://github.com
   ```

2. **Navigate to Developer Settings:**
   ```
   Settings → Developer settings → GitHub Apps → New GitHub App
   ```

3. **Configure GitHub App:**
   - **GitHub App name:** Okta DevOps Agent
   - **Homepage URL:** `https://your-domain.com` (any URL)
   - **Callback URL:** (CRITICAL!)
     ```
     https://your-org.oktapreview.com/oauth2/v1/sts/callback
     ```
   - **Expire user authorization tokens:** ✅ **CHECK THIS** (enables refresh tokens)
   - **Webhook:** Uncheck "Active" (unless needed)

4. **Set Permissions:**
   - **Repository permissions:**
     - Pull requests: Read and write
     - Issues: Read and write
     - Contents: Read
     - Metadata: Read (automatically included)
   - Choose permissions based on what agent needs

5. **Installation:**
   - **Where can this app be installed?** Choose:
     - "Only on this account" (for testing)
     - Or "Any account" (for production)

6. **Create App**

### Step 2: Get Client Credentials

1. **After creation, you'll see:**
   - **Client ID:** Copy this
   - **Client secrets:** Click "Generate a new client secret"
   - Copy the secret (shown only once!)

2. **Install the App:**
   - Go to: Install App section
   - Click: **Install**
   - Select: Repositories (all or specific)
   - **Authorize**

### Step 3: Copy to Okta

- Add the Client ID and Client Secret to Okta's Resource Server tab (from Okta Step 3)

---

## Backend Setup

### Step 1: Navigate to Backend

```bash
cd /Users/rajeshkumar/Documents/AI/workspace/oktaforai/DevOpsAgentDemo/backend
```

### Step 2: Configure Environment (.env)

Edit the `.env` file:

```bash
# Okta Configuration
OKTA_DOMAIN=https://your-org.oktapreview.com
OKTA_ISSUER=https://your-org.oktapreview.com

# AI Agent Configuration
OKTA_AI_AGENT_ID=wlp...  # From Okta Step 2
OKTA_AI_AGENT_PRIVATE_KEY={"kty":"RSA","kid":"...","use":"sig",...}  # From Okta Step 2

# GitHub Resource Indicator
OKTA_GITHUB_RESOURCE_INDICATOR=your-org:github:application  # From Okta Step 4

# GitHub Configuration
GITHUB_ORG=your-github-org
GITHUB_DEFAULT_REPO=your-default-repo

# LLM Configuration
ANTHROPIC_API_KEY=sk-ant-api03-...  # From https://console.anthropic.com/

# Server Configuration
BACKEND_PORT=8000
CORS_ORIGINS=http://localhost:3000,https://your-vercel-domain.vercel.app

# Debug
LOG_LEVEL=INFO
```

### Step 3: Install Dependencies

The virtual environment is already created with Python 3.10.

```bash
source venv/bin/activate
pip install -r requirements.txt
```

### Step 4: Verify Configuration

```bash
python -c "
from auth.agent_config import get_agent_config, is_configured
config = get_agent_config()
print(f'Agent ID: {config.agent_id}')
print(f'Resource: {config.resource_indicator}')
print(f'Configured: {is_configured()}')
"
```

Expected output:
```
Agent ID: wlp...
Resource: your-org:github:application
Configured: True
```

---

## Frontend Setup

### Step 1: Navigate to Frontend

```bash
cd /Users/rajeshkumar/Documents/AI/workspace/oktaforai/DevOpsAgentDemo/frontend
```

### Step 2: Configure Environment (.env.local)

Edit the `.env.local` file:

```bash
# Okta OIDC Configuration (from Okta Step 1)
NEXT_PUBLIC_OKTA_CLIENT_ID=0oa...  # OIDC App Client ID
OKTA_CLIENT_SECRET=...              # OIDC App Client Secret
NEXT_PUBLIC_OKTA_ISSUER=https://your-org.oktapreview.com

# Public Okta config
NEXT_PUBLIC_OKTA_DOMAIN=https://your-org.oktapreview.com

# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### Step 3: Install Dependencies

```bash
npm install
```

---

## Running the Application

### Terminal 1: Start Backend

```bash
cd /Users/rajeshkumar/Documents/AI/workspace/oktaforai/DevOpsAgentDemo/backend
source venv/bin/activate
python -m uvicorn api.main:app --reload --port 8000
```

**Expected output:**
```
INFO: Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO: Application startup complete.
```

**Test:**
```
http://localhost:8000/health
```

Should return:
```json
{
  "status": "healthy",
  "oauth_sts_configured": true
}
```

### Terminal 2: Start Frontend

```bash
cd /Users/rajeshkumar/Documents/AI/workspace/oktaforai/DevOpsAgentDemo/frontend
npm run dev
```

**Expected output:**
```
✓ Ready in XXXXms
- Local: http://localhost:3000
```

**Access:**
```
http://localhost:3000
```

---

## Testing OAuth-STS Flow

### Scenario 1: First-Time User (Happy Path)

#### Step 1: Login
1. Open: http://localhost:3000
2. Click: **Green "Sign in with Okta"** button
3. Login with your Okta credentials
4. Redirected to chat interface

#### Step 2: Trigger OAuth-STS
**Type in chat:**
```
Show my GitHub repositories
```

#### Step 3: Token Exchange
**Right panel shows:**
- **Agent Flow:** Router → STS Exchange → GitHub → Response
- **Token Exchange:** Processing...

#### Step 4: Authorization Required (First Time)
**Modal appears:**
- Title: "GitHub Authorization Required"
- **Bright orange/red pulsing button:** "🔓 Authorize GitHub Access"

#### Step 5: Authorize
1. Click the orange/red button
2. Popup opens (600x700 window)
3. Okta STS redirect page
4. GitHub OAuth consent screen
5. Click "Authorize" on GitHub
6. Popup closes automatically

#### Step 6: Automatic Retry
- After 1 second, request retries automatically
- OAuth-STS returns fresh GitHub access token
- GitHub API call succeeds
- **Repositories appear in chat!** ✅

#### Step 7: Verify
**Right panel shows:**
- **Agent Flow:** All steps green with checkmarks
- **Token Exchange:** Status "Granted" (green)

### Scenario 2: Returning User (Already Authorized)

#### Step 1: Login and Ask
```
Show my GitHub repositories
```

#### Step 2: Immediate Success
- No modal appears
- Token Exchange shows "Granted" immediately
- Repositories appear directly

### Scenario 3: Revoked Token

If token was revoked in GitHub admin:

#### Step 1: Request Shows Error
```
GitHub Access Token Revoked
```
Instructions appear with steps to re-authorize

#### Step 2: Clear Okta Cache
**Option A - User Portal:**
1. https://your-org.oktapreview.com/enduser/settings
2. Find GitHub connection
3. Revoke

**Option B - Admin Portal:**
1. Admin Console → AI Agents → Your Agent
2. Managed Connections tab
3. Find user's connection
4. Revoke/Clear

#### Step 3: Retry Request
Ask again → Modal appears → Authorize → Success!

---

## OAuth-STS Flow Details

### Token Exchange Request Format

```bash
POST https://your-org.oktapreview.com/oauth2/v1/token
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:token-exchange
requested_token_type=urn:okta:params:oauth:token-type:oauth-sts
subject_token=<USER_ID_TOKEN>
subject_token_type=urn:ietf:params:oauth:token-type:id_token
client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
client_assertion=<SIGNED_JWT>
resource=<RESOURCE_INDICATOR>
```

### Response - Success (200 OK)

```json
{
  "access_token": "gho_xxxxxxxxxxxxxxxx",
  "token_type": "Bearer",
  "expires_in": 28800,
  "refresh_token": "ghr_xxxxxxxx"
}
```

### Response - Interaction Required (400)

```json
{
  "error": "interaction_required",
  "error_description": "User authorization is required",
  "interaction_uri": "https://your-org.oktapreview.com/oauth2/v1/sts/redirect?dataHandle=xxx"
}
```

### Client Assertion JWT Format

```json
{
  "header": {
    "kid": "<key-id-from-jwk>",
    "alg": "RS256"
  },
  "payload": {
    "iss": "<ai-agent-id>",
    "sub": "<ai-agent-id>",
    "aud": "https://your-org.oktapreview.com/oauth2/v1/token",
    "iat": <timestamp>,
    "exp": <timestamp + 60>,
    "jti": "<random-uuid>"
  }
}
```

Signed with agent's private JWK using RS256.

---

## Troubleshooting

### Backend Issues

#### Issue: "No module named 'fastapi'"
**Solution:**
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

#### Issue: "ANTHROPIC_API_KEY not set"
**Solution:**
Edit `backend/.env` and add your Anthropic API key from https://console.anthropic.com/

#### Issue: "OAuth-STS not configured"
**Check:**
```bash
curl http://localhost:8000/health
```
Should show `"oauth_sts_configured": true`

**If false:**
- Verify all environment variables in `.env`
- Restart backend

#### Issue: "invalid_target: 'resource' is invalid"
**Solution:**
- Check your resource indicator format in `.env`
- Must match what's configured in Okta Managed Connection
- Can be ORN format or custom format (e.g., `your-org:github:application`)

### Frontend Issues

#### Issue: Can't login - "Invalid client_secret"
**Solution:**
1. Go to Okta Admin Console
2. Find your OIDC app (Client ID in .env.local)
3. Copy the correct Client Secret
4. Update `frontend/.env.local`
5. Restart frontend

#### Issue: "redirect_uri_mismatch"
**Solution:**
1. Go to Okta Admin Console
2. Edit your OIDC application
3. Add exact URI to Sign-in redirect URIs:
   ```
   http://localhost:3000/api/auth/callback/okta
   ```
4. Save and retry

#### Issue: "Sign in with Okta" button stays on same page
**Solution:**
- Make sure redirect URIs are configured in Okta
- Check browser console (F12) for errors
- Verify `NEXT_PUBLIC_OKTA_ISSUER` is correct

### OAuth-STS Issues

#### Issue: "Bad credentials" (401 from GitHub)
**Cause:** GitHub token was revoked but Okta still has cached token

**Solution:**
1. Revoke connection in Okta:
   - User: https://your-org.oktapreview.com/enduser/settings
   - Admin: AI Agents → Managed Connections → Revoke for user
2. Retry request
3. Authorization modal will appear

#### Issue: No authorization modal appears
**Check:**
1. Backend logs for `interaction_required` response
2. Right panel → Token Exchange card status
3. Browser console for JavaScript errors

**If OAuth-STS returns 200 (success) but GitHub returns 401:**
- Okta cache is still active
- Must clear cache in Okta (see above)

#### Issue: "interaction_uri is null"
**Possible causes:**
1. OAuth-STS returned success (200) not error (400)
2. Managed Connection not properly configured
3. GitHub callback URL incorrect

**Check backend logs:**
```bash
tail -50 /private/tmp/claude-501/-Users-rajeshkumar-Documents-AI-workspace-oktaforai-ProGearSalesnIT/tasks/b922a15.output | grep "OAuth-STS"
```

Look for:
```
[OAuth-STS] Response status: 400  ← Good! interaction_required
[OAuth-STS] Response status: 200  ← Cached token
```

---

## Environment Variables Reference

### Backend (.env)

| Variable | Example | Where to Get |
|----------|---------|--------------|
| `OKTA_DOMAIN` | `https://org.oktapreview.com` | Your Okta org URL |
| `OKTA_AI_AGENT_ID` | `wlp...` | AI Agent → Overview |
| `OKTA_AI_AGENT_PRIVATE_KEY` | `{"kty":"RSA",...}` | AI Agent → Key pair download |
| `OKTA_GITHUB_RESOURCE_INDICATOR` | `org:github:application` | Managed Connection → Resource indicator |
| `GITHUB_ORG` | `your-org` | Your GitHub org name |
| `GITHUB_DEFAULT_REPO` | `repo-name` | Default repo for operations |
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` | https://console.anthropic.com/ |

### Frontend (.env.local)

| Variable | Example | Where to Get |
|----------|---------|--------------|
| `NEXT_PUBLIC_OKTA_CLIENT_ID` | `0oa...` | OIDC App → Client ID |
| `OKTA_CLIENT_SECRET` | `xxx...` | OIDC App → Client Secret |
| `NEXT_PUBLIC_OKTA_ISSUER` | `https://org.oktapreview.com` | Your Okta org URL |
| `NEXTAUTH_SECRET` | Random 32+ chars | `openssl rand -base64 32` |

---

## Monitoring and Debugging

### Backend Logs

**Real-time logs:**
```bash
tail -f /private/tmp/claude-501/-Users-rajeshkumar-Documents-AI-workspace-oktaforai-ProGearSalesnIT/tasks/b922a15.output
```

**Key log lines to watch:**
```
[OAuth-STS] Exchanging token for resource: ...
[OAuth-STS] Response status: 200 (success) or 400 (interaction_required)
[OAuth-STS] Token exchange response: error=interaction_required, interaction_uri=...
[STS Exchange] Result: success=True/False, interaction_required=True/False
[Execute] Operation: list_repos
```

### Frontend Console

**Open browser DevTools (F12):**
- Console tab: Check for errors
- Network tab: See API calls to backend
- Application tab: Check session storage

### Right Panel Visualization

**Agent Flow Card:**
- Shows real LangGraph workflow execution
- Router → STS → GitHub → Response
- Each step shows actual status

**Token Exchange Card:**
- Shows real OAuth-STS exchange result
- Status: Granted, Denied, Interaction Required, Error
- No fake scope information (OAuth-STS doesn't provide scopes)

---

## GitHub Operations Supported

| Command | Example | GitHub API Endpoint |
|---------|---------|---------------------|
| List repos | "Show my repos" | `GET /user/repos` |
| List PRs | "List PRs in repo-name" | `GET /repos/{owner}/{repo}/pulls` |
| List issues | "Show issues" | `GET /repos/{owner}/{repo}/issues` |
| Comment | "Comment on issue #5 saying 'test'" | `POST /repos/.../issues/{n}/comments` |
| Close issue | "Close issue #10" | `PATCH /repos/.../issues/{n}` |
| Help | "What can you do?" | N/A (static response) |

---

## Security Notes

- **ID Token:** Used for OAuth-STS exchange, stored in session only
- **GitHub Token:** Obtained via Okta, expires per GitHub App settings
- **Refresh Tokens:** Supported if GitHub App has expiry enabled
- **User Consent:** Required first time, can be revoked in Okta anytime
- **Audit Trail:** All OAuth-STS exchanges logged in Okta system logs
- **No Secrets in Frontend:** Only public client ID exposed

---

## Key Differences from ProGear (ID-JAG)

| Aspect | ProGear (ID-JAG) | DevOps Agent (OAuth-STS) |
|--------|------------------|--------------------------|
| **Purpose** | Access internal APIs | Access external SaaS (GitHub) |
| **Flow** | User → ID-JAG → Custom Auth Server | User → OAuth-STS → External Service |
| **Token Type** | Custom audience token | External service token |
| **Consent** | Not required (internal) | Required (external) |
| **Use Case** | Enterprise microservices | Third-party integrations |

---

## Deployment Guide

### Deploy Backend (Render/Heroku)

1. **Connect repository**
2. **Set environment variables** (all from backend/.env)
3. **Build command:** `pip install -r requirements.txt`
4. **Start command:** `uvicorn api.main:app --host 0.0.0.0 --port $PORT`

### Deploy Frontend (Vercel)

1. **Connect repository**
2. **Framework preset:** Next.js
3. **Root directory:** `frontend`
4. **Environment variables:** All from frontend/.env.local
5. **Deploy**

### Update Okta Configuration

After deployment, add production URLs:

**OIDC App Redirect URIs:**
```
https://your-vercel-domain.vercel.app/api/auth/callback/okta
https://your-vercel-domain.vercel.app/login
```

**GitHub App Callback URL:**
```
https://your-org.oktapreview.com/oauth2/v1/sts/callback
```

**Frontend .env:**
```
NEXT_PUBLIC_API_URL=https://your-render-backend.onrender.com
NEXTAUTH_URL=https://your-vercel-domain.vercel.app
```

**Backend .env:**
```
CORS_ORIGINS=https://your-vercel-domain.vercel.app
```

---

## Success Criteria

✅ User can login via Okta SSO
✅ Chat interface functional
✅ First request triggers authorization modal
✅ Modal shows bright orange/red pulsing button
✅ Popup opens with interaction_uri
✅ After GitHub authorization, popup closes
✅ Request automatically retries
✅ GitHub operations execute successfully
✅ Token Exchange card shows accurate status
✅ Agent Flow card shows real workflow steps
✅ Responses are plain text (no markdown)
✅ Logout redirects back to login page

---

## Additional Resources

- **Architecture:** See `docs/architecture.md`
- **User Prompts Log:** See `docs/USER_PROMPTS_ONLY.md`
- **Project History:** See `docs/PROJECT_INSTRUCTIONS_LOG.md`

---

## Support

**Backend issues:** Check logs at `/private/tmp/claude-501/.../tasks/b922a15.output`
**Frontend issues:** Check browser console (F12)
**Okta issues:** Check Okta system logs in Admin Console
**GitHub issues:** Verify app installation and permissions

---

**Last Updated:** March 17, 2026
**Version:** 1.0.0
