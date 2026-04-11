'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import AgentFlowCard from '@/components/AgentFlowCard';
import TokenExchangeCard from '@/components/TokenExchangeCard';
import UserIdentityCard from '@/components/UserIdentityCard';
import QuickActionsCard from '@/components/QuickActionsCard';
import TokenFlowAnalysis from '@/components/TokenFlowAnalysis';
import { ChatMessage, AgentFlowStep, TokenExchange } from '@/types';

const githubExampleQuestions = [
  { text: "Show all repositories in my organization", icon: "📁", category: "Repositories" },
  { text: "List open pull requests that need review", icon: "🔀", category: "Pull Requests" },
  { text: "Show high-priority issues across projects", icon: "🐛", category: "Issues" },
  { text: "Comment on PR #123 saying 'LGTM, approved!'", icon: "💬", category: "Actions" },
  { text: "Show recent repository activity and commits", icon: "📊", category: "Activity" },
  { text: "What can you help me with?", icon: "❓", category: "Help" },
];

const jiraExampleQuestions = [
  { text: "List all my Jira projects", icon: "📋", category: "Projects" },
  { text: "Show open issues assigned to me", icon: "🎫", category: "My Issues" },
  { text: "Create a bug in PROJECT: Login not working", icon: "➕", category: "Create" },
  { text: "Find issues with JQL: priority = High", icon: "🔍", category: "Search" },
  { text: "Move PROJ-123 to In Progress", icon: "▶️", category: "Transition" },
  { text: "Add comment to PROJ-456: Working on this", icon: "💬", category: "Comment" },
];

const CHAT_STORAGE_KEY = 'devops-chat-messages';
const AGENT_FLOW_STORAGE_KEY = 'devops-agent-flow';
const TOKEN_EXCHANGE_STORAGE_KEY = 'devops-token-exchanges';
const SESSION_ID_STORAGE_KEY = 'devops-session-id';
const ACTIVE_SERVICE_STORAGE_KEY = 'devops-active-service';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentAgentFlow, setCurrentAgentFlow] = useState<AgentFlowStep[]>([]);
  const [currentTokenExchanges, setCurrentTokenExchanges] = useState<TokenExchange[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [interactionUri, setInteractionUri] = useState<string | null>(null);
  const [consentService, setConsentService] = useState<'github' | 'jira' | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [activeService, setActiveService] = useState<'github' | 'jira'>('github');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(480); // Increased default width
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);

  // Handle panel resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      // Constrain between 350px and 700px
      setRightPanelWidth(Math.min(700, Math.max(350, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Get example questions based on active service
  const exampleQuestions = activeService === 'github' ? githubExampleQuestions : jiraExampleQuestions;

  const isLoadingAuth = status === 'loading';

  // Load chat history and active service from sessionStorage on mount
  useEffect(() => {
    try {
      const savedMessages = sessionStorage.getItem(CHAT_STORAGE_KEY);
      const savedAgentFlow = sessionStorage.getItem(AGENT_FLOW_STORAGE_KEY);
      const savedTokenExchanges = sessionStorage.getItem(TOKEN_EXCHANGE_STORAGE_KEY);
      const savedSessionId = sessionStorage.getItem(SESSION_ID_STORAGE_KEY);
      const savedActiveService = sessionStorage.getItem(ACTIVE_SERVICE_STORAGE_KEY);

      if (savedMessages) setChatMessages(JSON.parse(savedMessages));
      if (savedAgentFlow) setCurrentAgentFlow(JSON.parse(savedAgentFlow));
      if (savedTokenExchanges) setCurrentTokenExchanges(JSON.parse(savedTokenExchanges));
      if (savedSessionId) setSessionId(savedSessionId);
      if (savedActiveService === 'github' || savedActiveService === 'jira') {
        setActiveService(savedActiveService);
      }
    } catch (e) {
      console.error('Error loading chat history:', e);
    }
  }, []);

  // Save chat history to sessionStorage
  useEffect(() => {
    if (chatMessages.length > 0) {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatMessages));
    }
  }, [chatMessages]);

  useEffect(() => {
    if (currentAgentFlow.length > 0) {
      sessionStorage.setItem(AGENT_FLOW_STORAGE_KEY, JSON.stringify(currentAgentFlow));
    }
    if (currentTokenExchanges.length > 0) {
      sessionStorage.setItem(TOKEN_EXCHANGE_STORAGE_KEY, JSON.stringify(currentTokenExchanges));
    }
  }, [currentAgentFlow, currentTokenExchanges]);

  // Save active service to sessionStorage so Architecture page can read it
  useEffect(() => {
    sessionStorage.setItem(ACTIVE_SERVICE_STORAGE_KEY, activeService);
  }, [activeService]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSignOut = async () => {
    const idToken = session?.idToken;

    // Clear session storage first
    sessionStorage.removeItem(CHAT_STORAGE_KEY);
    sessionStorage.removeItem(AGENT_FLOW_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_EXCHANGE_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_ID_STORAGE_KEY);

    // Sign out from NextAuth (clears cookies)
    await signOut({ redirect: false });

    // Redirect to Okta logout, which will redirect back to login page
    const oktaDomain = process.env.NEXT_PUBLIC_OKTA_DOMAIN;
    const loginPageUrl = `${window.location.origin}/login`;
    const postLogoutRedirect = encodeURIComponent(loginPageUrl);

    if (oktaDomain && idToken) {
      // Full Okta session logout with ID token hint
      window.location.href = `${oktaDomain}/oauth2/v1/logout?id_token_hint=${idToken}&post_logout_redirect_uri=${postLogoutRedirect}`;
    } else if (oktaDomain) {
      // Okta logout without ID token hint
      window.location.href = `${oktaDomain}/oauth2/v1/logout?post_logout_redirect_uri=${postLogoutRedirect}`;
    } else {
      // Fallback: direct redirect to login page
      window.location.href = '/login';
    }
  };

  const handleAuthorize = () => {
    if (!interactionUri) return;

    // Open authorization in new window
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const authWindow = window.open(
      interactionUri,
      consentService === 'jira' ? 'JiraAuthorization' : 'GitHubAuthorization',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // Poll for window close
    const checkWindow = setInterval(() => {
      if (authWindow?.closed) {
        clearInterval(checkWindow);
        // After authorization, retry the pending message
        if (pendingMessage) {
          setTimeout(() => {
            handleSendMessage(pendingMessage);
            setPendingMessage(null);
            setInteractionUri(null);
            setConsentService(null);
          }, 1000);
        }
      }
    }, 500);
  };

  const handleTestConsent = async () => {
    try {
      // Call revoke endpoint to clear token cache
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      await fetch(`${apiUrl}/api/revoke`, { method: 'POST' });

      // Clear local state
      setChatMessages([]);
      setCurrentTokenExchanges([]);
      setCurrentAgentFlow([]);

      // Trigger a GitHub request to force consent flow
      handleSendMessage('Show my GitHub repositories');
    } catch (error) {
      console.error('Error testing consent:', error);
    }
  };

  const handleSendMessage = async (text?: string) => {
    const userMessage = text || message.trim();
    if (!userMessage) return;

    setMessage('');
    const newUserMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };
    setChatMessages((prev) => [...prev, newUserMessage]);
    setIsLoading(true);
    setCurrentAgentFlow([{ step: 'router', action: 'Processing request...', status: 'processing' }]);
    setCurrentTokenExchanges([]);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const idToken = session?.idToken;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: userMessage,
          session_id: sessionId,
        }),
      });

      const data = await response.json();

      if (data.session_id) {
        setSessionId(data.session_id);
        sessionStorage.setItem(SESSION_ID_STORAGE_KEY, data.session_id);
      }

      setCurrentAgentFlow(data.agent_flow || []);
      setCurrentTokenExchanges(data.token_exchanges || []);

      // Check if interaction_required (user needs to authorize)
      if (data.interaction_required && data.interaction_uri) {
        setInteractionUri(data.interaction_uri);
        setPendingMessage(userMessage);
        // Determine which service triggered the consent from token_exchanges
        const exchange = data.token_exchanges?.find((ex: TokenExchange) => ex.status === 'interaction_required');
        const service = exchange?.agent_name?.toLowerCase().includes('jira') ? 'jira' : 'github';
        setConsentService(service);
      }

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.content,
        timestamp: Date.now(),
        agentFlow: data.agent_flow,
        tokenExchanges: data.token_exchanges,
        interactionRequired: data.interaction_required,
        interactionUri: data.interaction_uri,
      };
      setChatMessages((prev) => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please check that the backend is running.',
          timestamp: Date.now(),
        },
      ]);
      setCurrentAgentFlow([{ step: 'error', action: 'Request failed', status: 'error' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Loading screen
  if (isLoadingAuth || status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #2d1f3d 50%, #4a2c5a 100%)' }}>
        {/* Background animated elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 left-10 opacity-20 animate-bounce text-8xl" style={{ animationDuration: '3s' }}>
            💻
          </div>
          <div className="absolute bottom-20 right-10 opacity-15 animate-bounce text-9xl" style={{ animationDuration: '4s', animationDelay: '1s' }}>
            🐙
          </div>
          <div className="absolute top-1/3 right-1/4 opacity-10 animate-pulse text-6xl">
            🔐
          </div>
        </div>

        {/* Glowing orbs */}
        <div className="absolute top-20 left-20 w-64 h-64 bg-accent rounded-full blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-devops-purple rounded-full blur-3xl opacity-15 animate-pulse" style={{ animationDelay: '1s' }}></div>

        <div className="flex flex-col items-center space-y-4 relative z-10">
          {/* DevOps Agent Robot Icon */}
          <svg className="w-16 h-16 text-white animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            <circle cx="8" cy="9" r="1.5" fill="currentColor" />
            <circle cx="16" cy="9" r="1.5" fill="currentColor" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6" />
          </svg>
          <div className="text-white text-xl font-display">Loading DevOps Agent...</div>
        </div>
      </div>
    );
  }

  return (
    <main className="h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #2d1f3d 50%, #3d2847 100%)' }}>
      {/* Authorization Modal (when interaction_required) */}
      {interactionUri && consentService && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border-4 ${
            consentService === 'jira' ? 'border-blue-500' : 'border-gray-800'
          }`}>
            <div className="text-center">
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                consentService === 'jira'
                  ? 'bg-gradient-to-br from-blue-500 to-blue-700'
                  : 'bg-gradient-to-br from-gray-700 to-gray-900'
              }`}>
                {consentService === 'jira' ? (
                  <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z"/>
                  </svg>
                ) : (
                  <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                )}
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">
                {consentService === 'jira' ? 'Atlassian Jira Authorization Required' : 'GitHub Authorization Required'}
              </h3>
              <p className="text-gray-600 mb-6">
                The DevOps Agent needs your permission to access your {consentService === 'jira' ? 'Atlassian Jira' : 'GitHub'} account via Okta Brokered Consent.
              </p>
              <button
                onClick={handleAuthorize}
                className={`w-full py-4 px-8 text-white rounded-xl font-bold text-lg transition-all shadow-xl hover:shadow-2xl flex items-center justify-center space-x-3 hover:scale-105 transform animate-pulse ${
                  consentService === 'jira'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 border-b-4 border-blue-800'
                    : 'bg-gradient-to-r from-gray-700 to-gray-900 hover:from-gray-600 hover:to-gray-800 border-b-4 border-gray-950'
                }`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Authorize {consentService === 'jira' ? 'Atlassian Jira' : 'GitHub'} Access</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
              <button
                onClick={() => {
                  setInteractionUri(null);
                  setConsentService(null);
                  setPendingMessage(null);
                }}
                className="mt-3 text-sm text-gray-500 hover:text-gray-700 transition"
              >
                Cancel
              </button>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  This is a secure, one-time authorization through Okta. After authorizing, you can use all {consentService === 'jira' ? 'Jira' : 'GitHub'} features.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b-4 shadow-lg relative overflow-hidden" style={{ background: 'linear-gradient(90deg, #1a1a2e 0%, #2d1f3d 50%, #4a2c5a 100%)', borderColor: '#fef08a' }}>
        {/* Tech/Code pattern background */}
        <div className="absolute inset-0 opacity-5">
          <svg className="w-full h-full" viewBox="0 0 100 30" preserveAspectRatio="none">
            <line x1="10" y1="10" x2="90" y2="10" stroke="#6366f1" strokeWidth="0.5"/>
            <line x1="10" y1="15" x2="90" y2="15" stroke="#6366f1" strokeWidth="0.5"/>
            <line x1="10" y1="20" x2="90" y2="20" stroke="#6366f1" strokeWidth="0.5"/>
            <rect x="20" y="8" width="15" height="4" fill="#6366f1" opacity="0.3"/>
            <rect x="40" y="13" width="20" height="4" fill="#8b5cf6" opacity="0.3"/>
            <rect x="65" y="18" width="10" height="4" fill="#6366f1" opacity="0.3"/>
            <circle cx="15" cy="12" r="1.5" fill="#6366f1"/>
            <circle cx="85" cy="17" r="1.5" fill="#8b5cf6"/>
          </svg>
        </div>

        <div className="px-6 py-4 flex justify-between items-center relative z-10">
          {/* Left: Logo */}
          <div className="flex items-center space-x-4">
            <div className="relative">
              {/* DevOps Agent Robot Icon */}
              <div className="w-12 h-12 bg-gradient-to-br from-accent to-devops-purple rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  <circle cx="8" cy="9" r="1.5" fill="currentColor" />
                  <circle cx="16" cy="9" r="1.5" fill="currentColor" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6" />
                </svg>
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-okta-blue rounded-full border-2 border-white flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div>
              <h1 className="text-white text-2xl font-bold">AI DevOps Agent</h1>
              <p className="text-gray-300 text-sm">Okta Brokered Consent</p>
            </div>
          </div>

          {/* Center: Service Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveService('github')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                activeService === 'github'
                  ? 'bg-gray-800 text-white shadow-lg'
                  : 'bg-white/10 text-gray-400 hover:bg-white/20'
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
                  : 'bg-white/10 text-gray-400 hover:bg-white/20'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z"/>
              </svg>
              Jira
            </button>
          </div>

          {/* Right: Suggestions + User */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                showSuggestions
                  ? 'bg-yellow-500 text-black shadow-lg'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Suggestions
            </button>
            <div className="w-px h-8 bg-gray-600"></div>
            <span className="text-gray-200 text-sm">{session?.user?.email}</span>
            <button
              onClick={handleSignOut}
              className="px-5 py-2.5 bg-white/10 hover:bg-accent/30 text-white rounded-lg transition border border-white/20 hover:border-accent/50 flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Suggestions Panel - Collapsible (Top of page) */}
      {showSuggestions && (
        <div className="border-b-2 border-gray-600 px-4 py-3" style={{ background: 'linear-gradient(90deg, #1a1a2e 0%, #2d1f3d 50%, #1a1a2e 100%)' }}>
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-300">
                {activeService === 'jira' ? '🔵 Jira Suggestions' : '⬛ GitHub Suggestions'}
              </span>
              <button
                onClick={() => setShowSuggestions(false)}
                className="text-gray-400 hover:text-white text-sm"
              >
                ✕ Close
              </button>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {exampleQuestions.map((question, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    handleSendMessage(question.text);
                    setShowSuggestions(false);
                  }}
                  className={`p-3 rounded-lg text-center text-xs transition-all hover:scale-[1.02] ${
                    activeService === 'jira'
                      ? 'bg-blue-900/50 hover:bg-blue-800/50 text-blue-100 border border-blue-700'
                      : 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-100 border border-gray-600'
                  }`}
                >
                  <div className="text-2xl mb-1">{question.icon}</div>
                  <div className="font-medium">{question.category}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dual Pane Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane - Chat Interface */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #2d1f3d 0%, #3d2847 50%, #4a2c5a 100%)' }}>
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {chatMessages.length === 0 && (
              <div className="text-center py-8 max-w-3xl mx-auto">
                {/* Service Icon - Changes based on active service */}
                <div className="inline-block mb-4 relative">
                  <div className={`absolute inset-0 rounded-full blur-2xl animate-pulse ${
                    activeService === 'jira' ? 'bg-blue-500/30' : 'bg-gray-700/30'
                  }`}></div>
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl relative z-10 ${
                    activeService === 'jira'
                      ? 'bg-gradient-to-br from-blue-500 to-blue-700'
                      : 'bg-gradient-to-br from-gray-700 to-gray-900'
                  }`}>
                    {activeService === 'jira' ? (
                      // Jira Icon
                      <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z"/>
                      </svg>
                    ) : (
                      // GitHub Icon
                      <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                    )}
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">Welcome, {session?.user?.name || 'Developer'}!</h2>
                <p className="text-gray-300 mb-4">
                  {activeService === 'jira'
                    ? 'Manage your Jira projects and issues with AI assistance'
                    : 'Manage your GitHub repositories with AI assistance'}
                </p>

                {/* Service Toggle - Larger and more prominent */}
                <div className="flex justify-center gap-3 mb-6">
                  <button
                    onClick={() => setActiveService('github')}
                    className={`px-8 py-4 rounded-xl font-bold text-base transition-all flex items-center gap-3 border-2 ${
                      activeService === 'github'
                        ? 'bg-gray-900 text-white shadow-lg scale-105 border-gray-600'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 border-transparent hover:border-gray-600'
                    }`}
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    GitHub
                  </button>
                  <button
                    onClick={() => setActiveService('jira')}
                    className={`px-8 py-4 rounded-xl font-bold text-base transition-all flex items-center gap-3 border-2 ${
                      activeService === 'jira'
                        ? 'bg-blue-600 text-white shadow-lg scale-105 border-blue-400'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 border-transparent hover:border-blue-400'
                    }`}
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z"/>
                    </svg>
                    Jira
                  </button>
                </div>

                {/* Service-specific description */}
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm mb-6 ${
                  activeService === 'jira'
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-gray-700/50 text-gray-300'
                }`}>
                  {activeService === 'jira' ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Projects, Issues, Sprints, JQL Search
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                      Repos, Pull Requests, Issues, Code
                    </>
                  )}
                </div>

                {/* Example Questions - Service-specific colors */}
                <div className="grid grid-cols-2 gap-3 text-left">
                  {exampleQuestions.map((question, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(question.text)}
                      className={`group p-4 backdrop-blur-sm border-2 hover:shadow-xl rounded-xl transition-all text-left flex items-start space-x-3 hover:scale-[1.02] transform ${
                        activeService === 'jira'
                          ? 'bg-blue-50 border-blue-200 hover:border-blue-400'
                          : 'bg-gray-50 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all shadow-sm group-hover:shadow-md ${
                          activeService === 'jira' ? 'bg-blue-100' : 'bg-gray-100'
                        }`}
                      >
                        <span className="text-lg group-hover:scale-110 transition-transform">{question.icon}</span>
                      </div>
                      <div className="flex-1">
                        <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                          activeService === 'jira' ? 'text-blue-600' : 'text-gray-600'
                        }`}>{question.category}</div>
                        <span className="text-sm text-gray-700 group-hover:text-gray-900 font-medium leading-relaxed block">
                          {question.text}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start space-x-3 max-w-4xl ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center shadow-lg ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-devops-purple to-accent'
                      : 'bg-gradient-to-br from-primary to-github-dark'
                  }`}>
                    {msg.role === 'user' ? (
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    ) : (
                      /* DevOps Agent Robot Icon */
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        <circle cx="8" cy="9" r="1.5" fill="currentColor" />
                        <circle cx="16" cy="9" r="1.5" fill="currentColor" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6" />
                      </svg>
                    )}
                  </div>

                  <div className={`rounded-xl p-4 shadow-md ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-accent to-devops-purple text-white border-b-4 border-devops-purple/50'
                      : 'bg-white border-2 border-neutral-border'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none text-gray-700 prose-headings:text-gray-800 prose-strong:text-gray-800 prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded prose-pre:bg-gray-100 prose-pre:text-gray-800 prose-ul:my-2 prose-li:my-0 prose-table:text-sm">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {/* Show authorization button if interaction is required */}
                    {msg.role === 'assistant' && msg.interactionRequired && msg.interactionUri && (() => {
                      // Derive service from message's token exchanges
                      const exchange = msg.tokenExchanges?.find(ex => ex.status === 'interaction_required');
                      const msgService = exchange?.agent_name?.toLowerCase().includes('jira') ? 'jira' : 'github';
                      return (
                        <button
                          onClick={() => {
                            setInteractionUri(msg.interactionUri!);
                            setConsentService(msgService);
                            setPendingMessage(chatMessages.find(m => m.role === 'user' && m.timestamp < msg.timestamp)?.content || '');
                          }}
                          className={`mt-3 w-full py-2 px-4 text-white rounded-lg font-semibold transition shadow-md hover:shadow-lg flex items-center justify-center space-x-2 ${
                            msgService === 'jira'
                              ? 'bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700'
                              : 'bg-gradient-to-r from-gray-700 to-gray-900 hover:from-gray-600 hover:to-gray-800'
                          }`}
                        >
                          {msgService === 'jira' ? (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z"/>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                            </svg>
                          )}
                          <span>Authorize {msgService === 'jira' ? 'Atlassian Jira' : 'GitHub'} Access</span>
                        </button>
                      );
                    })()}

                    <div className={`text-xs mt-2 ${msg.role === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-primary to-github-dark rounded-lg flex items-center justify-center">
                    {/* DevOps Agent Robot Icon */}
                    <svg className="w-6 h-6 text-white animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      <circle cx="8" cy="9" r="1.5" fill="currentColor" />
                      <circle cx="16" cy="9" r="1.5" fill="currentColor" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6" />
                    </svg>
                  </div>
                  <div className="bg-white border-2 border-accent/30 rounded-xl p-4 shadow-md">
                    <div className="flex items-center space-x-3">
                      <div className="flex space-x-2">
                        <div className="w-2.5 h-2.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2.5 h-2.5 bg-devops-purple rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2.5 h-2.5 bg-github-dark rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <span className="text-sm text-gray-500">Processing with OAuth-STS...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t-4 px-6 py-4 shadow-2xl" style={{ background: 'linear-gradient(90deg, #2d1f3d 0%, #3d2847 50%, #2d1f3d 100%)', borderColor: '#fef08a' }}>
            {/* Input Form */}
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex space-x-3 max-w-4xl mx-auto">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={activeService === 'jira'
                    ? "Ask about your Jira projects, issues, or create tickets..."
                    : "Ask about your GitHub repos, PRs, or issues..."}
                  className="w-full px-5 py-3 border-2 border-neutral-border rounded-xl focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition bg-white text-gray-700 placeholder-gray-400"
                  disabled={isLoading}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30">
                  {activeService === 'jira' ? (
                    <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                  )}
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading || !message.trim()}
                className="px-8 py-3 bg-green-700 hover:bg-green-600 text-white rounded-xl font-extrabold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition shadow-[0_0_20px_rgba(21,128,61,0.6)] hover:shadow-[0_0_30px_rgba(21,128,61,0.8)] flex items-center space-x-2 border-2 border-green-400 hover:scale-105 transform"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>

        {/* Resize Handle */}
        <div
          ref={resizeRef}
          onMouseDown={() => setIsResizing(true)}
          className={`w-1 cursor-col-resize hover:bg-yellow-400 transition-colors flex-shrink-0 ${
            isResizing ? 'bg-yellow-400' : 'bg-transparent hover:bg-yellow-400/50'
          }`}
          style={{ marginLeft: '-2px', marginRight: '-2px', zIndex: 10 }}
        />

        {/* Right Pane - Security Dashboard */}
        <div
          className="border-l-4 overflow-y-auto p-4 space-y-4 flex-shrink-0"
          style={{
            width: `${rightPanelWidth}px`,
            background: 'linear-gradient(180deg, #3d2847 0%, #4a2c5a 50%, #5a3468 100%)',
            borderColor: '#fef08a'
          }}
        >
          {/* User Identity */}
          <UserIdentityCard
            name={session?.user?.name}
            email={session?.user?.email}
            groups={(session?.user as any)?.groups}
          />

          {/* Agent Flow */}
          <AgentFlowCard steps={currentAgentFlow} isLoading={isLoading} />

          {/* Token Exchanges */}
          <TokenExchangeCard exchanges={currentTokenExchanges} />

          {/* Token Flow Analysis - Learn More Section */}
          <TokenFlowAnalysis exchanges={currentTokenExchanges} isLoading={isLoading} activeService={activeService} />

          {/* Quick Actions */}
          <QuickActionsCard onAction={(msg) => handleSendMessage(msg)} onTestConsent={handleTestConsent} activeService={activeService} />

          {/* Architecture Link */}
          <Link
            href={`/architecture?service=${activeService}`}
            className="block p-4 bg-gradient-to-r from-okta-blue to-okta-blue-light text-white rounded-xl hover:shadow-lg transition hover:scale-[1.02]"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Learn More</div>
                <div className="text-sm text-white/80">View Architecture Details</div>
              </div>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
