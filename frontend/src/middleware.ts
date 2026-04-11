import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ token }) {
        // Require authentication for protected routes
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  // Protect all routes except login, api/auth, and static files
  matcher: [
    "/",
    "/architecture/:path*",
  ],
};
