import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { AppProviders } from '@/components/app-providers'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'
import { LANGUAGE_STORAGE_KEY } from '@/lib/preferences'

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
 const langBootScript = `
 (function () {
 try {
 var language = localStorage.getItem('${LANGUAGE_STORAGE_KEY}');
 document.documentElement.setAttribute('lang', language === 'sw' ? 'sw' : 'en');
 } catch (e) {}
 })();
 `;

 return (
 <html lang="en" className="bg-background">
 <body className="font-sans antialiased">
 <script dangerouslySetInnerHTML={{ __html: langBootScript }} />
 <AppProviders>{children}</AppProviders>
 <Toaster position="top-center" richColors expand closeButton />
 {process.env.NODE_ENV === 'production' && process.env.VERCEL === '1' ? <Analytics /> : null}
 </body>
 </html>
 )
}
