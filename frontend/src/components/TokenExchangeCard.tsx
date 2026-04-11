'use client';

import { TokenExchange } from '@/types';

interface Props {
  exchanges: TokenExchange[];
}

export default function TokenExchangeCard({ exchanges }: Props) {
  const granted = exchanges.filter(e => e.success && !e.access_denied);
  const needsAuth = exchanges.filter(e => e.status === 'interaction_required' || e.status === 'consent_required');
  const denied = exchanges.filter(e => e.status === 'denied' || (e.access_denied && e.status !== 'interaction_required' && e.status !== 'consent_required'));

  return (
    <div className="rounded-xl border-2 shadow-sm overflow-hidden" style={{ backgroundColor: '#e0f2f1', borderColor: '#26a69a' }}>
      <div className="bg-gradient-to-r from-okta-blue to-okta-blue-light px-4 py-3 border-b border-neutral-border">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          OAuth-STS Token Exchange
        </h3>
      </div>

      <div className="p-4">
        {/* Summary */}
        <div className="flex items-center gap-4 mb-4 pb-3 border-b border-gray-100">
          {granted.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-success-green/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-success-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-lg font-bold text-success-green">{granted.length}</div>
                <div className="text-[10px] text-gray-500 uppercase">Granted</div>
              </div>
            </div>
          )}

          {needsAuth.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <div className="text-lg font-bold text-amber-500">{needsAuth.length}</div>
                <div className="text-[10px] text-gray-500 uppercase">Auth Required</div>
              </div>
            </div>
          )}

          {denied.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-error-red/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-error-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-lg font-bold text-error-red">{denied.length}</div>
                <div className="text-[10px] text-gray-500 uppercase">Denied</div>
              </div>
            </div>
          )}
        </div>

        {/* Exchange List */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {exchanges.map((exchange, idx) => {
            const isGranted = exchange.success && !exchange.access_denied;
            const isInteractionRequired = exchange.status === 'interaction_required' || exchange.status === 'consent_required';

            return (
              <div
                key={idx}
                className={`rounded-lg border-2 p-3 transition-all ${
                  isGranted
                    ? 'border-success-green/30 bg-success-green/5'
                    : isInteractionRequired
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-error-red/30 bg-error-red/5'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: exchange.color }}
                    >
                      {exchange.agent_name.toLowerCase().includes('jira') ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z"/>
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-800 text-sm">
                        {exchange.agent_name}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {exchange.demo_mode ? 'Demo Mode' : 'OAuth-STS (Brokered Consent)'}
                      </div>
                    </div>
                  </div>

                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                    isGranted
                      ? 'bg-success-green/20 text-success-green'
                      : isInteractionRequired
                      ? 'bg-amber-500/20 text-amber-600'
                      : 'bg-error-red/20 text-error-red'
                  }`}>
                    {isGranted ? (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Granted</span>
                      </>
                    ) : isInteractionRequired ? (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>Auth Required</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Denied</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Granted Scopes */}
                {isGranted && exchange.scopes.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Granted scope:</div>
                    <div className="flex flex-wrap gap-1">
                      {exchange.scopes.map((scope, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-2 py-0.5 bg-success-green/10 text-success-green text-[10px] rounded-full font-mono border border-success-green/30"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interaction Required Message */}
                {isInteractionRequired && (
                  <div className="mt-2">
                    <div className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Requested scope:</div>
                    <div className="flex flex-wrap gap-1">
                      {(exchange.requested_scopes.length > 0 ? exchange.requested_scopes : ['github']).map((scope, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-2 py-0.5 bg-amber-500/10 text-amber-600 text-[10px] rounded-full font-mono border border-amber-500/30"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-600">
                      <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Click "Authorize GitHub Access" button to proceed</span>
                    </div>
                  </div>
                )}

                {/* Denied info */}
                {!isGranted && !isInteractionRequired && (
                  <div className="mt-2">
                    <div className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Requested scope:</div>
                    <div className="flex flex-wrap gap-1">
                      {(exchange.requested_scopes.length > 0 ? exchange.requested_scopes : ['github']).map((scope, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-2 py-0.5 bg-error-red/10 text-error-red text-[10px] rounded-full font-mono border border-error-red/30"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                    {exchange.error && (
                      <div className="mt-2 text-[11px] text-gray-500">
                        {exchange.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {exchanges.length === 0 && (
            <div className="text-center py-6 text-gray-400">
              <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p className="text-sm">No token exchanges yet</p>
              <p className="text-xs text-gray-500 mt-1">Send a message to see OAuth-STS in action</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
