import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gatekeep — AI Call Screening',
  description: 'Only real calls get through.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-gatekeep-border bg-gatekeep-card/50 backdrop-blur">
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
              <a href="/" className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-gatekeep-accent to-indigo-400 flex items-center justify-center font-bold">G</span>
                <span className="font-semibold text-lg">Gatekeep</span>
                <span className="pill bg-gatekeep-accentSoft text-gatekeep-accent ml-2">Demo</span>
              </a>
              <nav className="flex items-center gap-2 text-sm">
                <a href="/" className="btn-ghost">Overview</a>
                <a href="/rules" className="btn-ghost">Rules</a>
                <a href="/calls" className="btn-ghost">Call Log</a>
                <a href="/simulator" className="btn-primary">Try Simulator</a>
              </nav>
            </div>
          </header>
          <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
