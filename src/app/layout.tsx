import type { Metadata } from 'next';
import AppProviders from '@/components/app-providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Down & Distance',
  description:
    'Keep it high and tight. News, video, fan conversation, roster context, and tools for every NFL fan.',
  icons: {
    icon: [
      { url: '/images/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/images/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/images/favicon/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: '/images/favicon/apple-touch-icon.png',
    shortcut: '/images/favicon/favicon-32x32.png',
  },
  manifest: '/images/favicon/site.webmanifest',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/images/favicon/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/images/favicon/favicon-96x96.png" />
        <link rel="shortcut icon" href="/images/favicon/favicon-32x32.png" />
        <link rel="apple-touch-icon" href="/images/favicon/apple-touch-icon.png" />
        <link rel="manifest" href="/images/favicon/site.webmanifest" />
        <meta name="theme-color" content="#FF3D38" />
      </head>
      <body className="min-h-screen overflow-x-hidden bg-background text-foreground antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
