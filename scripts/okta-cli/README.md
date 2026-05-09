# okta-cli

Standalone Node script that runs the Okta Brokered Consent (OAuth-STS) flow end-to-end and lists the authenticated user's GitHub repos — no frontend or backend required.

It mirrors the sequence in [backend/auth/okta_sts.py](../../backend/auth/okta_sts.py), [backend/auth/jwt_builder.py](../../backend/auth/jwt_builder.py), and [backend/github/client.py](../../backend/github/client.py), so it's useful for debugging the Okta side of the flow in isolation.

## Flow

1. Authorization Code + PKCE login against the Okta OIDC "linked application" → user `id_token`.
2. Build a signed client assertion JWT (RS256) for the AI Agent.
3. OAuth-STS token exchange at `{OKTA_DOMAIN}/oauth2/v1/token`.
4. If Okta returns `interaction_required`, open the `interaction_uri` in the browser, wait for consent, retry.
5. Call `GET https://api.github.com/user/repos` with the resulting GitHub token.

## Setup

```
cp .env.example .env
# fill in the values — reuse OKTA_AI_AGENT_ID / OKTA_AI_AGENT_PRIVATE_KEY /
# OKTA_GITHUB_RESOURCE_INDICATOR from backend/.env
npm install
```

Make sure `OKTA_OIDC_REDIRECT_URI` (default `http://localhost:8765/callback`) is registered as a sign-in redirect URI on the Okta OIDC app.

## Run

```
node index.mjs
```

The script will open your browser for Okta login, then (first time only) again for GitHub consent. After that it prints the repo list.
