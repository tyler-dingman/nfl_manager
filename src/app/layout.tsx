import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Falco',
  description: 'Offseason football management',
  icons: {
    icon: [
      { url: '/images/favicon/favicon.ico' },
      { url: '/images/favicon/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/images/favicon/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/images/favicon/apple-touch-icon.png',
    shortcut: '/images/favicon/favicon.ico',
  },
  manifest: '/images/favicon/site.webmanifest',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
