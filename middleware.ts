import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminJWT } from './src/lib/jwt';

const PUBLIC_PATHS = [
  '/signin',
  '/api/admin/login',
  '/_next',
  '/favicon.ico',
  '/favicon.png',
  '/favicon.svg',
  '/public',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get('admin_token')?.value;
  if (!token) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const signinUrl = new URL('/signin', req.url);
    return NextResponse.redirect(signinUrl);
  }

  try {
    verifyAdminJWT(token);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const signinUrl = new URL('/signin', req.url);
    return NextResponse.redirect(signinUrl);
  }
}

export const config = {
  matcher: [
    // Protect API routes for events, tiers, images
    '/api/events/:path*',
    '/api/tiers/:path*',
    '/api/images/:path*',
    // Protect admin pages (everything except signin)
    '/((?!_next|api/admin/login|signin|public|favicon.ico).*)',
  ],
};


