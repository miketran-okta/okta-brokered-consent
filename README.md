# DevOps Agent - Okta OAuth-STS Demo

> AI-powered DevOps assistant demonstrating **Okta Brokered Consent (OAuth-STS)** for secure GitHub integration

[![Okta](https://img.shields.io/badge/Okta-OAuth--STS-007DC1?logo=okta)](https://developer.okta.com/)
[![GitHub](https://img.shields.io/badge/GitHub-API-181717?logo=github)](https://docs.github.com/en/rest)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.0-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2.45-276DC3)](https://github.com/langchain-ai/langgraph)

---

## What is OAuth-STS?

**OAuth-STS (OAuth Security Token Service)** is Okta's implementation of **Brokered Consent**, enabling AI agents to securely access external SaaS applications (like GitHub and Jira) on behalf of users with proper consent and governance.

Unlike traditional OAuth where each application manages its own consent flow, OAuth-STS centralizes consent management in Okta. Users grant permission once through Okta's familiar interface, and the AI agent can then exchange the user's ID token for service-specific access tokens.

**Why this matters for AI agents:**
- 🔐 **Centralized Governance** - IT admins control which AI agents can access which services
- ✅ **User Consent** - Users explicitly authorize each service integration
- 🔄 **Token Management** - Okta handles token lifecycle, refresh, and revocation
- 📊 **Audit Trail** - All AI agent actions are logged in Okta system logs

---

## Architecture Overview

```
┌──────────────┐     ID Token      ┌──────────────┐
│   Next.js    │ ───────────────▶  │   FastAPI    │
│   Frontend   │                    │   Backend    │
│  (User UI)   │ ◀───────────────  │  (LangGraph) │
└──────────────┘   Response +       └──────────────┘
                   Agent Flow              │
                                          │ OAuth-STS
                                          │ Token Exchange
                                          ▼
                                   ┌──────────────┐
                                   │  Okta STS    │
                                   │ /oauth2/v1/  │
                                   │    token     │
                                   └──────────────┘
                                          │
                                          │ GitHub Token
                                          ▼
                                   ┌──────────────┐
                                   │  GitHub API  │
                                   │ api.github   │
                                   │    .com      │
                                   └──────────────┘
```

**Flow:**
1. User logs in via Okta OIDC (receives ID token)
2. User requests GitHub operation through AI agent
3. Backend exchanges ID token for GitHub access token via OAuth-STS
4. First time: User authorizes via consent popup
5. GitHub operation executes with exchanged token
6. AI generates natural language response

📖 **Detailed architecture:** [docs/architecture.md](docs/architecture.md)

---

## Prerequisites

### Required Accounts & Access

- ✅ **Okta**: OIE org with `SECURE_AI_AGENTS` and `SECURE_AI_OAUTH_STS` features enabled
- ✅ **GitHub**: Account or organization with admin access
- ✅ **LiteLLM Proxy**: API key and base URL for LLM routing
- ✅ **Development Tools**: Node.js 18+, Python 3.10+

### Important Notes

⚠️ **OAuth-STS Requirement**: This demo requires Okta OIE (Identity Engine) with OAuth-STS feature enabled. Contact your Okta Customer Success Manager (CSM) or Solutions Engineer (SE) if you need this feature enabled on your org.

⚠️ **Training Environment**: This demo uses **read-only** GitHub permissions for safety in training environments.

---

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/miketran-okta/okta-brokered-consent.git
cd okta-brokered-consent
```

---

### 2. Okta Configuration

#### 2.1 Create OIDC Application (User Login)

1. **Okta Admin Console** → **Applications** → **Create App Integration**
2. **Type:** OIDC - OpenID Connect
3. **Application type:** Web Application
4. **Configure:**
   - **App name:** `DevOps Agent Frontend`
   - **Grant types:** Authorization Code, Refresh Token
   - **Sign-in redirect URIs:**
     ```
     http://localhost:3000/api/auth/callback/okta
     ```
   - **Sign-out redirect URIs:**
     ```
     http://localhost:3000
     ```
5. **Save** and copy:
   - ✅ **Client ID** (starts with `0oa`)
   - ✅ **Client Secret**

---

#### 2.2 Create AI Agent Entity

1. **Directory** → **AI Agents** → **Create AI Agent**
2. **Configure:**
   - **Name:** `DevOps Agent`
   - **Description:** `GitHub integration via OAuth-STS`
   - **Owner:** Select an owner (requires Access Governance SKU)
3. **Generate Key Pair:**
   - Click **"Generate public/private key pair"**
   - Download the **private JWK** (JSON format)
   - ⚠️ **Save securely** - this will be used in backend configuration
4. **Link OIDC Application:**
   - Link the OIDC app created in step 2.1
   - This connection allows the AI agent to act on behalf of users who log in
5. **Copy:**
   - ✅ **AI Agent ID** (starts with `wlp`)

---

#### 2.3 Add GitHub App from OIN Catalog

1. **Applications** → **Browse App Catalog**
2. **Search:** `GitHub Enterprise Cloud`
3. **Add** one of:
   - GitHub Enterprise Cloud - Organization
   - GitHub Enterprise Cloud - EMU
   - GitHub Enterprise Cloud
4. **Resource Server Tab** (critical for OAuth-STS):
   - Navigate to the **"Resource server"** tab
   - **Client ID:** [Leave empty - will fill from GitHub app in next section]
   - **Client Secret:** [Leave empty - will fill from GitHub app in next section]
   - **Scopes:** Leave empty for this demo
5. **Save** (we'll update with GitHub credentials in step 3.4)

---

#### 2.4 Create Managed Connection

1. Go to your AI Agent: **Directory** → **AI Agents** → **[DevOps Agent]**
2. **Managed connections** tab → **Add connection**
3. **Configure:**
   - **Resource type:** Application
   - **Application Instance:** Select the GitHub app from step 2.3   
4. **Save** and copy:
   - ✅ **Resource Indicator** - you'll need this for backend config

---

### 3. GitHub Configuration

#### 3.1 Create GitHub App

1. **GitHub** → **Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**

2. **Configure:**
   - **GitHub App name:** `Okta DevOps Agent`
   - **Homepage URL:** `https://your-domain.com` (any valid URL)
   
   - **Callback URL:** ⚠️ **CRITICAL - Use your Okta domain:**
     ```
     https://demo-takolive-sb.oktapreview.com/oauth2/v1/sts/callback
     ```
     
     ℹ️ **Replace** `demo-takolive-sb.oktapreview.com` with **YOUR** Okta org domain
     
     ℹ️ **The path** `/oauth2/v1/sts/callback` **is the standard Okta OAuth-STS callback endpoint** (not a placeholder!)
   
   - **Expire user authorization tokens:** ✅ **CHECK THIS** (enables refresh tokens)
   - **Webhook:** ❌ Uncheck "Active" (not needed for this demo)

---

#### 3.2 Set Permissions (Read-Only for Training)

**Repository permissions:**
- **Contents:** Read-only
- **Issues:** Read-only
- **Pull requests:** Read-only
- **Metadata:** Read-only (automatically included)

ℹ️ **Note:** This demo uses **read-only** permissions for safety in training environments. The agent can view repositories, pull requests, and issues but cannot modify them. For production use cases requiring write access, you can adjust these permissions.

**Where can this app be installed?**
- Choose: **"Only on this account"** (recommended for training)

---

#### 3.3 Get Client Credentials

1. After creation, you'll see:
   - **Client ID:** Copy this
2. **Generate Client Secret:**
   - Click **"Generate a new client secret"**
   - Copy the secret (shown only once!)
3. **Install the App:**
   - Go to **"Install App"** section
   - Click **"Install"**
   - Select repositories (all or specific)
   - **Authorize**

---

#### 3.4 Update Okta with GitHub Credentials

1. Return to **Okta Admin Console**
2. Go to the GitHub app instance from step 2.3
3. Navigate to **"Resource Server"** tab
4. **Update:**
   - **Client ID:** Paste GitHub App Client ID
   - **Client Secret:** Paste GitHub App Client Secret
5. **Save**

✅ **OAuth-STS setup complete!** Okta can now exchange tokens for GitHub access.

---

### 4. Backend Setup

```bash
cd backend

# Create Python virtual environment (Python 3.10+)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
```

**Edit `backend/.env`** with your values:

```bash
# Okta Configuration
OKTA_DOMAIN=https://your-org.oktapreview.com
OKTA_ISSUER=https://your-org.oktapreview.com

# AI Agent (from step 2.2)
OKTA_AI_AGENT_ID=wlp...
OKTA_AI_AGENT_PRIVATE_KEY={"kty":"RSA","kid":"...","use":"sig",...}

# GitHub Resource Indicator (from step 2.4)
OKTA_GITHUB_RESOURCE_INDICATOR=orn:oktapreview:idp:00xxxxx:client-auth-settings:rsxxxxx

# GitHub Configuration
GITHUB_ORG=your-github-org
GITHUB_DEFAULT_REPO=your-repo

# LiteLLM Proxy
LITELLM_API_KEY=sk-...
LITELLM_BASE_URL=https://your-litellm-proxy.com
LITELLM_MODEL=claude-4-5-sonnet

# Server
BACKEND_PORT=8000
CORS_ORIGINS=http://localhost:3000

# Debug
LOG_LEVEL=INFO
```

**Start backend:**

```bash
python -m uvicorn api.main:app --reload --port 8000
```

**Verify health:**

```bash
curl http://localhost:8000/health
# Should return: {"status":"healthy","oauth_sts_configured":true}
```

**API Documentation:** http://localhost:8000/docs

---

### 5. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
```

**Edit `frontend/.env.local`:**

```bash
# Okta OIDC (from step 2.1)
OKTA_CLIENT_ID=0oa...
OKTA_CLIENT_SECRET=...
OKTA_ISSUER=https://your-org.oktapreview.com

# Public config
NEXT_PUBLIC_OKTA_DOMAIN=https://your-org.oktapreview.com
NEXT_PUBLIC_API_URL=http://localhost:8000

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$(openssl rand -base64 32)  # Generate with: openssl rand -base64 32
```

**Start frontend:**

```bash
npm run dev
```

**Access:** http://localhost:3000

---

### 6. Test OAuth-STS Flow

#### First-Time User Flow

1. **Login:** Open http://localhost:3000 → Click **"Sign in with Okta"**
2. **Send message:** Type `"Show my GitHub repositories"`
3. **Authorization Modal:** A modal appears with an orange/red pulsing button
4. **Click:** **"🔓 Authorize GitHub Access"**
5. **Popup:** GitHub authorization popup opens (600x700 window)
6. **Grant consent:** Click **"Authorize"** on GitHub
7. **Success:** Popup closes automatically, repositories appear!

#### Subsequent Requests

No authorization needed - token is cached by Okta:
- `"Show my GitHub repositories"`
- `"List pull requests in [repo-name]"`
- `"Show open issues in [repo-name]"`

The OAuth-STS flow only requires user consent **once per service**. After that, tokens are exchanged transparently in the background.

---

## Configuration Reference

### Critical Callback URLs

| Component | Callback URL | Where to Configure |
|-----------|-------------|-------------------|
| **GitHub App** | `https://YOUR-OKTA-DOMAIN.oktapreview.com/oauth2/v1/sts/callback` | GitHub App settings → Callback URL |
| **Okta OIDC App** | `http://localhost:3000/api/auth/callback/okta` | Okta OIDC app → Sign-in redirect URIs |

⚠️ **Important:** The GitHub callback URL path `/oauth2/v1/sts/callback` is the **standard Okta OAuth-STS endpoint** - this is NOT a placeholder! Only replace the domain portion with your Okta org domain.

**Example:**
- ❌ Wrong: `https://YOUR-OKTA-DOMAIN/callback`
- ✅ Correct: `https://demo-takolive-sb.oktapreview.com/oauth2/v1/sts/callback`

---

### Required Environment Variables

#### Backend (`.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `OKTA_AI_AGENT_ID` | AI Agent entity ID (not OIDC app) | `wlpxxxxxxxxx` |
| `OKTA_AI_AGENT_PRIVATE_KEY` | Private JWK from AI Agent key pair | `{"kty":"RSA",...}` |
| `OKTA_GITHUB_RESOURCE_INDICATOR` | From Managed Connection | `orn:oktapreview:idp:...` |
| `LITELLM_API_KEY` | LiteLLM proxy API key | `sk-xxxxxxxx` |
| `LITELLM_BASE_URL` | LiteLLM proxy URL | `https://llm.atko.ai` |

#### Frontend (`.env.local`)

| Variable | Description | Example |
|----------|-------------|---------|
| `OKTA_CLIENT_ID` | OIDC app Client ID (for user login, not AI Agent) | `0oaxxxxxxxxx` |
| `OKTA_CLIENT_SECRET` | OIDC app Client Secret | `xxxxxxxxxxxxx` |
| `NEXTAUTH_SECRET` | Random secret for session encryption | Generate with `openssl rand -base64 32` |

---

### Common Configuration Issues

#### `"redirect_uri_mismatch"`
**Solution:** Verify OIDC app redirect URIs include exact URL:
```
http://localhost:3000/api/auth/callback/okta
```

#### `"invalid_target: 'resource' is invalid"`
**Solution:** Verify resource indicator in `.env` matches exactly what's configured in Okta Managed Connection.

#### `"Bad credentials"` from GitHub
**Solutions:**
- Verify GitHub app Client ID/Secret are correct in Okta Resource Server tab
- Verify GitHub app callback URL uses correct Okta domain with `/oauth2/v1/sts/callback` path

#### `oauth_sts_configured: false`
**Solution:**
- Run `curl http://localhost:8000/health`
- Check all backend `.env` variables are set correctly
- Verify `OKTA_AI_AGENT_PRIVATE_KEY` is valid JSON

---

## Usage Examples

Once set up, try these natural language commands:

### GitHub Operations
- `"Show my GitHub repositories"`
- `"List pull requests in my-repo"`
- `"Show open issues in my-repo"`
- `"What repositories do I have access to?"`
- `"Show me PRs in the devops-agent repo"`

### Agent Help
- `"What can you do?"`
- `"Help"`

---

## Technology Stack

### Backend
- **FastAPI** - Modern Python web framework
- **LangGraph** - Workflow orchestration for AI agents
- **LangChain** - LLM integration framework
- **LiteLLM Proxy** - LLM gateway for routing requests to Claude
- **httpx** - Async HTTP client for API calls
- **jwcrypto** - JWT signing for client assertions

### Frontend
- **Next.js 16** - React framework with App Router
- **NextAuth.js** - Okta OIDC authentication
- **TailwindCSS** - Utility-first CSS framework
- **TypeScript** - Type safety and developer experience

### Integration
- **Okta OAuth-STS** - Brokered consent and token exchange
- **GitHub REST API** - Repository operations
- **LiteLLM Proxy** - AI response generation

---

## Additional Documentation

| Document | Description |
|----------|-------------|
| [Implementation Setup Guide](docs/IMPLEMENTATION_SETUP_GUIDE.md) | Detailed step-by-step setup with troubleshooting |
| [Architecture Documentation](docs/architecture.md) | Technical architecture and OAuth-STS flow details |
| [CLAUDE.md](CLAUDE.md) | AI assistant developer guidance |
| [Full README](docs/README_FULL.md) | Original comprehensive README with all details |

---

## Security & Governance

✅ **User Consent Required** - Users must explicitly authorize GitHub access through Okta  
✅ **Token Revocation** - Users can revoke access anytime in Okta user settings  
✅ **Audit Trail** - All OAuth-STS token exchanges logged in Okta system logs  
✅ **No Secrets in Frontend** - Only public OIDC client ID exposed to browser  
✅ **JWT-Based Authentication** - Agent authenticates with RS256-signed JWTs  
✅ **Time-Limited Tokens** - GitHub tokens expire per app settings (supports refresh)  
✅ **Centralized Governance** - IT admins control agent access via Okta policies  

---

## OAuth-STS vs ID-JAG

Okta offers two token exchange mechanisms for AI agents:

| Feature | OAuth-STS (This Demo) | ID-JAG |
|---------|----------------------|---------|
| **Purpose** | External SaaS access (GitHub, Jira, Office 365) | Internal API access (enterprise microservices) |
| **Target Services** | Third-party applications in OIN catalog | Custom Authorization Servers in Okta |
| **User Consent** | Required (brokered through Okta) | Not required (internal trust) |
| **Token Type** | External service token (GitHub token) | Internal access token with custom claims |
| **Token Exchange** | 1-step: ID token → External token | 2-step: ID token → ID-JAG → Custom token |
| **Use Case** | AI agents accessing external SaaS APIs | AI agents accessing internal enterprise APIs |

**Related Project:** The companion **ProGear** demo showcases ID-JAG for internal API access patterns.

---

## Support & Troubleshooting

### Documentation
- 📖 **Detailed Troubleshooting:** [Implementation Setup Guide - Troubleshooting Section](docs/IMPLEMENTATION_SETUP_GUIDE.md#troubleshooting)
- 🏗️ **Architecture Questions:** [Architecture Documentation](docs/architecture.md)

### Debugging
- **Backend logs:** Check terminal output for OAuth-STS exchange details
- **Frontend errors:** Open browser console (F12) for JavaScript errors
- **Health check:** `curl http://localhost:8000/health`
- **API docs:** http://localhost:8000/docs

### Common Issues
1. **No authorization modal** - Check backend logs for `interaction_required` response
2. **Popup doesn't open** - Check browser popup blocker settings
3. **Token expired** - Revoke connection in Okta and re-authorize
4. **CORS errors** - Verify `CORS_ORIGINS` in backend `.env` includes frontend URL

---

## License

MIT License - See [LICENSE](LICENSE) file for details

---

## Contributing

This is a reference implementation for Okta enablement training. Feel free to:
- Fork and customize for your use case
- Report issues or suggest improvements
- Adapt for other ISVs (Jira, Salesforce, Office 365, etc.)

---

## Resources

- **Okta Developer Docs:** https://developer.okta.com/
- **OAuth-STS Guide:** https://developer.okta.com/docs/guides/configure-oauth-sts/
- **GitHub Apps:** https://docs.github.com/en/apps
- **LangGraph:** https://github.com/langchain-ai/langgraph
- **LiteLLM:** https://docs.litellm.ai

---

**Made for Okta enablement training** • Demonstrates OAuth-STS (Brokered Consent) for AI agent security and governance
