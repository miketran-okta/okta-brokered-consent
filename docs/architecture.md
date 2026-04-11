# Architecture - DevOps Agent

## Overview

The DevOps Agent demonstrates Okta Brokered Consent (OAuth-STS) for AI agents accessing external SaaS applications.

## OAuth-STS vs ID-JAG

| Feature | ID-JAG (ProGear) | OAuth-STS (DevOps Agent) |
|---------|------------------|--------------------------|
| **Purpose** | Access internal APIs | Access external SaaS |
| **Token Target** | Custom Auth Server | External service (GitHub) |
| **Exchange Steps** | ID Token → ID-JAG → Auth Server Token | ID Token → OAuth-STS → External Token |
| **Use Case** | Enterprise microservices | Third-party integrations |

## Token Exchange Flow

```
┌──────────────────┐
│   User Browser   │
│   (Next.js)      │
└────────┬─────────┘
         │ 1. User logs in via Okta OIDC
         │    Receives ID Token
         ▼
┌──────────────────┐
│  FastAPI Backend │
│   (LangGraph)    │
└────────┬─────────┘
         │ 2. Backend receives ID Token
         │    in Authorization header
         ▼
┌──────────────────┐
│    Okta STS      │
│ /oauth2/v1/token │
└────────┬─────────┘
         │ 3. OAuth-STS Token Exchange:
         │    - grant_type: token-exchange
         │    - subject_token: user's ID token
         │    - client_assertion: signed JWT
         │    - resource: GitHub indicator
         ▼
┌──────────────────┐
│   GitHub API     │
│ api.github.com   │
└──────────────────┘
         4. Use exchanged token to call GitHub
```

## OAuth-STS Request Parameters

| Parameter | Value |
|-----------|-------|
| `grant_type` | `urn:ietf:params:oauth:grant-type:token-exchange` |
| `requested_token_type` | `urn:okta:params:oauth:token-type:oauth-sts` |
| `subject_token` | User's Okta ID token |
| `subject_token_type` | `urn:ietf:params:oauth:token-type:id_token` |
| `client_assertion_type` | `urn:ietf:params:oauth:client-assertion-type:jwt-bearer` |
| `client_assertion` | Signed JWT (RS256) with agent credentials |
| `resource` | Resource indicator from Managed Connection |

## Client Assertion JWT Structure

```json
{
  "header": {
    "kid": "<key-id-from-jwk>",
    "alg": "RS256"
  },
  "payload": {
    "iss": "<agent-id>",
    "sub": "<agent-id>",
    "aud": "https://<okta-domain>/oauth2/v1/token",
    "iat": <issued-at-timestamp>,
    "exp": <expiry-timestamp>,
    "jti": "<unique-id>"
  }
}
```

## LangGraph Workflow

```
┌─────────┐    ┌──────────────┐    ┌────────────────┐    ┌───────────────────┐
│ Router  │───▶│ STS Exchange │───▶│ Execute GitHub │───▶│ Generate Response │
└─────────┘    └──────────────┘    └────────────────┘    └───────────────────┘
     │                                                              │
     │ (if help intent)                                            │
     └─────────────────────────────────────────────────────────────┘
```

### Workflow Nodes

1. **Router** - Uses Claude to parse user intent and extract parameters
2. **STS Exchange** - Calls Okta OAuth-STS to get GitHub token
3. **Execute GitHub** - Performs the requested GitHub operation
4. **Generate Response** - Synthesizes natural language response

## Security Considerations

- User tokens are never stored, only passed through
- OAuth-STS ensures user consent is verified by Okta
- All GitHub operations are performed with user's permissions
- Actions are logged and auditable through Okta
