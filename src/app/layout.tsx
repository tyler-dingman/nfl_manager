import type { Metadata, Viewport } from 'next';
import AppProviders from '@/components/app-providers';
import SiteFooter from '@/components/site-footer';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export const metadata: Metadata = {
  title: 'Down & Distance',
  description:
    'Keep it high and tight. News, video, fan conversation, roster context, and tools for every NFL fan.',
  icons: {
    icon: [
      { url: '/images/favicon/favicon-32x32.png?v=20260919', sizes: '32x32', type: 'image/png' },
      { url: '/images/favicon/favicon-16x16.png?v=20260919', sizes: '16x16', type: 'image/png' },
      { url: '/images/favicon/favicon-96x96.png?v=20260919', sizes: '96x96', type: 'image/png' },
    ],
    apple: '/images/favicon/apple-touch-icon.png?v=20260919',
    shortcut: '/images/favicon/favicon-32x32.png?v=20260919',
  },
  manifest: '/images/favicon/site.webmanifest',
  ...(process.env.PRELAUNCH_MODE === 'true'
    ? {
        robots: {
          index: false,
          follow: false,
          noarchive: true,
          googleBot: { index: false, follow: false, noarchive: true },
        },
      }
    : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/images/favicon/favicon-32x32.png?v=20260919"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/images/favicon/favicon-16x16.png?v=20260919"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="96x96"
          href="/images/favicon/favicon-96x96.png?v=20260919"
        />
        <link rel="shortcut icon" href="/images/favicon/favicon-32x32.png?v=20260919" />
        <link rel="apple-touch-icon" href="/images/favicon/apple-touch-icon.png?v=20260919" />
        <link rel="manifest" href="/images/favicon/site.webmanifest" />
        <meta name="theme-color" content="#FF3D38" />
      </head>
      <body className="min-h-screen overflow-x-hidden bg-background text-foreground antialiased">
        <AppProviders>
          {children}
          <SiteFooter />
        </AppProviders>
      </body>
    </html>
  );
}
