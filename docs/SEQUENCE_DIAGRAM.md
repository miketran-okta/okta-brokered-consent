# OAuth-STS Sequence Diagram - DevOps Agent

Complete sequence diagram showing the Okta Brokered Consent (OAuth-STS) flow for AI agents.

---

## Complete Flow Diagram

```mermaid
sequenceDiagram
    participant User as 👤 User Browser
    participant Frontend as 🌐 Next.js Frontend<br/>(Vercel)
    participant Backend as 🖥️ FastAPI Backend<br/>(Render)
    participant Okta as 🔐 Okta STS<br/>/oauth2/v1/token
    participant GitHub as 🐙 GitHub API<br/>api.github.com

    Note over User,GitHub: 1. USER LOGIN FLOW

    User->>Frontend: 1. Visit app & click "Sign in with Okta"
    Frontend->>Okta: 2. OIDC Authorization Request<br/>GET /oauth2/v1/authorize
    Okta->>User: 3. Show login page
    User->>Okta: 4. Enter credentials
    Okta->>Frontend: 5. Redirect with auth code
    Frontend->>Okta: 6. Exchange code for tokens<br/>POST /oauth2/v1/token
    Okta->>Frontend: 7. Return ID token + Access token
    Frontend->>User: 8. Show chat interface

    Note over User,GitHub: 2. FIRST TIME: OAUTH-STS WITH INTERACTION REQUIRED

    User->>Frontend: 9. Ask "Show my repos"
    Frontend->>Backend: 10. POST /api/chat<br/>Authorization: Bearer {ID_TOKEN}

    Backend->>Backend: 11. Router: Parse intent = "list_repos"

    Backend->>Backend: 12. Build Client Assertion JWT<br/>(signed with agent private key)

    Backend->>Okta: 13. OAuth-STS Token Exchange<br/>POST /oauth2/v1/token<br/>grant_type=token-exchange<br/>subject_token={ID_TOKEN}<br/>client_assertion={SIGNED_JWT}<br/>resource={RESOURCE_INDICATOR}

    Okta->>Backend: 14. ❌ 400 Bad Request<br/>error=interaction_required<br/>interaction_uri=https://...sts/redirect?dataHandle=xxx

    Backend->>Frontend: 15. Return interaction_required<br/>+ interaction_uri

    Frontend->>User: 16. Show authorization modal<br/>🔥 Orange/Red pulsing button

    User->>Frontend: 17. Click "🔓 Authorize GitHub Access"

    Frontend->>User: 18. Open popup window (600x700)<br/>URL: interaction_uri

    User->>Okta: 19. Popup loads Okta STS redirect page
    Okta->>GitHub: 20. Redirect to GitHub OAuth consent
    GitHub->>User: 21. Show "Authorize oktaforai-okta?"
    User->>GitHub: 22. Click "Authorize"
    GitHub->>Okta: 23. Return auth code
    Okta->>User: 24. Show success page "You may close this window"
    User->>Frontend: 25. Close popup window

    Frontend->>Frontend: 26. Detect popup closed (polling)
    Frontend->>Backend: 27. Retry same request<br/>POST /api/chat<br/>Authorization: Bearer {SAME_ID_TOKEN}

    Backend->>Backend: 28. Router: Parse intent = "list_repos"
    Backend->>Backend: 29. Build new Client Assertion JWT
    Backend->>Okta: 30. OAuth-STS Token Exchange (RETRY)<br/>POST /oauth2/v1/token<br/>(same parameters)

    Okta->>Backend: 31. ✅ 200 OK<br/>access_token={GITHUB_TOKEN}<br/>expires_in=28800

    Backend->>GitHub: 32. List repositories<br/>GET /user/repos<br/>Authorization: Bearer {GITHUB_TOKEN}

    GitHub->>Backend: 33. ✅ 200 OK<br/>[{repo1}, {repo2}, ...]

    Backend->>Backend: 34. Generate response with Claude
    Backend->>Frontend: 35. Return repositories + agent flow
    Frontend->>User: 36. Display repositories in chat

    Note over User,GitHub: 3. SUBSEQUENT REQUESTS (CACHED TOKEN)

    User->>Frontend: 37. Ask "Show PRs"
    Frontend->>Backend: 38. POST /api/chat<br/>Authorization: Bearer {ID_TOKEN}
    Backend->>Backend: 39. Router: Parse intent = "list_prs"
    Backend->>Okta: 40. OAuth-STS Token Exchange<br/>POST /oauth2/v1/token

    Okta->>Backend: 41. ✅ 200 OK (CACHED)<br/>access_token={SAME_GITHUB_TOKEN}<br/>expires_in=28630

    Backend->>GitHub: 42. List pull requests<br/>GET /repos/{owner}/{repo}/pulls
    GitHub->>Backend: 43. ✅ 200 OK<br/>[{pr1}, {pr2}, ...]
    Backend->>Frontend: 44. Return PRs
    Frontend->>User: 45. Display PRs

    Note over User,GitHub: 4. TOKEN REVOKED SCENARIO

    User->>GitHub: 46. Admin revokes token in GitHub
    User->>Frontend: 47. Ask "Show issues"
    Frontend->>Backend: 48. POST /api/chat
    Backend->>Okta: 49. OAuth-STS Token Exchange
    Okta->>Backend: 50. ✅ 200 OK (CACHED - doesn't know revoked)
    Backend->>GitHub: 51. GET /repos/{owner}/{repo}/issues
    GitHub->>Backend: 52. ❌ 401 Unauthorized<br/>message: "Bad credentials"
    Backend->>Backend: 53. Detect token_revoked=True
    Backend->>Frontend: 54. Return revocation error message
    Frontend->>User: 55. Show "GitHub Access Token Revoked"<br/>Instructions to clear Okta cache
```

---

## Key Flows Breakdown

### Flow 1: User Authentication (Steps 1-8)
- User logs into Okta via OIDC
- Gets ID token from "linked application"
- This ID token is used for OAuth-STS

### Flow 2: First Time OAuth-STS (Steps 9-36)
- Backend makes OAuth-STS POST request
- Okta returns `interaction_required` with `interaction_uri`
- User authorizes via popup
- Retry OAuth-STS → Gets GitHub token
- Makes GitHub API call

### Flow 3: Subsequent Requests (Steps 37-45)
- OAuth-STS returns cached GitHub token (fast!)
- No authorization needed
- Direct GitHub API calls

### Flow 4: Token Revoked (Steps 46-55)
- GitHub returns 401 (token revoked)
- Okta still has cached token
- Shows error with instructions to clear cache

---

## Alternative: Mermaid Diagram (For GitHub/Docs)

If you want to render this in GitHub or documentation tools, save as `.mmd` file:

```mermaid
graph TD
    A[User Login] --> B[Get ID Token from Okta]
    B --> C[User Asks: Show my repos]
    C --> D[Backend: Router parses intent]
    D --> E[OAuth-STS Token Exchange POST]
    E --> F{First Time?}

    F -->|No Consent| G[Okta returns 400<br/>interaction_required]
    G --> H[Show Authorization Modal]
    H --> I[User clicks Authorize]
    I --> J[Open Popup with interaction_uri]
    J --> K[User authorizes at GitHub]
    K --> L[Close Popup]
    L --> M[Auto-retry OAuth-STS POST]

    F -->|Already Consented| N[Okta returns 200<br/>GitHub Access Token]
    M --> N

    N --> O[Make GitHub API Call]
    O --> P{Success?}
    P -->|Yes| Q[Display Results]
    P -->|401| R[Token Revoked<br/>Show Instructions]

    style G fill:#f59e0b
    style N fill:#22c55e
    style R fill:#ef4444
```

---

## Component Interaction Summary

| Component | Role | Key Actions |
|-----------|------|-------------|
| **Next.js Frontend** | User interface | Shows modal, opens popup, handles retry |
| **FastAPI Backend** | Orchestrator | Routes requests, manages OAuth-STS flow |
| **Okta STS** | Token broker | Exchanges ID token for GitHub token |
| **GitHub API** | Resource provider | Returns repos/PRs/issues data |

---

## OAuth-STS Request/Response

### Request Format
```http
POST /oauth2/v1/token HTTP/1.1
Host: rkumariagoie.oktapreview.com
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:token-exchange
requested_token_type=urn:okta:params:oauth:token-type:oauth-sts
subject_token=eyJhbGci...  (User's ID token)
subject_token_type=urn:ietf:params:oauth:token-type:id_token
client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
client_assertion=eyJhbGci...  (Signed JWT with agent's private key)
resource=rajeshkumar-okta:github:application
```

### Response: Success (200)
```json
{
  "access_token": "gho_xxxxxxxxxxxx",
  "token_type": "Bearer",
  "expires_in": 28800
}
```

### Response: Interaction Required (400)
```json
{
  "error": "interaction_required",
  "error_description": "User authorization is required",
  "interaction_uri": "https://rkumariagoie.oktapreview.com/oauth2/v1/sts/redirect?dataHandle=xxx"
}
```

---

## Timing Information

| Operation | Typical Duration |
|-----------|------------------|
| User Login (OIDC) | 2-5 seconds |
| OAuth-STS Token Exchange | 500-1000ms |
| GitHub API Call | 200-500ms |
| Authorization Popup (first time) | 10-30 seconds (user dependent) |
| Total First Request | ~15-35 seconds |
| Total Subsequent Requests | ~2-3 seconds |

---

## State Machine

```
┌──────────────┐
│  Unauthenticated  │
└────────┬─────────┘
         │ Login
         ▼
┌──────────────┐
│ Authenticated │
│ (Has ID Token)│
└────────┬─────────┘
         │ Request GitHub operation
         ▼
┌──────────────────┐
│ OAuth-STS Exchange│
└────────┬─────────┘
         │
    ┌────┴─────┐
    │          │
    ▼          ▼
┌────────┐  ┌──────────────┐
│ Success│  │interaction_  │
│200 OK  │  │required 400  │
└───┬────┘  └──────┬───────┘
    │              │
    │              ▼
    │       ┌─────────────┐
    │       │Show Modal   │
    │       │User         │
    │       │Authorizes   │
    │       └──────┬──────┘
    │              │ Retry
    │              ▼
    └──────────────┤
                   ▼
            ┌─────────────┐
            │GitHub API   │
            │Call         │
            └──────┬──────┘
                   │
              ┌────┴────┐
              │         │
              ▼         ▼
         ┌─────┐   ┌──────┐
         │200  │   │ 401  │
         │OK   │   │Token │
         └──┬──┘   │Revoked
            │      └───┬──┘
            ▼          ▼
      ┌────────┐  ┌─────────┐
      │Display │  │Show     │
      │Results │  │Error    │
      └────────┘  └─────────┘
```

---

**Diagram saved in:** `docs/SEQUENCE_DIAGRAM.md`

You can view it on GitHub (renders Mermaid automatically) or use tools like:
- https://mermaid.live/
- VS Code with Mermaid extension
- GitHub markdown preview

🎉 **Congratulations! Your DevOps Agent with OAuth-STS is now fully working and deployed!** 🚀
