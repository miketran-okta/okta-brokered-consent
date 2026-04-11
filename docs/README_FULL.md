# DevOps Agent - Okta Brokered Consent Demo

> AI-powered DevOps assistant showcasing **Okta Brokered Consent (OAuth-STS)** for secure GitHub integration

[![Okta](https://img.shields.io/badge/Okta-OAuth--STS-007DC1?logo=okta)](https://developer.okta.com/)
[![GitHub](https://img.shields.io/badge/GitHub-API-181717?logo=github)](https://docs.github.com/en/rest)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.0-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2.45-276DC3)](https://github.com/langchain-ai/langgraph)

## 🎯 What is This?

This demo application showcases **Okta Brokered Consent (OAuth-STS)**, which enables AI agents to securely access external SaaS applications (like GitHub) on behalf of users with proper consent and governance.

**Key Features:**
- 🔐 Secure token exchange via Okta OAuth-STS
- 🤖 AI-powered GitHub operations using LiteLLM proxy
- 📊 Real-time visualization of token exchange flow
- 🔄 LangGraph orchestration with intelligent routing
- ✨ Interactive consent flow with popup authorization

## 🏗️ Architecture

```
┌──────────────┐     ID Token      ┌──────────────┐
│   Next.js    │ ───────────────▶  │   FastAPI    │
│   Frontend   │                    │   Backend    │
│  (Vercel)    │ ◀───────────────  │   (Render)   │
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

**Full architecture details:** [docs/architecture.md](docs/architecture.md)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- Okta OIE org with OAuth-STS enabled
- GitHub account/organization

### 1. Clone Repository

```bash
git clone <your-repo-url>
cd DevOpsAgentDemo
```

### 2. Backend Setup

```bash
cd backend
source venv/bin/activate  # Already configured with Python 3.10
pip install -r requirements.txt

# Configure .env
cp .env.example .env
# Edit .env with your credentials

# Start
python -m uvicorn api.main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend
npm install

# Configure .env.local
# Add your Okta credentials

# Start
npm run dev
```

### 4. Access Application

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| **[Implementation & Setup Guide](docs/IMPLEMENTATION_SETUP_GUIDE.md)** | Complete setup instructions |
| **[Architecture](docs/architecture.md)** | Technical architecture and flow |
| **[User Prompts Log](docs/USER_PROMPTS_ONLY.md)** | Development history |

---

## 🎮 Usage

### First Time Flow

1. **Login:** Click "Sign in with Okta" (green button)
2. **Ask:** "Show my GitHub repositories"
3. **Authorize:** Modal appears with orange/red pulsing button
4. **Click:** "🔓 Authorize GitHub Access"
5. **Popup:** Opens for GitHub authorization
6. **Grant:** Authorize the DevOps Agent
7. **Success:** Popup closes, repositories appear!

### Subsequent Requests

Ask directly - no authorization needed:
- "Show my repos"
- "List PRs in my-repo"
- "Show open issues"
- "Comment on issue #5 saying 'Fixed'"
- "Close issue #10"

---

## 🛠️ Technology Stack

### Backend
- **FastAPI** - REST API framework
- **LangGraph** - Workflow orchestration
- **LangChain + Claude** - AI agent routing and response generation
- **httpx** - Async HTTP client
- **jwcrypto** - JWT signing for client assertions

### Frontend
- **Next.js 16** - React framework with Turbopack
- **NextAuth.js** - Okta OIDC authentication
- **TailwindCSS** - Styling (ProGear color scheme)
- **TypeScript** - Type safety

### Integration
- **Okta OAuth-STS** - Brokered consent for external SaaS
- **GitHub API** - Repository operations
- **LiteLLM Proxy** - LLM gateway for agent intelligence

---

## 🔐 Security

- ✅ No hardcoded credentials
- ✅ Environment-based configuration
- ✅ JWT-based client authentication
- ✅ User consent required for GitHub access
- ✅ Tokens can be revoked anytime in Okta
- ✅ All actions auditable through Okta logs
- ✅ Follows OAuth 2.0 Token Exchange specification (RFC 8693)

---

## 📊 OAuth-STS vs ID-JAG

| Feature | ID-JAG | OAuth-STS (This Demo) |
|---------|--------|----------------------|
| **Target** | Internal APIs | External SaaS (GitHub) |
| **Token Exchange** | 2-step (ID-JAG → Auth Server) | 1-step (Direct to external token) |
| **User Consent** | Not required | Required (brokered) |
| **Use Case** | Microservices | Third-party integrations |

**ProGear** (companion project) demonstrates ID-JAG for internal API access.

---

## 🎨 UI Features

- **Dark Theme:** GitHub-inspired dark gradient design
- **Real-Time Visualization:**
  - Agent Flow Card: Shows LangGraph workflow execution
  - Token Exchange Card: Shows OAuth-STS exchange status
- **Interactive Authorization:** Modal with animated button for consent
- **Chat Interface:** Natural language interaction with AI agent

---

## 🧪 Testing

### Test OAuth-STS Flow

```bash
# Start backend
cd backend && source venv/bin/activate
python -m uvicorn api.main:app --reload --port 8000

# Start frontend (new terminal)
cd frontend && npm run dev

# Open browser
http://localhost:3000
```

### Test Backend Endpoints

```bash
# Health check
curl http://localhost:8000/health

# Config
curl http://localhost:8000/api/config

# Agent info
curl http://localhost:8000/api/agent
```

---

## 📝 Configuration Checklist

### Okta Setup
- [ ] OIDC application created
- [ ] AI Agent entity created with key pair
- [ ] GitHub app added from OIN catalog
- [ ] Resource server configured with GitHub credentials
- [ ] Managed connection created
- [ ] Redirect URIs added to OIDC app

### GitHub Setup
- [ ] GitHub App created
- [ ] Callback URL set to Okta STS endpoint
- [ ] Permissions configured
- [ ] App installed to account/org

### Local Setup
- [ ] Backend .env configured
- [ ] Frontend .env.local configured
- [ ] Dependencies installed
- [ ] Both services running

---

## 🤝 Contributing

This is a demo/reference implementation. Feel free to:
- Fork and customize for your use case
- Report issues
- Suggest improvements
- Adapt for other ISVs (Jira, Office 365, etc.)

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🔗 Resources

- **Okta Developer Docs:** https://developer.okta.com/
- **OAuth-STS Documentation:** https://developer.okta.com/docs/guides/configure-oauth-sts/
- **GitHub Apps:** https://docs.github.com/en/apps
- **LangGraph:** https://github.com/langchain-ai/langgraph
- **LiteLLM:** https://docs.litellm.ai

---

## 📞 Support

For issues or questions:
1. Check [Implementation & Setup Guide](docs/IMPLEMENTATION_SETUP_GUIDE.md)
2. Review [Architecture](docs/architecture.md)
3. Check backend logs for OAuth-STS details
4. Verify Okta and GitHub configurations

---

## 🎬 Demo Flow

1. **User Authentication** → Okta SSO login
2. **Natural Language Query** → "Show my repos"
3. **AI Routing** → LangGraph determines intent
4. **OAuth-STS Exchange** → User token → GitHub token
5. **Consent Flow** → Modal → Popup → Authorize
6. **GitHub API Call** → Fetch repositories
7. **AI Response** → Natural language summary
8. **Visualization** → Real-time workflow display

**Experience Okta Brokered Consent in action!** 🚀

---

Made with ❤️ using Okta, GitHub, LangGraph, and Claude
