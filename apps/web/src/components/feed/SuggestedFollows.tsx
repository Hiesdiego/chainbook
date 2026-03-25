'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { UserPlus, UserMinus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { followWallet, unfollowWallet } from '@/lib/api/follows'
import { WalletAvatar } from '@/components/wallet/WalletAvatar'
import { useConnectedAccount } from '@/lib/hooks/useConnectedAccount'
import { formatUsd, formatNumber, displayName, TIER_META } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Wallet, WalletTier } from '@chainbook/shared'

interface SuggestedFollowsProps {
  followingAddresses: string[]
  onFollowChange: (address: string, following: boolean) => void
}

export function SuggestedFollows({ followingAddresses, onFollowChange }: SuggestedFollowsProps) {
  const { address: connectedAddress, requireConnection, isWaitingForConnection } = useConnectedAccount()
  const supabase = createClient()
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [pendingAddresses, setPendingAddresses] = useState<Set<string>>(new Set())

  useEffect(() => {
    supabase
      .from('wallets')
      .select('*')
      .order('reputation_score', { ascending: false })
      .limit(12)
      .then(({ data }) => {
        const all = (data ?? []) as Wallet[]
        // Exclude self and already-followed
        const viewer = connectedAddress?.toLowerCase()
        const filtered = all.filter(
          (w) => w.address !== viewer && !followingAddresses.includes(w.address),
        )
        setWallets(filtered.slice(0, 6))
      })
  }, [connectedAddress])

  async function handleFollow(walletAddress: string) {
    if (!requireConnection()) return
    if (!connectedAddress || pendingAddresses.has(walletAddress)) return

    setPendingAddresses((prev) => new Set(prev).add(walletAddress))
    const follower = connectedAddress.toLowerCase()
    const subject = walletAddress.toLowerCase()
    const isFollowing = followingAddresses.includes(subject)

    try {
      if (isFollowing) {
        await unfollowWallet({ follower, subject })
        onFollowChange(subject, false)
      } else {
        await followWallet({ follower, subject })
        onFollowChange(subject, true)
      }
    } catch (err) {
      console.error('Follow error:', err)
    } finally {
      setPendingAddresses((prev) => {
        const next = new Set(prev)
        next.delete(walletAddress)
        return next
      })
    }
  }

  return (
    <div className="text-left py-4">
      {/* Heading */}
      <div className="text-center mb-6">
        <p className="text-3xl mb-2">🐋</p>
        <p className="text-base font-semibold text-foreground">You're not following any wallets</p>
        <p className="text-xs text-muted-foreground mt-1">
          Follow top traders to see their activity here
        </p>
      </div>

      {/* Suggested list */}
      <div className="flex flex-col gap-2">
        {wallets.map((wallet) => {
          const tier = (wallet.tier ?? 'SHRIMP') as WalletTier
          const tierMeta = TIER_META[tier]
          const addr = wallet.address.toLowerCase()
          const isFollowing = followingAddresses.includes(addr)
          const isPending = pendingAddresses.has(addr)

          return (
            <div
              key={wallet.address}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <WalletAvatar
                address={wallet.address}
                tier={tier}
                ensName={wallet.ens_name}
                label={wallet.label}
                size="sm"
              />

              <div className="flex flex-col min-w-0 flex-1">
                <Link
                  href={`/wallet/${wallet.address}`}
                  className="text-sm font-medium text-foreground hover:underline truncate"
                >
                  {displayName(wallet.address, wallet.ens_name, wallet.label)}
                </Link>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={tierMeta.color}>{tierMeta.emoji} {tierMeta.label}</span>
                  <span>·</span>
                  <span>{formatUsd(wallet.volume_usd ?? 0)} vol</span>
                  <span>·</span>
                  <span>{formatNumber(wallet.reputation_score ?? 0)} rep</span>
                </div>
              </div>

              <button
                onClick={() => handleFollow(wallet.address)}
                disabled={isPending || isWaitingForConnection}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 disabled:opacity-40',
                  isFollowing
                    ? 'border border-border text-muted-foreground hover:text-red-400 hover:border-red-400/30'
                    : 'bg-blue-500 hover:bg-blue-600 text-white',
                )}
              >
                {isFollowing ? (
                  <><UserMinus className="w-3 h-3" /> Following</>
                ) : (
                  <><UserPlus className="w-3 h-3" /> Follow</>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {wallets.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Loading suggestions...
        </p>
      )}
    </div>
  )
}
