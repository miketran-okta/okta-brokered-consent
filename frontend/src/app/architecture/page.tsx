'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Key, Lock, Shield, Activity, GitBranch, ChevronDown, ChevronRight, User, FileText, Server, ArrowRight, RefreshCw, Ticket } from 'lucide-react';
import CollapsibleSection from '@/components/CollapsibleSection';

const ACTIVE_SERVICE_STORAGE_KEY = 'devops-active-service';

interface JWTDisplayProps {
  title: string;
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  description: string;
  color: string;
}

function JWTDisplay({ title, header, payload, description, color }: JWTDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`rounded-lg border-2 ${color} overflow-hidden`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-white/50 hover:bg-white/80 transition"
      >
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-gray-600" />
          <span className="font-semibold text-gray-800 text-sm">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{description}</span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="p-4 bg-gray-900 animate-fadeIn">
          <div className="space-y-3">
            {/* Header */}
            <div>
              <div className="text-xs font-semibold text-cyan-400 uppercase mb-1">Header</div>
              <pre className="text-xs text-green-400 font-mono overflow-x-auto">
{JSON.stringify(header, null, 2)}
              </pre>
            </div>
            {/* Payload */}
            <div>
              <div className="text-xs font-semibold text-cyan-400 uppercase mb-1">Payload</div>
              <pre className="text-xs text-yellow-400 font-mono overflow-x-auto">
{JSON.stringify(payload, null, 2)}
              </pre>
            </div>
            {/* Signature */}
            <div>
              <div className="text-xs font-semibold text-cyan-400 uppercase mb-1">Signature</div>
              <div className="text-xs text-gray-500 font-mono">
                [RS256 signature - verified by recipient]
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inner component that uses useSearchParams (must be wrapped in Suspense)
function ArchitectureContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [activeService, setActiveService] = useState<'github' | 'jira'>('github');
  const now = Math.floor(Date.now() / 1000);

  // Load active service from URL query param (priority) or sessionStorage (fallback)
  useEffect(() => {
    try {
      // First, check URL query parameter (highest priority)
      const serviceParam = searchParams.get('service');
      if (serviceParam === 'github' || serviceParam === 'jira') {
        setActiveService(serviceParam);
        sessionStorage.setItem(ACTIVE_SERVICE_STORAGE_KEY, serviceParam);
        return;
      }

      // Fallback to sessionStorage
      const savedActiveService = sessionStorage.getItem(ACTIVE_SERVICE_STORAGE_KEY);
      if (savedActiveService === 'github' || savedActiveService === 'jira') {
        setActiveService(savedActiveService);
      }
    } catch (e) {
      console.error('Error loading active service:', e);
    }
  }, [searchParams]);

  // Save active service when changed on this page
  useEffect(() => {
    sessionStorage.setItem(ACTIVE_SERVICE_STORAGE_KEY, activeService);
  }, [activeService]);

  const userSub = (session?.user as any)?.sub || '00u...';
  const userName = session?.user?.name || 'Developer';
  const userEmail = session?.user?.email || 'user@example.com';

  // Common ID Token (same for both services)
  const idTokenHeader = { alg: "RS256", kid: "okta-signing-key-id" };
  const idTokenPayload = {
    iss: "https://oktaforai.oktapreview.com",
    sub: userSub,
    aud: "0oa...",
    iat: now,
    exp: now + 3600,
    auth_time: now - 60,
    email: userEmail,
    name: userName,
    groups: ["Everyone", "Developers"]
  };

  // Client Assertion (same structure, different audience)
  const clientAssertionHeader = { alg: "RS256", kid: "agent-private-key-id" };
  const clientAssertionPayload = {
    iss: "wlp...",
    sub: "wlp...",
    aud: "https://oktaforai.oktapreview.com/oauth2/v1/token",
    iat: now,
    exp: now + 60,
    jti: "unique-request-id-" + now
  };

  // GitHub Access Token
  const githubTokenHeader = { alg: "RS256", typ: "JWT" };
  const githubTokenPayload = {
    iss: "https://token.actions.githubusercontent.com",
    sub: "repo:org/repo:ref:refs/heads/main",
    aud: "api://github",
    iat: now,
    exp: now + 28800,
    scp: ["repo", "read:user", "read:org"],
    installation_id: 12345678,
    repository_visibility: "private"
  };

  // Jira Access Token
  const jiraTokenHeader = { alg: "RS256", typ: "at+jwt" };
  const jiraTokenPayload = {
    iss: "https://auth.atlassian.com",
    sub: "atlassian-account-id",
    aud: "api.atlassian.com",
    iat: now,
    exp: now + 3600,
    scope: "read:jira-work write:jira-work read:jira-user",
    client_id: "atlassian-oauth-client",
    azp: "okta-sts-integration"
  };

  // STS Request Payloads
  const githubStsRequestPayload = {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    requested_token_type: "urn:okta:params:oauth:token-type:oauth-sts",
    subject_token: "eyJhbGciOiJSUzI1NiIsImtpZCI6Im9rdGEtc2lnbmluZy1rZXktaWQifQ...",
    subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: "eyJhbGciOiJSUzI1NiIsImtpZCI6ImFnZW50LXByaXZhdGUta2V5LWlkIn0...",
    resource: "orn:oktapreview:idp:00o...:client-auth-settings:rs"
  };

  const jiraStsRequestPayload = {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    requested_token_type: "urn:okta:params:oauth:token-type:oauth-sts",
    subject_token: "eyJhbGciOiJSUzI1NiIsImtpZCI6Im9rdGEtc2lnbmluZy1rZXktaWQifQ...",
    subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: "eyJhbGciOiJSUzI1NiIsImtpZCI6ImFnZW50LXByaXZhdGUta2V5LWlkIn0...",
    resource: "orn:oktapreview:idp:00o...:jira:client-auth-settings:rs",
    scope: "read:jira-work write:jira-work read:jira-user"
  };

  // Service-specific configurations
  const serviceConfig = {
    github: {
      name: 'GitHub',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      ),
      color: 'from-gray-700 to-gray-900',
      borderColor: 'border-gray-600',
      bgColor: 'bg-gray-800',
      lightBg: 'bg-gray-50',
      tokenHeader: githubTokenHeader,
      tokenPayload: githubTokenPayload,
      stsPayload: githubStsRequestPayload,
      tokenName: 'GitHub Access Token',
      tokenType: 'GitHub App Token (opaque or JWT)',
      apiEndpoint: 'https://api.github.com',
      scopes: ['repo', 'read:user', 'read:org'],
      operations: [
        { name: 'Repositories', endpoint: 'GET /user/repos', icon: '📁' },
        { name: 'Pull Requests', endpoint: 'GET /repos/{owner}/{repo}/pulls', icon: '🔀' },
        { name: 'Issues', endpoint: 'GET /repos/{owner}/{repo}/issues', icon: '🐛' },
        { name: 'Comments', endpoint: 'POST /repos/.../issues/{n}/comments', icon: '💬' },
      ]
    },
    jira: {
      name: 'Jira',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z"/>
        </svg>
      ),
      color: 'from-blue-500 to-blue-700',
      borderColor: 'border-blue-400',
      bgColor: 'bg-blue-600',
      lightBg: 'bg-blue-50',
      tokenHeader: jiraTokenHeader,
      tokenPayload: jiraTokenPayload,
      stsPayload: jiraStsRequestPayload,
      tokenName: 'Jira Access Token',
      tokenType: 'Atlassian JWT Token',
      apiEndpoint: 'https://api.atlassian.com',
      scopes: ['read:jira-work', 'write:jira-work', 'read:jira-user'],
      operations: [
        { name: 'Projects', endpoint: 'GET /rest/api/3/project', icon: '📋' },
        { name: 'Issues', endpoint: 'GET /rest/api/3/search', icon: '🎫' },
        { name: 'Create Issue', endpoint: 'POST /rest/api/3/issue', icon: '➕' },
        { name: 'Transitions', endpoint: 'POST /rest/api/3/issue/{key}/transitions', icon: '▶️' },
      ]
    }
  };

  const config = serviceConfig[activeService];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-md border-b border-white/10">
        <div className="px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white bg-gradient-to-br ${config.color}`}>
              {config.icon}
            </div>
            <div>
              <h1 className="text-white text-2xl font-bold">DevOps Agent</h1>
              <p className="text-gray-400 text-sm">Architecture & Security Overview</p>
            </div>
          </div>

          {/* Service Toggle */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-black/30 rounded-lg p-1">
              <button
                onClick={() => setActiveService('github')}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                  activeService === 'github'
                    ? 'bg-gray-800 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub
              </button>
              <button
                onClick={() => setActiveService('jira')}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                  activeService === 'jira'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z"/>
                </svg>
                Jira
              </button>
            </div>

            <Link
              href="/"
              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg transition font-semibold shadow-lg hover:scale-[1.02] transform"
            >
              Back to Chat
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto py-8 px-6 space-y-6">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full mb-4 ${
            activeService === 'jira' ? 'bg-blue-500/20 text-blue-300' : 'bg-gray-700/50 text-gray-300'
          }`}>
            {config.icon}
            <span className="font-semibold">{config.name} Integration</span>
          </div>
          <h2 className="text-4xl font-bold text-white mb-2">OAuth-STS Architecture</h2>
          <p className="text-gray-300 text-lg">Okta Brokered Consent for AI Agents accessing {config.name}</p>
        </div>

        {/* Section 1: OAuth-STS Token Exchange Flow with Detailed JWTs */}
        <CollapsibleSection
          title={`OAuth-STS Token Exchange Flow - ${config.name}`}
          subtitle="Complete authentication and authorization flow with decoded tokens"
          icon={<Key className="w-5 h-5" />}
          defaultOpen={true}
        >
          <div className="mt-4 space-y-4">
            <p className="text-gray-700">
              The DevOps Agent uses <strong>Okta Brokered Consent (OAuth-STS)</strong> to securely access {config.name} on behalf of users.
              Click on any token below to see its decoded JWT structure.
            </p>

            {/* Scopes Required */}
            <div className={`p-3 rounded-lg ${config.lightBg} border ${config.borderColor}`}>
              <div className="text-sm font-semibold text-gray-700 mb-2">Required Scopes for {config.name}:</div>
              <div className="flex flex-wrap gap-2">
                {config.scopes.map((scope, idx) => (
                  <span key={idx} className={`px-3 py-1 rounded-full text-xs font-mono ${
                    activeService === 'jira' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {scope}
                  </span>
                ))}
              </div>
            </div>

            {/* Flow Steps with JWT Details */}
            <div className="space-y-4">
              {/* Step 1: User Authentication */}
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                    1
                  </div>
                  <div className="flex-1">
                    <div className="bg-purple-50 rounded-lg p-3 mb-2">
                      <div className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        User Authentication
                      </div>
                      <div className="text-sm text-gray-600">User logs in via Okta OIDC and receives an ID token from the linked application</div>
                    </div>
                    <JWTDisplay
                      title="ID Token (from Okta OIDC)"
                      header={idTokenHeader}
                      payload={idTokenPayload}
                      description="User identity claims"
                      color="border-purple-300"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: OAuth-STS Token Exchange */}
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${config.color} text-white flex items-center justify-center text-sm font-bold flex-shrink-0`}>
                    2
                  </div>
                  <div className="flex-1">
                    <div className={`${config.lightBg} rounded-lg p-3 mb-2`}>
                      <div className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        OAuth-STS Token Exchange Request for {config.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        Backend makes POST request to Okta with user's ID token + signed client assertion JWT
                        {activeService === 'jira' && <span className="font-semibold"> + required scopes</span>}
                      </div>
                    </div>
                    <JWTDisplay
                      title="Client Assertion JWT (Agent Identity)"
                      header={clientAssertionHeader}
                      payload={clientAssertionPayload}
                      description="Agent proves identity"
                      color={activeService === 'jira' ? 'border-blue-300' : 'border-gray-300'}
                    />
                    <div className="mt-2 bg-gray-100 rounded-lg p-3">
                      <div className="text-xs font-semibold text-gray-600 uppercase mb-2">
                        STS Request Parameters {activeService === 'jira' && '(with scope)'}
                      </div>
                      <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded overflow-x-auto font-mono">
{JSON.stringify(config.stsPayload, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3a: Interaction Required */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  3a
                </div>
                <div className="flex-1 bg-amber-50 rounded-lg p-3">
                  <div className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    First Time: interaction_required
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    Okta returns 400 with interaction_uri → Modal appears → User authorizes at {config.name} → Popup closes
                  </div>
                  <div className="bg-white rounded p-2 text-xs font-mono text-gray-700">
                    <span className="text-red-500">HTTP 400</span>{" "}
                    {`{ "error": "interaction_required", "interaction_uri": "https://..." }`}
                  </div>
                </div>
              </div>

              {/* Step 3b: Access Token */}
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                    3b
                  </div>
                  <div className="flex-1">
                    <div className="bg-green-50 rounded-lg p-3 mb-2">
                      <div className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                        <Server className="w-4 h-4" />
                        Already Authorized: access_token
                      </div>
                      <div className="text-sm text-gray-600">
                        Okta returns 200 with {config.name} access token (cached, valid for ~{activeService === 'jira' ? '1 hour' : '8 hours'})
                      </div>
                    </div>
                    <JWTDisplay
                      title={config.tokenName}
                      header={config.tokenHeader}
                      payload={config.tokenPayload}
                      description={`${config.name} API access`}
                      color="border-green-300"
                    />
                  </div>
                </div>
              </div>

              {/* Step 4: Retry After Authorization */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  4
                </div>
                <div className="flex-1 bg-indigo-50 rounded-lg p-3">
                  <div className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                    <ArrowRight className="w-4 h-4" />
                    Retry After Authorization
                  </div>
                  <div className="text-sm text-gray-600">Same OAuth-STS POST → Okta returns {config.name} token → {config.name} API call succeeds</div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-indigo-600">
                    <span className="px-2 py-1 bg-indigo-100 rounded">ID Token</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="px-2 py-1 bg-indigo-100 rounded">Okta STS</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className={`px-2 py-1 rounded ${
                      activeService === 'jira' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {config.name} Token
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 5: API Calls */}
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${config.color} text-white flex items-center justify-center text-sm font-bold flex-shrink-0`}>
                  5
                </div>
                <div className={`flex-1 ${config.lightBg} rounded-lg p-3`}>
                  <div className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                    {activeService === 'jira' ? <Ticket className="w-4 h-4" /> : <GitBranch className="w-4 h-4" />}
                    {config.name} API Calls
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    Use exchanged token to {activeService === 'jira'
                      ? 'list projects, search issues, create tickets, transition workflows'
                      : 'list repos, PRs, issues, create comments'}
                  </div>
                  <div className="bg-white rounded p-2 text-xs font-mono text-gray-700">
                    <span className="text-blue-600">GET</span> {config.apiEndpoint}/...<br/>
                    <span className="text-gray-500">Authorization:</span> Bearer {activeService === 'jira' ? 'eyJhbGciOi...' : 'gho_xxxxxxxxxx'}...
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Section 2: Service Integration */}
        <CollapsibleSection
          title={`${config.name} Integration`}
          subtitle="Supported operations and API endpoints"
          icon={activeService === 'jira' ? <Ticket className="w-5 h-5" /> : <GitBranch className="w-5 h-5" />}
          defaultOpen={false}
        >
          <div className="mt-4">
            <div className="grid grid-cols-2 gap-3">
              {config.operations.map((op, idx) => (
                <div key={idx} className={`${config.lightBg} rounded-lg p-3`}>
                  <div className="font-semibold text-gray-800 text-sm mb-2">{op.icon} {op.name}</div>
                  <div className="text-xs text-gray-600 font-mono">{op.endpoint}</div>
                </div>
              ))}
            </div>

            <div className={`mt-4 ${config.lightBg} border ${config.borderColor} rounded-lg p-4`}>
              <div className="text-sm text-gray-700">
                <strong>Authentication:</strong> All {config.name} API calls use the access token obtained from OAuth-STS exchange.
              </div>
              <div className="text-xs text-gray-600 mt-2 font-mono bg-white rounded p-2">
                Authorization: Bearer {activeService === 'jira' ? 'eyJhbGciOiJSUzI1NiIsInR5cCI6ImF0K2p3dCJ9...' : 'gho_xxxxxxxxxx'}
              </div>
              {activeService === 'jira' && (
                <div className="mt-2 text-xs text-blue-600">
                  <strong>Note:</strong> Jira requires explicit scopes in the OAuth-STS request. The scopes determine what operations are allowed.
                </div>
              )}
            </div>
          </div>
        </CollapsibleSection>

        {/* Section 3: Client Assertion JWT */}
        <CollapsibleSection
          title="Client Assertion JWT Details"
          subtitle="How the AI Agent authenticates to Okta"
          icon={<Lock className="w-5 h-5" />}
          defaultOpen={false}
        >
          <div className="mt-4 space-y-4">
            <p className="text-gray-700">
              The AI Agent proves its identity by signing a JWT with its private key (RS256).
            </p>

            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-sm font-semibold text-gray-700 mb-2">JWT Structure:</div>
              <pre className="text-xs bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto font-mono">
{`{
  "header": {
    "kid": "${clientAssertionHeader.kid}",
    "alg": "${clientAssertionHeader.alg}"
  },
  "payload": {
    "iss": "${clientAssertionPayload.iss}",
    "sub": "${clientAssertionPayload.sub}",
    "aud": "${clientAssertionPayload.aud}",
    "iat": ${clientAssertionPayload.iat},
    "exp": ${clientAssertionPayload.exp},
    "jti": "${clientAssertionPayload.jti}"
  }
}`}</pre>
              <div className="text-xs text-gray-500 mt-2">Signed with AI Agent's private JWK using RS256 algorithm</div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="font-semibold text-gray-800 text-sm mb-2">Required Claims</div>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li><code className="bg-white px-1 rounded">iss</code> - Agent ID (issuer)</li>
                  <li><code className="bg-white px-1 rounded">sub</code> - Agent ID (subject)</li>
                  <li><code className="bg-white px-1 rounded">aud</code> - Token endpoint URL</li>
                  <li><code className="bg-white px-1 rounded">iat</code> - Issued at timestamp</li>
                  <li><code className="bg-white px-1 rounded">exp</code> - Expiry (60 seconds)</li>
                  <li><code className="bg-white px-1 rounded">jti</code> - Unique request ID</li>
                </ul>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="font-semibold text-gray-800 text-sm mb-2">Security Features</div>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>RS256 asymmetric signing</li>
                  <li>Short-lived (60 second expiry)</li>
                  <li>Unique JTI prevents replay</li>
                  <li>Private key never leaves agent</li>
                  <li>Public key registered in Okta</li>
                </ul>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Section 4: OAuth-STS vs ID-JAG */}
        <CollapsibleSection
          title="OAuth-STS vs ID-JAG Comparison"
          subtitle="Understanding the key differences"
          icon={<Shield className="w-5 h-5" />}
          defaultOpen={false}
        >
          <div className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              {/* ID-JAG (ProGear) */}
              <div className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white text-xs font-bold">
                    PG
                  </div>
                  <div>
                    <div className="font-bold text-gray-800">ProGear (ID-JAG)</div>
                    <div className="text-xs text-gray-500">Internal API Access</div>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-orange-500">→</span>
                    <span>User ID Token</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-orange-500">→</span>
                    <span>ID-JAG Exchange</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-orange-500">→</span>
                    <span>Custom Auth Server</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-orange-500">→</span>
                    <span className="font-semibold">Internal API Token</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-orange-200 text-xs text-gray-600">
                  <strong>Use Case:</strong> Enterprise microservices
                </div>
              </div>

              {/* OAuth-STS (DevOps) */}
              <div className={`bg-gradient-to-br ${
                activeService === 'jira' ? 'from-blue-50 to-indigo-50 border-blue-200' : 'from-gray-50 to-slate-50 border-gray-200'
              } border-2 rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${config.color} flex items-center justify-center text-white`}>
                    {config.icon}
                  </div>
                  <div>
                    <div className="font-bold text-gray-800">DevOps Agent (OAuth-STS)</div>
                    <div className="text-xs text-gray-500">External SaaS Access ({config.name})</div>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    <span className={activeService === 'jira' ? 'text-blue-500' : 'text-gray-500'}>→</span>
                    <span>User ID Token</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={activeService === 'jira' ? 'text-blue-500' : 'text-gray-500'}>→</span>
                    <span>OAuth-STS Exchange {activeService === 'jira' && '+ Scopes'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={activeService === 'jira' ? 'text-blue-500' : 'text-gray-500'}>→</span>
                    <span>Brokered Consent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={activeService === 'jira' ? 'text-blue-500' : 'text-gray-500'}>→</span>
                    <span className="font-semibold">{config.name} Access Token</span>
                  </div>
                </div>
                <div className={`mt-3 pt-3 border-t ${
                  activeService === 'jira' ? 'border-blue-200' : 'border-gray-200'
                } text-xs text-gray-600`}>
                  <strong>Use Case:</strong> Third-party SaaS integrations
                </div>
              </div>
            </div>

            {/* Key Differences Table */}
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Aspect</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">ID-JAG</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">OAuth-STS ({config.name})</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-2 text-sm text-gray-700 font-medium">Target</td>
                    <td className="px-4 py-2 text-sm text-gray-600">Internal APIs</td>
                    <td className="px-4 py-2 text-sm text-gray-600">External SaaS ({config.name})</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-sm text-gray-700 font-medium">Consent</td>
                    <td className="px-4 py-2 text-sm text-gray-600">Not required</td>
                    <td className="px-4 py-2 text-sm text-gray-600">Required (brokered)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-sm text-gray-700 font-medium">Token Type</td>
                    <td className="px-4 py-2 text-sm text-gray-600">Custom audience</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{config.tokenType}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-sm text-gray-700 font-medium">Scopes</td>
                    <td className="px-4 py-2 text-sm text-gray-600">Pre-configured</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{activeService === 'jira' ? 'Required in request' : 'From GitHub App'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </CollapsibleSection>

        {/* Section 5: Security & Governance */}
        <CollapsibleSection
          title="Security & Governance"
          subtitle={`How Okta ensures secure ${config.name} access`}
          icon={<Activity className="w-5 h-5" />}
          defaultOpen={false}
        >
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="font-semibold text-gray-800">User Consent</div>
                </div>
                <div className="text-sm text-gray-600">
                  Users explicitly authorize the AI agent to access their {config.name} account. Can be revoked anytime.
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="font-semibold text-gray-800">Audit Trail</div>
                </div>
                <div className="text-sm text-gray-600">
                  All OAuth-STS exchanges logged in Okta system logs. Full visibility into AI agent actions.
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="font-semibold text-gray-800">Token Security</div>
                </div>
                <div className="text-sm text-gray-600">
                  Tokens are time-limited ({activeService === 'jira' ? '~1 hour' : '~8 hours'}), can be revoked, and are never stored in frontend code.
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="font-semibold text-gray-800">Scoped Access</div>
                </div>
                <div className="text-sm text-gray-600">
                  Agent only gets permissions {activeService === 'jira'
                    ? 'specified in the scope parameter of the STS request'
                    : 'granted in GitHub App configuration'}. Principle of least privilege.
                </div>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Live User Info */}
        <div className={`bg-gradient-to-r ${
          activeService === 'jira' ? 'from-blue-500/10 to-indigo-500/10 border-blue-300/30' : 'from-gray-500/10 to-slate-500/10 border-gray-300/30'
        } border rounded-xl p-6`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${config.color} flex items-center justify-center text-white font-bold`}>
              {userName.charAt(0)}
            </div>
            <div>
              <div className="font-semibold text-white">Current Session</div>
              <div className="text-sm text-gray-300">{userEmail}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-black/20 rounded-lg p-3">
              <div className="text-gray-400 mb-1">User ID</div>
              <div className="text-white font-mono">{userSub}</div>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <div className="text-gray-400 mb-1">Auth Method</div>
              <div className="text-white font-mono">Okta OIDC</div>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <div className="text-gray-400 mb-1">Active Service</div>
              <div className={`font-mono ${activeService === 'jira' ? 'text-blue-400' : 'text-gray-300'}`}>
                {config.name}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// Main export wrapped in Suspense
export default function ArchitecturePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading Architecture...</div>
      </div>
    }>
      <ArchitectureContent />
    </Suspense>
  );
}
