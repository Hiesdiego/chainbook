'use client'

import Image from 'next/image'
import Link from 'next/link'
import { UserCircle2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { ThemeToggle } from './ThemeToggle'
import { WhaleRadar } from './WhaleRadar'
import { WalletRecommendations } from '@/components/recommendations/WalletRecommendations'
import { PriorityAlerts } from '@/components/notifications/PriorityAlerts'
import { useMobileLayout } from '@/lib/context/MobileLayoutContext'
import { useConnectedAccount } from '@/lib/hooks/useConnectedAccount'
import { WalletAvatar } from '@/components/wallet/WalletAvatar'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isMobile, toggleSidebar, isSidebarOpen } = useMobileLayout()
  const { isConnected, address } = useConnectedAccount()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return <div className="min-h-screen" />

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed -left-20 top-16 z-0 h-72 w-72 rounded-full brand-orb-cyan opacity-30 blur-2xl" />
      <div className="pointer-events-none fixed right-0 top-40 z-0 h-80 w-80 rounded-full brand-orb-magenta opacity-25 blur-2xl" />
      <div className="pointer-events-none fixed bottom-8 left-1/3 z-0 h-72 w-72 rounded-full brand-orb-purple opacity-20 blur-2xl" />

      <Sidebar />

      <div className="relative z-10">
        {isMobile && (
          <header className="sticky top-0 z-30 mx-3 mt-3 rounded-2xl glass-panel px-3 py-2.5 md:hidden">
            <div className="flex items-center justify-between gap-2">
              <Link href="/" className="flex min-w-0 items-center">
                <Image
                  src="/assets/chainbook-logo-transparent-bg.png"
                  alt="Chainbook"
                  width={178}
                  height={52}
                  className="h-10 w-auto"
                />
              </Link>

              <div className="flex items-center gap-2">
                <ThemeToggle />
                <button
                  onClick={toggleSidebar}
                  className={`rounded-full p-0.5 transition ${isSidebarOpen ? 'ring-2 ring-cyan-400/70' : ''}`}
                  title="Open account menu"
                  aria-label="Open account menu"
                >
                  {isConnected && address ? (
                    <WalletAvatar address={address} size="sm" showName={false} linkable={false} />
                  ) : (
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card">
                      <UserCircle2 className="h-5 w-5 text-muted-foreground" />
                    </span>
                  )}
                </button>
              </div>
            </div>
          </header>
        )}

        <main
          className={[
            'mx-auto max-w-3xl px-3 pb-6 pt-4 sm:px-5',
            isMobile ? '' : 'lg:mr-[23rem] lg:ml-64 lg:px-6 lg:pt-6',
          ].join(' ')}
        >
          {children}
        </main>
      </div>

      {!isMobile && (
        <aside className="glass-panel fixed right-4 top-4 z-20 hidden h-[calc(100vh-2rem)] w-[21.5rem] rounded-3xl border lg:flex lg:flex-col">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <p className="text-sm font-semibold text-gradient-brand">Live Intelligence</p>
            <ThemeToggle />
          </div>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <PriorityAlerts />
            <WalletRecommendations />
            <WhaleRadar />
          </div>
        </aside>
      )}
    </div>
  )
}
