'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get('callbackUrl') || '/';
  const error = searchParams?.get('error');

  const handleSignIn = () => {
    signIn('okta', { callbackUrl });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-bg via-primary to-primary-light flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-block relative mb-4">
            <div className="absolute inset-0 bg-accent/30 rounded-full blur-3xl animate-pulse"></div>
            {/* DevOps Robot Icon */}
            <div className="relative z-10 w-24 h-24 bg-gradient-to-br from-accent to-devops-purple rounded-2xl flex items-center justify-center shadow-2xl">
              <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                <circle cx="8" cy="9" r="1.5" fill="currentColor" />
                <circle cx="16" cy="9" r="1.5" fill="currentColor" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6" />
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">AI DevOps Agent</h1>
          <p className="text-gray-300">Powered by Okta Brokered Consent</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border-2 border-accent/20">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome</h2>
            <p className="text-gray-600">Sign in to access your AI DevOps assistant</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-error-red/10 border-l-4 border-error-red rounded-lg">
              <p className="text-error-red text-sm font-semibold">
                {error === 'OAuthCallback' && 'Authentication failed. Please try again.'}
                {error === 'Configuration' && 'Okta configuration error. Check environment variables.'}
                {!['OAuthCallback', 'Configuration'].includes(error) && `Error: ${error}`}
              </p>
            </div>
          )}

          {/* Sign In Button - Bright Green for visibility */}
          <button
            onClick={handleSignIn}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 ease-in-out transform hover:scale-[1.02] hover:shadow-xl shadow-lg flex items-center justify-center space-x-3 border-b-4 border-green-700"
          >
            <svg className="w-6 h-6" viewBox="0 0 512 512" fill="currentColor">
              <path d="M256 0C114.5 0 0 114.5 0 256s114.5 256 256 256 256-114.5 256-256S397.5 0 256 0zm0 384c-70.7 0-128-57.3-128-128s57.3-128 128-128 128 57.3 128 128-57.3 128-128 128z"/>
            </svg>
            <span className="text-lg">Sign in with Okta</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <svg className="w-4 h-4 text-okta-blue" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Secured by Okta Identity</span>
            </div>
          </div>
        </div>

        {/* Features - Original 3 + Jira */}
        <div className="mt-8 grid grid-cols-4 gap-3 text-center">
          <div className="p-4 bg-white/10 backdrop-blur-sm rounded-xl">
            <div className="text-2xl mb-2">🔐</div>
            <div className="text-xs text-gray-300">OAuth-STS</div>
          </div>
          <div className="p-4 bg-white/10 backdrop-blur-sm rounded-xl">
            <div className="text-2xl mb-2">🤖</div>
            <div className="text-xs text-gray-300">AI Agent</div>
          </div>
          <div className="p-4 bg-white/10 backdrop-blur-sm rounded-xl">
            <div className="text-2xl mb-2">📊</div>
            <div className="text-xs text-gray-300">GitHub</div>
          </div>
          <div className="p-4 bg-white/10 backdrop-blur-sm rounded-xl">
            <div className="w-8 h-8 mx-auto mb-1 bg-blue-600 rounded flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z"/>
              </svg>
            </div>
            <div className="text-xs text-gray-300">Jira</div>
          </div>
        </div>

        {/* Description */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            This demo showcases Okta Brokered Consent (OAuth-STS) for AI agents
            accessing GitHub and Jira on behalf of users.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-neutral-bg via-primary to-primary-light flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
