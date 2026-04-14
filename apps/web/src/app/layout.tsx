import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Providers } from '@/components/providers/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Chainbook — The Social Network for Blockchain Activity',
  description:
    'Blockchain events become posts. Wallets become profiles. Transactions become conversations.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  icons: {
    icon: '/assets/favicon.ico',
    shortcut: '/assets/favicon-32x32.png',
    apple: '/assets/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Chainbook',
    description: 'The Social Network for Blockchain Activity on Somnia.',
    images: ['/assets/chainbook-logo-black-bg.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning  
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased bg-background text-foreground min-h-screen`}
      >
      
        <Providers>
          {children}
        </Providers>
      <script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "987e3834be3945e39393aa3eef491cac"}'></script>
      </body>
    </html>
  )
}
