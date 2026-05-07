import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'
import { LANGUAGE_STORAGE_KEY, THEME_STORAGE_KEY } from '@/lib/preferences'

export const metadata: Metadata = {
  title: 'Falco Financial Services - Loan Management System',
  description: 'Internal loan management system for Falco Financial Services Ltd',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const preferenceBootScript = `
    (function () {
      try {
        var themeMode = localStorage.getItem('${THEME_STORAGE_KEY}');
        var language = localStorage.getItem('${LANGUAGE_STORAGE_KEY}');
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        var resolved = themeMode === 'dark' || (themeMode !== 'light' && prefersDark);
        document.documentElement.classList.toggle('dark', resolved);
        document.documentElement.setAttribute('lang', language === 'sw' ? 'sw' : 'en');
      } catch (e) {}
    })();
  `;

  return (
    <html lang="en" className="bg-background">
      <body className="font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: preferenceBootScript }} />
        {children}
        <Toaster position="top-center" richColors expand closeButton />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
