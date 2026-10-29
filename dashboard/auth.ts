// Sign-in. Google when AUTH_GOOGLE_ID is set (the owner's deployment), otherwise a single shared password
// from DASHBOARD_PASSWORD (the zero-setup path for a friend's copy). Either way only ALLOWED_EMAILS get in.
import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';

const allowed = (process.env.ALLOWED_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const hasGoogle = !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

const providers: NextAuthConfig['providers'] = [];
if (hasGoogle) providers.push(Google);
if (process.env.DASHBOARD_PASSWORD) providers.push(Credentials({
  name: 'Password',
  credentials: { email: { label: 'Email', type: 'email' }, password: { label: 'Password', type: 'password' } },
  authorize: async c => {
    const email = String(c?.email || '').toLowerCase();
    if (String(c?.password || '') !== process.env.DASHBOARD_PASSWORD) return null;
    if (allowed.length && !allowed.includes(email)) return null;
    return { id: email, email, name: email.split('@')[0] };
  },
}));

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  pages: { signIn: '/signin' },
  session: { strategy: 'jwt' },
  trustHost: true,
  callbacks: {
    signIn: async ({ user }) => {
      const email = (user.email || '').toLowerCase();
      return allowed.length ? allowed.includes(email) : false; // no allowlist means nobody gets in
    },
  },
});

export const authMode = hasGoogle ? 'google' : process.env.DASHBOARD_PASSWORD ? 'password' : 'none';
