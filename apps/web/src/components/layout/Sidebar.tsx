'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMobileLayout } from '@/lib/context/MobileLayoutContext'
import { useConnectedAccount } from '@/lib/hooks/useConnectedAccount'
import {
  Home,
  TrendingUp,
  Activity,
  User,
  Bell,
  LogIn,
  LogOut,
  UserCircle2,
  Search,
  Bot,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { WalletAvatar } from '@/components/wallet/WalletAvatar'

const NAV_ITEMS = [
  { href: '/',         icon: Home,       label: 'Feed'         },
  { href: '/trending', icon: TrendingUp, label: 'Trending'     },
  { href: '/pulse',    icon: Activity,   label: 'Pulse'        },
  { href: '/whales',   icon: Search,     label: 'Whale Search' },
  { href: '/agent',    icon: Bot,        label: 'AI Agent'     },
]

// ─── Wallet-dependent pieces ──────────────────────────────────────────────────
// Isolated into a child so wagmi hooks never run during WagmiProvider's Hydrate
// phase (which caused the setState-in-render error on Sidebar).

function SidebarMobileToggle({
  toggleSidebar,
  isSidebarOpen,
}: {
  toggleSidebar: () => void
  isSidebarOpen: boolean
}) {
  const { isConnected, address } = useConnectedAccount()

  return (
    <button
      onClick={toggleSidebar}
      title="Close account menu"
      aria-label="Close account menu"
      className={`rounded-full p-0.5 transition ${isSidebarOpen ? 'ring-2 ring-cyan-400/70' : ''}`}
    >
      {isConnected && address ? (
        <WalletAvatar address={address} size="sm" showName={false} linkable={false} />
      ) : (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card">
          <UserCircle2 className="h-5 w-5 text-muted-foreground" />
        </span>
      )}
    </button>
  )
}

function SidebarWalletSection({
  pathname,
  closeSidebar,
}: {
  pathname: string
  closeSidebar: () => void
}) {
  const {
    isConnected,
    address,
    isReady,
    isWaitingForConnection,
    handleConnect,
    handleLogout,
  } = useConnectedAccount()

  return (
    <div className="mt-auto flex flex-col gap-2 border-t border-border/70 pt-3">
      {isConnected && (
        <>
          <Link
            href={`/wallet/${address}`}
            onClick={closeSidebar}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              pathname === `/wallet/${address}`
                ? 'border border-cyan-400/35 bg-gradient-to-r from-cyan-500/25 via-blue-500/20 to-purple-500/20 text-cyan-100'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
          >
            <User className="h-4 w-4" />
            My Profile
          </Link>

          <Link
            href="/notifications"
            onClick={closeSidebar}
            className={cn(
              'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              pathname === '/notifications'
                ? 'border border-cyan-400/35 bg-gradient-to-r from-cyan-500/25 via-blue-500/20 to-purple-500/20 text-cyan-100'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
          >
            <Bell className="h-4 w-4" />
            <span className="flex-1">Notifications</span>
            <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />
          </Link>
        </>
      )}

      {isConnected && address ? (
        <div className="mt-1 rounded-2xl border border-border/70 bg-card/70 p-2">
          <Link
            href={`/wallet/${address}`}
            onClick={closeSidebar}
            className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-accent/50"
          >
            <WalletAvatar address={address} size="sm" showName={false} linkable={false} />
            <span className="min-w-0 truncate text-xs font-mono text-muted-foreground">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          </Link>
          <button
            onClick={() => {
              handleLogout()
              closeSidebar()
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            Disconnect
          </button>
        </div>
      ) : isWaitingForConnection ? (
        <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-center text-xs text-blue-300">
          Connecting...
        </div>
      ) : !isReady ? (
        <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-center text-xs text-muted-foreground">
          Loading...
        </div>
      ) : (
        <button
          onClick={handleConnect}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-cyan-600 hover:to-purple-600"
        >
          <LogIn className="h-4 w-4" />
          Connect Wallet
        </button>
      )}
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname()
  const { isSidebarOpen, closeSidebar, isMobile, toggleSidebar } = useMobileLayout()

  if (isMobile && !isSidebarOpen) return null

  return (
    <>
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/55 backdrop-blur-[2px]"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={cn(
          'glass-panel fixed left-3 top-3 z-40 flex h-[calc(100vh-1.5rem)] w-[17rem] flex-col rounded-3xl p-4',
          'transition-transform duration-300',
          isMobile && !isSidebarOpen && '-translate-x-[115%]',
          !isMobile && 'left-4 top-4 h-[calc(100vh-2rem)] w-56',
        )}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-2">
          <Link
            href="/"
            className="flex min-w-0 flex-1 items-center justify-center"
            onClick={closeSidebar}
          >
            <Image
              src="/assets/chainbook-logo-transparent-bg.png"
              alt="Chainbook"
              width={210}
              height={68}
              className="h-16 w-auto max-w-full"
              priority
            />
          </Link>

          {/* Mobile toggle — wagmi hooks live inside this child */}
          {isMobile && (
            <SidebarMobileToggle
              toggleSidebar={toggleSidebar}
              isSidebarOpen={isSidebarOpen}
            />
          )}
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-1.5">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              onClick={closeSidebar}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                pathname === href
                  ? 'border border-cyan-400/35 bg-gradient-to-r from-cyan-500/25 via-blue-500/20 to-purple-500/20 text-cyan-100'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Wallet section — wagmi hooks live inside this child */}
        <SidebarWalletSection pathname={pathname} closeSidebar={closeSidebar} />
      </aside>
    </>
  )
}
