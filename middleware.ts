import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/shared';

const publicRoutes = new Set(['/login']);
type MiddlewareCookie = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  let response = NextResponse.next();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet: MiddlewareCookie[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    response.cookies.set('app_user', encodeURIComponent(user.email), {
      path: '/',
      sameSite: 'lax',
    });
  } else {
    response.cookies.set('app_user', '', {
      path: '/',
      sameSite: 'lax',
      maxAge: 0,
    });
  }

  if (publicRoutes.has(pathname)) {
    return response;
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const redirectResponse = NextResponse.redirect(url);

    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    redirectResponse.cookies.set('app_user', '', {
      path: '/',
      sameSite: 'lax',
      maxAge: 0,
    });

    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: '/:path*',
};
