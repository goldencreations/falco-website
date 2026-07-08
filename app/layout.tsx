import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { AppProviders } from '@/components/app-providers'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const siteUrl =
 process.env.NEXT_PUBLIC_SITE_URL ??
 (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

export const metadata: Metadata = {
 metadataBase: new URL(siteUrl),
 title: 'Falco Financial Services - Loan Management System',
 description: 'Internal loan management system for Falco Financial Services Ltd',
 generator: 'v0.app',
 icons: {
 icon: '/logo_falco.jpeg',
 shortcut: '/logo_falco.jpeg',
 apple: '/logo_falco.jpeg',
 },
 openGraph: {
 title: 'Falco Financial Services - Loan Management System',
 description: 'Internal loan management system for Falco Financial Services Ltd',
 images: [
 {
 url: '/logo_falco.jpeg',
 width: 1280,
 height: 853,
 alt: 'Falco Financial Services',
 },
 ],
 },
 twitter: {
 card: 'summary_large_image',
 title: 'Falco Financial Services - Loan Management System',
 description: 'Internal loan management system for Falco Financial Services Ltd',
 images: ['/logo_falco.jpeg'],
 },
}

export default function RootLayout({
 children,
}: Readonly<{
 children: React.ReactNode
}>) {
 return (
 <html lang="en" className="bg-background" suppressHydrationWarning>
 <body className="font-sans antialiased">
 <AppProviders>{children}</AppProviders>
 <Toaster position="top-center" richColors expand closeButton />
 {process.env.NODE_ENV === 'production' && process.env.VERCEL === '1' ? <Analytics /> : null}
 </body>
 </html>
 )
}
