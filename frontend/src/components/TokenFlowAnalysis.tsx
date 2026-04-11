'use client';

import { useState } from 'react';
import { TokenExchange, TokenInfo, DecodedToken } from '@/types';
import { ChevronDown, ChevronRight, Key, Shield, Clock, CheckCircle, AlertCircle, Lock, FileText, User, Server } from 'lucide-react';

interface TokenFlowAnalysisProps {
  exchanges: TokenExchange[];
  isLoading?: boolean;
  activeService?: 'github' | 'jira';
}

interface TokenDisplayProps {
  title: string;
  icon: React.ReactNode;
  tokenInfo?: TokenInfo;
  color: string;
  stepNumber: number;
  isCompleted: boolean;
}

function TokenDisplay({ title, icon, tokenInfo, color, stepNumber, isCompleted }: TokenDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const decoded = tokenInfo?.decoded;

  const formatTimestamp = (ts?: number) => {
    if (!ts) return 'N/A';
    return new Date(ts * 1000).toLocaleString();
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="bg-white/5 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/5 transition"
      >
        <div className="flex items-center space-x-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            isCompleted ? 'bg-green-400 text-green-900' : 'bg-white/30 text-white'
          }`}>
            {isCompleted ? <CheckCircle className="w-3 h-3" /> : stepNumber}
          </div>
          <div className={`w-6 h-6 rounded flex items-center justify-center ${color}`}>
            {icon}
          </div>
          <span className="text-sm font-medium text-white">{title}</span>
        </div>
        <div className="flex items-center space-x-2">
          {tokenInfo?.token_preview && (
            <span className="text-[10px] text-white/50 font-mono max-w-[100px] truncate">
              {tokenInfo.token_preview.slice(0, 20)}...
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-white/60" />
          ) : (
            <ChevronRight className="w-4 h-4 text-white/60" />
          )}
        </div>
      </button>

      {isExpanded && decoded && (
        <div className="px-3 pb-3 space-y-2 animate-fadeIn">
          {/* Header */}
          {decoded.header && (
            <div className="bg-black/30 rounded p-2">
              <div className="text-[10px] font-semibold text-cyan-300 uppercase mb-1">Header</div>
              <div className="font-mono text-[10px] space-y-0.5">
                {decoded.header.alg && (
                  <div className="flex">
                    <span className="text-purple-300 w-10">alg:</span>
                    <span className="text-white/90">{decoded.header.alg}</span>
                  </div>
                )}
                {decoded.header.kid && (
                  <div className="flex">
                    <span className="text-purple-300 w-10">kid:</span>
                    <span className="text-white/90 truncate">{decoded.header.kid}</span>
                  </div>
                )}
                {decoded.header.typ && (
                  <div className="flex">
                    <span className="text-purple-300 w-10">typ:</span>
                    <span className="text-white/90">{decoded.header.typ}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payload */}
          {decoded.payload && (
            <div className="bg-black/30 rounded p-2">
              <div className="text-[10px] font-semibold text-cyan-300 uppercase mb-1">Payload</div>
              <div className="font-mono text-[10px] space-y-0.5 max-h-40 overflow-y-auto">
                {Object.entries(decoded.payload).map(([key, value]) => (
                  <div key={key} className="flex">
                    <span className="text-yellow-300 w-12 flex-shrink-0">{key}:</span>
                    <span className="text-white/90 truncate">
                      {key === 'iat' || key === 'exp'
                        ? formatTimestamp(value as number)
                        : formatValue(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Signature Preview */}
          {decoded.signature_preview && (
            <div className="bg-black/30 rounded p-2">
              <div className="text-[10px] font-semibold text-cyan-300 uppercase mb-1">Signature</div>
              <div className="font-mono text-[10px] text-white/60 truncate">
                {decoded.signature_preview}
              </div>
            </div>
          )}

          {/* Token Type & Expiry for access tokens */}
          {tokenInfo?.token_type && (
            <div className="flex items-center space-x-3 text-[10px] text-white/60">
              <span>Type: {tokenInfo.token_type}</span>
              {tokenInfo.expires_in && <span>Expires in: {tokenInfo.expires_in}s</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TokenFlowAnalysis({ exchanges, isLoading, activeService = 'github' }: TokenFlowAnalysisProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Get the latest exchange for display
  const latestExchange = exchanges.length > 0 ? exchanges[exchanges.length - 1] : null;
  const tokenDetails = latestExchange?.token_details;

  // Determine service name from latest exchange or prop
  const serviceName = latestExchange?.agent_name.toLowerCase().includes('jira') ? 'Jira' :
                     latestExchange?.agent_name.toLowerCase().includes('github') ? 'GitHub' :
                     activeService === 'jira' ? 'Jira' : 'GitHub';

  const hasIdToken = !!tokenDetails?.id_token?.decoded;
  const hasClientAssertion = !!tokenDetails?.client_assertion?.decoded;
  const hasAccessToken = !!tokenDetails?.access_token?.decoded;

  return (
    <div className="rounded-xl shadow-lg overflow-hidden" style={{ backgroundColor: '#26a69a' }}>
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-white hover:bg-white/10 transition"
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <Key className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="font-semibold">Token Flow Analysis</div>
            <div className="text-xs text-white/70">OAuth-STS Exchange Details</div>
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5" />
        ) : (
          <ChevronRight className="w-5 h-5" />
        )}
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 animate-fadeIn">
          {/* OAuth-STS Flow Steps Summary */}
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-xs font-semibold text-white/80 uppercase tracking-wide mb-2 flex items-center space-x-2">
              <Shield className="w-3 h-3" />
              <span>OAuth-STS Exchange Flow</span>
            </div>
            <div className="space-y-1.5">
              {/* Step 1: ID Token */}
              <div className="flex items-center space-x-2">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  hasIdToken ? 'bg-green-400 text-green-900' : 'bg-white/30 text-white'
                }`}>
                  {hasIdToken ? <CheckCircle className="w-3 h-3" /> : '1'}
                </div>
                <span className="text-sm text-white/90">ID Token → Okta STS</span>
              </div>

              {/* Step 2: Client Assertion */}
              <div className="flex items-center space-x-2">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  hasClientAssertion ? 'bg-green-400 text-green-900' : 'bg-white/30 text-white'
                }`}>
                  {hasClientAssertion ? <CheckCircle className="w-3 h-3" /> : '2'}
                </div>
                <span className="text-sm text-white/90">Client Assertion (JWT)</span>
              </div>

              {/* Step 3: Access Token */}
              <div className="flex items-center space-x-2">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  latestExchange?.status === 'granted'
                    ? 'bg-green-400 text-green-900'
                    : latestExchange?.status === 'interaction_required'
                    ? 'bg-yellow-400 text-yellow-900'
                    : isLoading
                    ? 'bg-blue-400 text-blue-900 animate-pulse'
                    : 'bg-white/30 text-white'
                }`}>
                  {latestExchange?.status === 'granted' ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : latestExchange?.status === 'interaction_required' ? (
                    <AlertCircle className="w-3 h-3" />
                  ) : isLoading ? (
                    <Clock className="w-3 h-3" />
                  ) : (
                    '3'
                  )}
                </div>
                <span className="text-sm text-white/90">
                  {serviceName} Access Token {latestExchange?.status === 'granted' ? '✓' : latestExchange?.status === 'interaction_required' ? '(Consent Required)' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Token Details - Expandable sections for each token */}
          {tokenDetails && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-white/80 uppercase tracking-wide flex items-center space-x-2">
                <Lock className="w-3 h-3" />
                <span>Decoded Token Details</span>
              </div>

              {/* ID Token */}
              <TokenDisplay
                title="ID Token (User)"
                icon={<User className="w-3 h-3 text-white" />}
                tokenInfo={tokenDetails.id_token}
                color="bg-purple-500"
                stepNumber={1}
                isCompleted={hasIdToken}
              />

              {/* Client Assertion */}
              <TokenDisplay
                title="Client Assertion (Agent)"
                icon={<FileText className="w-3 h-3 text-white" />}
                tokenInfo={tokenDetails.client_assertion}
                color="bg-blue-500"
                stepNumber={2}
                isCompleted={hasClientAssertion}
              />

              {/* Access Token */}
              <TokenDisplay
                title={`${serviceName} Access Token`}
                icon={<Server className="w-3 h-3 text-white" />}
                tokenInfo={tokenDetails.access_token}
                color={serviceName === 'Jira' ? 'bg-[#0052CC]' : 'bg-gray-700'}
                stepNumber={3}
                isCompleted={hasAccessToken}
              />
            </div>
          )}

          {/* Scopes Display */}
          {latestExchange && latestExchange.scopes && latestExchange.scopes.length > 0 && (
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-xs font-semibold text-white/80 uppercase tracking-wide mb-2">
                Granted Scopes
              </div>
              <div className="flex flex-wrap gap-1">
                {latestExchange.scopes.map((scope, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-green-500/30 text-green-200 text-[10px] rounded-full font-mono">
                    {scope}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Status Indicator */}
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  latestExchange?.status === 'granted'
                    ? 'bg-green-400 animate-pulse'
                    : latestExchange?.status === 'interaction_required'
                    ? 'bg-yellow-400 animate-pulse'
                    : isLoading
                    ? 'bg-blue-400 animate-pulse'
                    : 'bg-white/40'
                }`}></div>
                <span className="text-xs text-white/80">
                  {latestExchange?.status === 'granted'
                    ? 'Token Active'
                    : latestExchange?.status === 'interaction_required'
                    ? 'Consent Required'
                    : isLoading
                    ? 'Exchanging...'
                    : 'Awaiting Request'}
                </span>
              </div>
              {latestExchange && (
                <span className="text-xs text-white/60">
                  {exchanges.length} exchange{exchanges.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* No exchanges yet message */}
          {!latestExchange && !isLoading && (
            <div className="text-center py-2">
              <p className="text-xs text-white/60">
                Send a message to see token exchange flow
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
