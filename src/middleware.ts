import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that don't require authentication
const publicPaths = [
  "/login",
  "/register",
  "/forgot-password",
  "/api/auth/login",
  "/api/auth/send-otp",
  "/api/auth/verify-otp",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
];

// Paths that require host/admin role
const adminPaths = ["/admin"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if it's a public path
  const isPublicPath = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  // Get token from cookie or header
  const token =
    request.cookies.get("token")?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  // If accessing a public path and has token, redirect to dashboard
  if (isPublicPath && token && pathname !== "/api/auth/login") {
    // Don't redirect API routes
    if (!pathname.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // If accessing a protected path without token, redirect to login
  if (!isPublicPath && !token) {
    // For API routes, return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // For pages, redirect to login
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Admin paths require additional role check (done in page component)
  // This middleware just ensures basic auth

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - socket.io (WebSocket connections)
     */
    "/((?!_next/static|_next/image|favicon.ico|public|socket\\.io).*)",
  ],
};
