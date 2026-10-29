'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Mark, Wordmark, NorthHarbor } from '@/components/Brand';

export type NavCounts = { today: number; needs: number; feedNew: number };
type Props = { email: string; counts: NavCounts; signOutAction: () => Promise<void> };

const ITEMS = [
  { href: '/', label: 'Today' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/feed', label: 'Feed' },
  { href: '/runs', label: 'Runs' },
] as const;

function Count({ href, counts, active }: { href: string; counts: NavCounts; active: boolean }) {
  if (href === '/' && counts.today > 0) return <span className="count pill-fit">{counts.today}</span>;
  if (href === '/pipeline' && counts.needs > 0) return <span className="count pill-needs">{counts.needs} stale</span>;
  if (href === '/feed' && counts.feedNew > 0) return <span className="count">{counts.feedNew} new</span>;
  void active;
  return null;
}

export default function Nav({ email, counts, signOutAction }: Props) {
  const p = usePathname();
  const is = (h: string) => (h === '/' ? p === '/' || p.startsWith('/jobs') : p.startsWith(h));
  return (
    <>
      <aside className="side">
        <Link href="/" className="brand"><Mark size={28} /><span><Wordmark /></span></Link>
        <details className="account">
          <summary>{email.split('@')[0]} <span aria-hidden="true">▾</span></summary>
          <div className="menu">
            <div className="email">{email}</div>
            <form action={signOutAction}><button className="btn btn-ghost btn-sm" type="submit">Sign out</button></form>
          </div>
        </details>
        <nav aria-label="Main">
          {ITEMS.map(it => (
            <Link key={it.href} href={it.href} className={`navitem ${is(it.href) ? 'active' : ''}`} aria-current={is(it.href) ? 'page' : undefined}>
              <span>{it.label}</span>
              <Count href={it.href} counts={counts} active={is(it.href)} />
            </Link>
          ))}
        </nav>
        <div className="foot">
          <div className="builtby">Built by</div>
          <NorthHarbor className="nh" />
        </div>
      </aside>
      <header className="topbar">
        <div className="row1">
          <Link href="/" className="brand"><Mark size={24} /><span><Wordmark /></span></Link>
          {counts.needs > 0 ? <Link href="/pipeline" className="chip chip-needs" style={{ textDecoration: 'none' }}>{counts.needs} stale</Link> : (
            <form action={signOutAction}><button className="btn btn-ghost btn-sm" type="submit">Sign out</button></form>
          )}
        </div>
        <nav className="tabs" aria-label="Main">
          {ITEMS.map(it => (
            <Link key={it.href} href={it.href} className={is(it.href) ? 'active' : ''} aria-current={is(it.href) ? 'page' : undefined}>
              {it.label}
              {it.href === '/' && counts.today > 0 ? <span className="count">{counts.today}</span> : null}
              {it.href === '/feed' && counts.feedNew > 0 ? <span className="count">{counts.feedNew}</span> : null}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
