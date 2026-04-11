import type { NextAuthOptions } from 'next-auth';
import OktaProvider from 'next-auth/providers/okta';

// Extend the Session type to include idToken
declare module "next-auth" {
  interface Session {
    idToken?: string;
    accessToken?: string;
    user?: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      groups?: string[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    idToken?: string;
    accessToken?: string;
    groups?: string[];
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    OktaProvider({
      clientId: process.env.NEXT_PUBLIC_OKTA_CLIENT_ID!,
      clientSecret: process.env.OKTA_CLIENT_SECRET || 'placeholder-for-pkce',
      issuer: process.env.NEXT_PUBLIC_OKTA_ISSUER!,
    }),
  ],
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
      }
      return token;
    },
    async session({ session, token }) {
      // Copy token data to session - IMPORTANT: Include idToken for OAuth-STS
      session.accessToken = token.accessToken as string;
      session.idToken = token.idToken as string;  // This is used for OAuth-STS token exchange
      session.user = {
        ...session.user,
        id: token.sub as string,
      };
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 28800, // 8 hours in seconds
  },
  debug: true, // Enable debug logging
};
