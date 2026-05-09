#!/usr/bin/env node
/**
 * Okta Brokered Consent CLI — lists GitHub repos end-to-end.
 *
 * Narrated security-flow demo for prospects: shows the four parties
 * (USER, AI AGENT, OKTA, GITHUB) and the trust decisions between them.
 *
 * Mirrors backend/auth/okta_sts.py, backend/auth/jwt_builder.py, and
 * backend/github/client.py but in one standalone Node script.
 */

import http from "node:http";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { URL, URLSearchParams } from "node:url";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import "dotenv/config";
import open from "open";
import { SignJWT, importJWK } from "jose";

// ---------- OAuth-STS constants (match backend/auth/okta_sts.py) ----------
const GRANT_TYPE_TOKEN_EXCHANGE = "urn:ietf:params:oauth:grant-type:token-exchange";
const REQUESTED_TOKEN_TYPE_STS = "urn:okta:params:oauth:token-type:oauth-sts";
const SUBJECT_TOKEN_TYPE_ID = "urn:ietf:params:oauth:token-type:id_token";
const CLIENT_ASSERTION_TYPE_JWT = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";

// ---------- config ----------
function requiredEnv(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v.trim();
}

function normalizeUrl(u) {
  const trimmed = u.trim();
  const withScheme = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  return withScheme.replace(/\/+$/, "");
}

const config = {
  oktaDomain: normalizeUrl(requiredEnv("OKTA_DOMAIN")),
  oidcClientId: requiredEnv("OKTA_OIDC_CLIENT_ID"),
  // Optional: if the OIDC app is a confidential client, set this to its secret.
  // Public/PKCE-only apps can leave this unset.
  oidcClientSecret: (process.env.OKTA_OIDC_CLIENT_SECRET || "").trim(),
  oidcRedirectUri: requiredEnv("OKTA_OIDC_REDIRECT_URI"),
  oidcScopes: (process.env.OKTA_OIDC_SCOPES || "openid profile email").trim(),
  agentId: requiredEnv("OKTA_AI_AGENT_ID"),
  agentPrivateKeyJson: requiredEnv("OKTA_AI_AGENT_PRIVATE_KEY"),
  githubResourceIndicator: requiredEnv("OKTA_GITHUB_RESOURCE_INDICATOR"),
};
// All OAuth endpoints live under /oauth2/v1/* on the org authorization server.
config.authorizeEndpoint = `${config.oktaDomain}/oauth2/v1/authorize`;
config.oidcTokenEndpoint = `${config.oktaDomain}/oauth2/v1/token`;
config.tokenEndpoint = `${config.oktaDomain}/oauth2/v1/token`;

// ---------- display helpers ----------
const USE_COLOR = Boolean(process.stdout.isTTY);
const ANSI = USE_COLOR
  ? {
      reset: "\x1b[0m",
      bold: "\x1b[1m",
      dim: "\x1b[2m",
      cyan: "\x1b[36m",
      magenta: "\x1b[35m",
      blue: "\x1b[34m",
      green: "\x1b[32m",
      yellow: "\x1b[33m",
      red: "\x1b[31m",
      gray: "\x1b[90m",
    }
  : new Proxy({}, { get: () => "" });

const RULE_LEN = 70;
const THIN_RULE = "─".repeat(RULE_LEN);
const HEAVY_RULE = "━".repeat(RULE_LEN);

const ACTOR_STYLE = {
  USER:     { color: ANSI.cyan,    label: "USER" },
  AGENT:    { color: ANSI.magenta, label: "AI AGENT" },
  OKTA:     { color: ANSI.blue,    label: "OKTA" },
  GITHUB:   { color: ANSI.green,   label: "GITHUB" },
};

function tag(actor) {
  const s = ACTOR_STYLE[actor];
  return `${s.color}${ANSI.bold}[${s.label}]${ANSI.reset}`;
}

function thinRule() { console.log(`${ANSI.gray}${THIN_RULE}${ANSI.reset}`); }
function heavyRule() { console.log(`${ANSI.dim}${HEAVY_RULE}${ANSI.reset}`); }

function section(number, from, to, title) {
  console.log("");
  heavyRule();
  const arrow = to
    ? `${tag(from)} ${ANSI.dim}→${ANSI.reset} ${tag(to)}`
    : tag(from);
  console.log(`${ANSI.bold}STEP ${number}${ANSI.reset}  ${arrow}  ${ANSI.bold}${title}${ANSI.reset}`);
  heavyRule();
}

function why(lines) {
  for (const line of lines) {
    console.log(`${ANSI.gray}  ${line}${ANSI.reset}`);
  }
}

function actorLine(actor, msg) {
  console.log(`  ${tag(actor)}  ${msg}`);
}

function meta(msg) {
  console.log(`  ${ANSI.gray}${msg}${ANSI.reset}`);
}

function httpLine(method, url) {
  console.log(
    `  ${ANSI.yellow}${ANSI.bold}[HTTP]${ANSI.reset} ${ANSI.bold}${method}${ANSI.reset} ${url}`,
  );
}

function preview(token, n = 60) {
  if (!token) return "";
  return token.length > n ? `${token.slice(0, n)}…` : token;
}

// ---------- PKCE ----------
function base64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function generatePKCE() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

// ---------- Step 1: user login (Authorization Code + PKCE) ----------
function startCallbackServer(redirectUri, expectedState) {
  const url = new URL(redirectUri);
  const port = Number(url.port) || 8765;
  const path = url.pathname || "/callback";

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url, `http://localhost:${port}`);
      if (reqUrl.pathname !== path) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const code = reqUrl.searchParams.get("code");
      const state = reqUrl.searchParams.get("state");
      const error = reqUrl.searchParams.get("error");

      res.writeHead(200, { "Content-Type": "text/html" });
      if (error) {
        res.end(`<h1>Login error</h1><p>${error}: ${reqUrl.searchParams.get("error_description") || ""}</p>`);
        server.close();
        reject(new Error(`Okta returned error: ${error}`));
        return;
      }
      if (state !== expectedState) {
        res.end("<h1>State mismatch</h1><p>You can close this tab.</p>");
        server.close();
        reject(new Error("OAuth state mismatch"));
        return;
      }
      res.end(
        "<h1>Login complete</h1><p>You can close this tab and return to the terminal.</p>",
      );
      server.close();
      resolve(code);
    });
    server.on("error", reject);
    server.listen(port, "localhost");
  });
}

async function getIdToken() {
  section(1, "USER", "OKTA", "Authenticate the end user");
  why([
    "The AI Agent can only act on a user's behalf if Okta has just verified",
    "that user. We use OAuth 2.0 Authorization Code + PKCE — the AI Agent",
    "never touches the user's password.",
  ]);
  console.log("");

  const { verifier, challenge } = generatePKCE();
  const state = base64url(randomBytes(16));

  const authorizeUrl = new URL(config.authorizeEndpoint);
  authorizeUrl.searchParams.set("client_id", config.oidcClientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", config.oidcScopes);
  authorizeUrl.searchParams.set("redirect_uri", config.oidcRedirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  actorLine("USER", "Browser opens Okta login page…");
  httpLine("GET", authorizeUrl.toString());

  const codePromise = startCallbackServer(config.oidcRedirectUri, state);
  await open(authorizeUrl.toString());
  const code = await codePromise;

  actorLine("OKTA", `Authenticated user → redirects back with an authorization code (${preview(code, 16)})`);
  meta(`Callback: ${config.oidcRedirectUri}?code=…&state=…`);

  actorLine("AGENT", "Exchanges the authorization code + PKCE verifier for tokens…");
  httpLine("POST", config.oidcTokenEndpoint);
  meta("body: grant_type=authorization_code, code, redirect_uri, code_verifier");

  const tokenHeaders = { "Content-Type": "application/x-www-form-urlencoded" };
  const tokenBodyParams = {
    grant_type: "authorization_code",
    code,
    redirect_uri: config.oidcRedirectUri,
    code_verifier: verifier,
  };
  if (config.oidcClientSecret) {
    const basic = Buffer.from(
      `${config.oidcClientId}:${config.oidcClientSecret}`,
    ).toString("base64");
    tokenHeaders.Authorization = `Basic ${basic}`;
  } else {
    tokenBodyParams.client_id = config.oidcClientId;
  }
  const tokenRes = await fetch(config.oidcTokenEndpoint, {
    method: "POST",
    headers: tokenHeaders,
    body: new URLSearchParams(tokenBodyParams).toString(),
  });
  const tokenBody = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok) {
    throw new Error(
      `OIDC token endpoint returned ${tokenRes.status}: ${JSON.stringify(tokenBody)}`,
    );
  }
  if (!tokenBody.id_token) {
    throw new Error(`OIDC token response did not include id_token: ${JSON.stringify(tokenBody)}`);
  }
  actorLine("OKTA", `Issued short-lived OIDC ID token (scopes: ${config.oidcScopes})`);
  meta(`id_token: ${preview(tokenBody.id_token)}`);
  actorLine("USER", "Now has a signed, verifiable statement of identity from Okta.");
  return tokenBody.id_token;
}

// ---------- Step 2: client assertion JWT ----------
async function buildClientAssertion({ announce = true } = {}) {
  if (announce) {
    section(2, "AGENT", "OKTA", "Prove the AI Agent's own identity");
    why([
      "Okta needs to know WHICH AI Agent is asking, not just which user.",
      "The agent signs a short-lived JWT (\"client assertion\") with its own",
      "private key. Okta validates it against the agent's registered public",
      "key. No shared secret on disk, no password.",
    ]);
    console.log("");
  }

  let jwk;
  try {
    jwk = JSON.parse(config.agentPrivateKeyJson);
  } catch (e) {
    throw new Error(`OKTA_AI_AGENT_PRIVATE_KEY is not valid JSON: ${e.message}`);
  }
  if (!jwk.d) {
    throw new Error("OKTA_AI_AGENT_PRIVATE_KEY is missing 'd' (private exponent) — must be a private JWK");
  }
  if (!jwk.kid) {
    throw new Error("OKTA_AI_AGENT_PRIVATE_KEY must include a 'kid'");
  }

  const key = await importJWK(jwk, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .setIssuer(config.agentId)
    .setSubject(config.agentId)
    .setAudience(config.tokenEndpoint)
    .setIssuedAt(now)
    .setExpirationTime(now + 60)
    .setJti(randomUUID())
    .sign(key);

  if (announce) {
    actorLine("AGENT", `Identity:  ${config.agentId}  ${ANSI.gray}(registered as AI Agent in Okta)${ANSI.reset}`);
    actorLine("AGENT", `Key:       kid=${preview(jwk.kid, 24)}  ${ANSI.gray}(RS256, 60-second expiry)${ANSI.reset}`);
    meta(`assertion: ${preview(jwt)}`);
  }
  return jwt;
}

// ---------- Step 3 + 3a: STS token exchange (with interaction_required retry) ----------
async function postStsExchange(idToken, clientAssertion) {
  const body = new URLSearchParams({
    grant_type: GRANT_TYPE_TOKEN_EXCHANGE,
    requested_token_type: REQUESTED_TOKEN_TYPE_STS,
    subject_token: idToken,
    subject_token_type: SUBJECT_TOKEN_TYPE_ID,
    client_assertion_type: CLIENT_ASSERTION_TYPE_JWT,
    client_assertion: clientAssertion,
    resource: config.githubResourceIndicator,
  });

  const res = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    // keep text for error reporting
  }
  return { status: res.status, body: json, rawText: text };
}

async function waitForEnter(promptMsg) {
  const rl = readline.createInterface({ input, output });
  await rl.question(promptMsg);
  rl.close();
}

function announceStsResult(response) {
  const scopesStr =
    typeof response.scope === "string"
      ? response.scope
      : Array.isArray(response.scopes)
        ? response.scopes.join(" ")
        : "";
  const token = response.access_token || "";
  const isOpaque =
    token.startsWith("gho_") || token.startsWith("ghu_") || token.startsWith("ghp_");

  actorLine("OKTA", `${ANSI.green}✓${ANSI.reset} Policy allowed + user consent on file — issuing access token`);
  if (scopesStr) {
    actorLine("OKTA", `Scopes granted: ${ANSI.bold}${scopesStr}${ANSI.reset}`);
  } else if (isOpaque) {
    meta("(Scopes are enforced downstream: this is an opaque GitHub token, governed by the Managed Connection.)");
  }
  if (response.expires_in) {
    meta(`Token expires in ${response.expires_in}s — no refresh token, short-lived by design.`);
  }
  meta(`access_token: ${preview(token)}`);
  actorLine(
    "AGENT",
    "Holds a token scoped to ONE resource, for ONE user, for a short window.",
  );
  meta("If the user revokes consent in Okta, this token stops working.");
}

async function stsTokenExchange(idToken) {
  const clientAssertion = await buildClientAssertion({ announce: true });

  section(3, "AGENT", "OKTA", "Request GitHub access, on the user's behalf");
  why([
    "Instead of asking GitHub directly, the AI Agent asks Okta to BROKER",
    "a token. Okta enforces, centrally:",
    "  • Is this AI Agent allowed to use this Managed Connection?",
    "  • Has this user consented to the agent acting on their behalf?",
    "  • Which scopes is the agent entitled to?",
  ]);
  console.log("");
  meta(`Flow:      OAuth 2.0 Token Exchange (RFC 8693)`);
  meta(`Subject:   the user's ID token   ${ANSI.gray}(proves WHO the agent acts for)${ANSI.reset}`);
  meta(`Actor:     the agent's client assertion   ${ANSI.gray}(proves WHO is acting)${ANSI.reset}`);
  meta(`Resource:  ${config.githubResourceIndicator}`);
  meta(`           ${ANSI.gray}(Okta Managed Connection → GitHub)${ANSI.reset}`);
  console.log("");
  httpLine("POST", config.tokenEndpoint);
  meta("body: grant_type=urn:ietf:params:oauth:grant-type:token-exchange,");
  meta("      requested_token_type=urn:okta:params:oauth:token-type:oauth-sts,");
  meta("      subject_token=<user id_token>, subject_token_type=id_token,");
  meta("      client_assertion=<agent JWT>, resource=<GitHub resource indicator>");

  let attempt = await postStsExchange(idToken, clientAssertion);

  if (attempt.status === 200 && attempt.body.access_token) {
    announceStsResult(attempt.body);
    return attempt.body;
  }

  const errorCode = attempt.body.error || "unknown_error";
  const errorDesc = attempt.body.error_description || attempt.rawText;
  if (errorCode !== "interaction_required") {
    throw new Error(`STS exchange failed: ${errorCode}: ${errorDesc}`);
  }

  // interaction_required — open consent URI, wait, retry.
  actorLine(
    "OKTA",
    `${ANSI.yellow}↪ interaction_required${ANSI.reset} — the user has not yet consented`,
  );
  meta("Okta will not mint a token until the user explicitly approves.");

  let interactionUri = attempt.body.interaction_uri;
  if (!interactionUri && attempt.body.dataHandle) {
    interactionUri = `${config.oktaDomain}/oauth2/v1/sts/redirect?dataHandle=${attempt.body.dataHandle}`;
  }
  if (!interactionUri) {
    throw new Error(
      `interaction_required but no interaction_uri or dataHandle: ${JSON.stringify(attempt.body)}`,
    );
  }

  section("3a", "USER", "OKTA", "Grant consent (one time)");
  why([
    "Consent is RECORDED CENTRALLY in Okta, not scattered across every SaaS",
    "app. IT can audit, scope, or revoke it later from a single pane of glass.",
  ]);
  console.log("");
  actorLine("USER", "Opening Okta consent page in browser…");
  httpLine("GET", interactionUri);
  await open(interactionUri);
  actorLine("USER", "Reviewing: \"Allow this AI Agent to access your GitHub?\"");
  await waitForEnter(`\n  ${ANSI.bold}After approving in the browser, press Enter to continue…${ANSI.reset} `);

  section("3 (retry)", "AGENT", "OKTA", "Re-request access, now that consent is on file");
  httpLine("POST", config.tokenEndpoint);
  meta("body: same token-exchange payload as before");
  const freshAssertion = await buildClientAssertion({ announce: false });
  attempt = await postStsExchange(idToken, freshAssertion);
  if (attempt.status === 200 && attempt.body.access_token) {
    announceStsResult(attempt.body);
    return attempt.body;
  }
  throw new Error(
    `STS retry failed: ${attempt.body.error || attempt.status}: ${attempt.body.error_description || attempt.rawText}`,
  );
}

// ---------- Step 4: GitHub repos ----------
async function listGithubRepos(accessToken) {
  section(4, "AGENT", "GITHUB", "Use the brokered token");
  why([
    "GitHub sees a normal Bearer token. It doesn't know (or need to know)",
    "that Okta brokered it. If the user later revokes consent in Okta,",
    "this token stops working — no GitHub-side cleanup needed.",
  ]);
  console.log("");

  const url = new URL(`${GITHUB_API_BASE}/user/repos`);
  url.searchParams.set("per_page", "30");
  url.searchParams.set("sort", "updated");

  httpLine("GET", url.toString());
  meta(`Authorization: Bearer ${preview(accessToken, 24)}`);
  meta(`Accept: application/vnd.github+json`);
  meta(`X-GitHub-Api-Version: ${GITHUB_API_VERSION}`);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`GitHub /user/repos failed: ${res.status}: ${body.message || JSON.stringify(body)}`);
  }
  actorLine("GITHUB", `${res.status} OK — returned ${body.length} repositories.`);
  return body;
}

// ---------- header / footer ----------
function printHeader() {
  thinRule();
  console.log(` ${ANSI.bold}Okta Brokered Consent — live security flow demo${ANSI.reset}`);
  thinRule();
  console.log("");
  console.log(" Parties in this flow:");
  console.log(`   ${tag("USER")}      The end user — authorizes access to their own data`);
  console.log(`   ${tag("AGENT")}  This CLI, registered with Okta as AI Agent ${ANSI.bold}${config.agentId}${ANSI.reset}`);
  console.log(`   ${tag("OKTA")}      Identity provider + consent broker (${new URL(config.oktaDomain).host})`);
  console.log(`   ${tag("GITHUB")}    Downstream resource being accessed (GitHub REST API)`);
  console.log("");
  console.log(` ${ANSI.gray}What makes this "brokered": the AI Agent never sees the user's${ANSI.reset}`);
  console.log(` ${ANSI.gray}credentials, and never directly asks GitHub for access. Okta${ANSI.reset}`);
  console.log(` ${ANSI.gray}mediates every trust decision and records the audit trail.${ANSI.reset}`);
  thinRule();
}

function printFooter(repoCount) {
  console.log("");
  thinRule();
  console.log(` ${ANSI.bold}What just happened — why it matters${ANSI.reset}`);
  thinRule();
  console.log(`   1. ${tag("USER")}   authenticated ONCE to Okta (PKCE, no password to the agent).`);
  console.log(`   2. ${tag("AGENT")}  proved its own identity with a signed JWT — no shared secrets.`);
  console.log(`   3. ${tag("OKTA")}   brokered a GitHub token, enforcing policy + consent centrally.`);
  console.log(`   4. ${tag("AGENT")}  called ${tag("GITHUB")} with a short-lived, scoped, revocable token.`);
  console.log("");
  console.log(` ${ANSI.gray}The AI Agent never saw: the user's password, the user's GitHub login,${ANSI.reset}`);
  console.log(` ${ANSI.gray}or any long-lived credential. All trust decisions are auditable in${ANSI.reset}`);
  console.log(` ${ANSI.gray}Okta's system log.${ANSI.reset}`);
  thinRule();
  console.log(` ${ANSI.bold}${repoCount}${ANSI.reset} repositories retrieved on the user's behalf.`);
}

function printRepos(repos) {
  if (repos.length === 0) return;
  console.log("");
  for (const r of repos) {
    const visibility = r.private ? `${ANSI.yellow}private${ANSI.reset}` : `${ANSI.gray}public${ANSI.reset} `;
    console.log(`   • ${visibility}  ${ANSI.bold}${r.full_name}${ANSI.reset}  ${ANSI.gray}${r.html_url}${ANSI.reset}`);
  }
}

// ---------- main ----------
async function main() {
  printHeader();

  const idToken = await getIdToken();
  const stsResponse = await stsTokenExchange(idToken);

  const repos = await listGithubRepos(stsResponse.access_token);
  printRepos(repos);
  printFooter(repos.length);
}

main().catch((err) => {
  console.error(`\n${ANSI.red}${ANSI.bold}Error:${ANSI.reset} ${err.message}`);
  process.exit(1);
});
