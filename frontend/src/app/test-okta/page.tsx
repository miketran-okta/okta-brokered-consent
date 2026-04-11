'use client';

import { useState } from 'react';

export default function TestOktaPage() {
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
  };

  const testDirectOkta = () => {
    addLog('🔵 Testing direct Okta redirect...');

    const clientId = '0oawbiawuxJ80Pqf41d7';
    const redirectUri = 'http://localhost:3000/api/auth/callback/okta';
    const oktaDomain = 'https://oktaforai.oktapreview.com';

    const authUrl = `${oktaDomain}/oauth2/v1/authorize?` + new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile groups',
      state: 'test-state-' + Date.now(),
      nonce: 'test-nonce-' + Date.now(),
    });

    addLog(`📍 Redirect URL: ${authUrl.substring(0, 100)}...`);
    addLog('🚀 Redirecting in 2 seconds...');

    setTimeout(() => {
      window.location.href = authUrl;
    }, 2000);
  };

  const testNextAuth = async () => {
    addLog('🔵 Testing NextAuth signIn...');

    try {
      const { signIn } = await import('next-auth/react');
      addLog('✅ NextAuth imported');

      addLog('📍 Calling signIn("okta")...');
      const result = await signIn('okta', { redirect: false });

      addLog(`✅ SignIn result: ${JSON.stringify(result)}`);

      if (result?.error) {
        addLog(`❌ Error: ${result.error}`);
      } else if (result?.url) {
        addLog(`✅ Redirect URL: ${result.url}`);
        addLog('🚀 Redirecting...');
        window.location.href = result.url;
      }
    } catch (err) {
      addLog(`❌ Exception: ${err}`);
    }
  };

  const testProviders = async () => {
    addLog('🔵 Fetching NextAuth providers...');

    try {
      const response = await fetch('/api/auth/providers');
      const data = await response.json();
      addLog(`✅ Providers: ${JSON.stringify(data, null, 2)}`);
    } catch (err) {
      addLog(`❌ Error: ${err}`);
    }
  };

  const testOktaDiscovery = async () => {
    addLog('🔵 Testing Okta OIDC discovery...');

    try {
      const response = await fetch('https://oktaforai.oktapreview.com/.well-known/openid-configuration');
      const data = await response.json();
      addLog(`✅ Issuer: ${data.issuer}`);
      addLog(`✅ Auth endpoint: ${data.authorization_endpoint}`);
      addLog(`✅ Token endpoint: ${data.token_endpoint}`);
    } catch (err) {
      addLog(`❌ Error: ${err}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">🧪 Okta Integration Test</h1>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <button
          onClick={testOktaDiscovery}
          className="p-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
        >
          1. Test Okta Discovery
        </button>

        <button
          onClick={testProviders}
          className="p-4 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold"
        >
          2. Test NextAuth Providers
        </button>

        <button
          onClick={testNextAuth}
          className="p-4 bg-green-600 hover:bg-green-700 rounded-lg font-semibold"
        >
          3. Test NextAuth SignIn
        </button>

        <button
          onClick={testDirectOkta}
          className="p-4 bg-orange-600 hover:bg-orange-700 rounded-lg font-semibold"
        >
          4. Test Direct Okta Redirect
        </button>
      </div>

      <div className="bg-gray-800 rounded-lg p-4 max-h-96 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">📋 Debug Log</h2>
        {log.length === 0 && (
          <p className="text-gray-400">Click a button above to start testing...</p>
        )}
        {log.map((entry, idx) => (
          <div key={idx} className="text-sm font-mono mb-1 text-green-400">
            {entry}
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-900/30 border border-blue-500 rounded-lg">
        <h3 className="font-bold mb-2">📖 Instructions:</h3>
        <ol className="text-sm space-y-2">
          <li><strong>Step 1:</strong> Click "Test Okta Discovery" - should show Okta endpoints</li>
          <li><strong>Step 2:</strong> Click "Test NextAuth Providers" - should show okta provider</li>
          <li><strong>Step 3:</strong> Click "Test NextAuth SignIn" - tests NextAuth flow</li>
          <li><strong>Step 4:</strong> Click "Test Direct Okta Redirect" - bypasses NextAuth, goes directly to Okta</li>
        </ol>
      </div>
    </div>
  );
}
