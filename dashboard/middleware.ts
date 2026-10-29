// Everything needs a session except sign-in, the auth routes, and the ingest API (bearer token, checked in the route).
import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth(req => {
  const { pathname } = req.nextUrl;
  const open = pathname.startsWith('/api/auth') || pathname.startsWith('/api/ingest') || pathname === '/signin' || pathname.startsWith('/_next') || pathname === '/favicon.ico' || pathname.startsWith('/brand/') || /^\/(favicon-32|icon-512|apple-touch-icon)\.png$/.test(pathname);
  if (open) return NextResponse.next();
  if (!req.auth) {
    const url = req.nextUrl.clone(); url.pathname = '/signin'; url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/|favicon-32.png|icon-512.png|apple-touch-icon.png).*)'] };
