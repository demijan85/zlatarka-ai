import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicRoutes = new Set(['/login']);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  if (publicRoutes.has(pathname)) {
    return NextResponse.next();
  }

  const session = request.cookies.get('app_session')?.value;
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
