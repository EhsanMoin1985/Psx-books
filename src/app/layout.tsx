import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PrefsProvider } from '@/components/prefs';
import { FxBanner, Sidebar, TabBar, TopBar } from '@/components/nav';
import { loadView } from '@/lib/data/view';

export const metadata: Metadata = {
  title: { default: 'PSX Books', template: '%s · PSX Books' },
  description: 'Investment book for a Pakistan Stock Exchange portfolio held through JS Global Capital.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'PSX Books', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: { icon: '/icon.svg', apple: '/apple-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1f27' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const view = await loadView();
  const account = view.data.settings.statement?.source?.replace('JS InvestPro account statement, ', '') ?? 'JS Global Capital';

  return (
    <html lang="en-NZ" suppressHydrationWarning>
      <body>
        {/* Applied before paint so the page never flashes the wrong theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var p=JSON.parse(localStorage.getItem('psx-books:prefs')||'{}');if(p.theme&&p.theme!=='system')document.documentElement.setAttribute('data-theme',p.theme)}catch(e){}`,
          }}
        />
        <PrefsProvider fxRate={view.fxRate} fxAsOf={view.fxAsOf}>
          <div className="flex min-h-dvh">
            <Sidebar account={account} />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar pricedAt={view.pricedAt} mode={view.mode} />
              <FxBanner />
              <main className="flex-1 px-3 py-5 pb-24 md:px-6 md:pb-8" style={{ paddingLeft: 'max(0.75rem, env(safe-area-inset-left))', paddingRight: 'max(0.75rem, env(safe-area-inset-right))' }}>
                {children}
              </main>
            </div>
          </div>
          <TabBar />
        </PrefsProvider>
      </body>
    </html>
  );
}
