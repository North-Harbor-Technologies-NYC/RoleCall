import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Hanken_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { auth, signOut } from '@/auth';
import Nav from '@/components/Nav';
import { navCounts } from '@/lib/queries';

const sans = Hanken_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--rc-font', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--rc-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'RoleCall',
  description: 'Every morning the roles report in. The ones that fit are here.',
  icons: { icon: '/brand/rolecall-mark.svg', apple: '/brand/rolecall-mark.svg' },
};
export const viewport: Viewport = { themeColor: '#F5F1E9', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  let counts = { today: 0, needs: 0, feedNew: 0 };
  if (session?.user) { try { counts = await navCounts(); } catch { /* the page reports the database error */ } }
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        {session?.user ? (
          <div className="app" id="app">
            <Nav email={session.user.email || ''} counts={counts} signOutAction={async () => { 'use server'; await signOut({ redirectTo: '/signin' }); }} />
            {children}
          </div>
        ) : children}
      </body>
    </html>
  );
}
