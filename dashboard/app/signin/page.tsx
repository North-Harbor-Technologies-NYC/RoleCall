import { signIn, authMode } from '@/auth';
import { Mark, Wordmark, NorthHarbor } from '@/components/Brand';

const LICENSE = process.env.SHOW_LICENSE; // e.g. "MIT" on the public copy; unset on a private instance

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith('/') ? sp.next : '/';
  return (
    <main className="signin">
      <div className="cols">
        <div>
          <Mark size={72} />
          <div className="word"><Wordmark /></div>
          <p className="tag">Every morning the roles report in. Sign in to see the ones that fit.</p>
        </div>
        <div className="card">
          <h2>Sign in</h2>
          {sp.error && <div className="notice notice-needs" style={{ marginBottom: 16 }}><b>Sign-in failed.</b> {sp.error === 'AccessDenied' ? 'That email is not on the allowed list.' : 'Try again.'}</div>}
          {authMode === 'google' && (
            <form action={async () => { 'use server'; await signIn('google', { redirectTo: next }); }}>
              <button className="btn btn-ink btn-block" type="submit" style={{ marginTop: 0 }}>Continue with Google</button>
            </form>
          )}
          {authMode === 'password' && (
            <form action={async (fd: FormData) => { 'use server'; await signIn('credentials', { email: String(fd.get('email') || ''), password: String(fd.get('password') || ''), redirectTo: next }); }}>
              <label className="field">Email<input type="email" name="email" required autoComplete="username" /></label>
              <label className="field">Password<input type="password" name="password" required autoComplete="current-password" /></label>
              <button className="btn btn-primary btn-block" type="submit">Sign in</button>
            </form>
          )}
          {authMode === 'none' && (
            <div className="notice notice-needs"><b>No sign-in method is configured.</b> Set <code>AUTH_GOOGLE_ID</code> and <code>AUTH_GOOGLE_SECRET</code>, or <code>DASHBOARD_PASSWORD</code>, plus <code>ALLOWED_EMAILS</code> and <code>AUTH_SECRET</code>, in the project&apos;s environment variables, then redeploy.</div>
          )}
        </div>
      </div>
      <div className="footer">
        <NorthHarbor className="nh" />
        {LICENSE ? <span>Open source under {LICENSE}</span> : <span />}
      </div>
    </main>
  );
}
