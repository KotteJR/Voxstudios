import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Add paths that don't require authentication
const publicPaths = ['/login'];

// Add paths that require authentication but not project selection
const authOnlyPaths = ['/projects'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if the path is public
  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // Cookie-based demo auth used by the app
  const isAuthenticated = request.cookies.get('isAuthenticated')?.value === 'true';
  const user = request.cookies.get('user')?.value;
  const selectedProject = request.cookies.get('selectedProject')?.value;

  // If not authenticated and not on a public path, redirect to login
  if (!isAuthenticated || !user) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // For admin routes, check role from cookie
  if (pathname.startsWith('/admin')) {
    try {
      const userData = JSON.parse(user);
      if (userData.role !== 'admin') {
        const homeUrl = new URL('/', request.url);
        return NextResponse.redirect(homeUrl);
      }
    } catch (e) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Check if project selection is required
  // This applies to all routes except public paths, auth-only paths, and admin routes
  if (!authOnlyPaths.includes(pathname) && !pathname.startsWith('/admin') && !selectedProject) {
    const projectsUrl = new URL('/projects', request.url);
    return NextResponse.redirect(projectsUrl);
  }

  // For dashboard route, ensure both authentication and project selection
  if (pathname === '/dashboard' && (!isAuthenticated || !selectedProject)) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    } else {
      const projectsUrl = new URL('/projects', request.url);
      return NextResponse.redirect(projectsUrl);
    }
  }

  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}; 