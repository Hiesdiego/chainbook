'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { createClient } from '@/lib/supabase/client'
import { shortAddress } from '@/lib/utils'
import type { Wallet } from '@chainbook/shared'

export function WalletRecommendations() {
  const supabase = createClient()
  const { address: wagmiAddress } = useAccount()
  const { user } = usePrivy()
  const viewerAddress = wagmiAddress ?? user?.wallet?.address
  const [recommended, setRecommended] = useState<Wallet[]>([])

  useEffect(() => {
    let isMounted = true

    async function fetchRecommendations() {
      const { data: topWallets } = await supabase
        .from('wallets')
        .select('*')
        .order('reputation_score', { ascending: false })
        .limit(12)

      let filtered = (topWallets ?? []) as Wallet[]

      if (viewerAddress) {
        const { data: follows } = await supabase
          .from('follows')
          .select('subject')
          .eq('follower', viewerAddress.toLowerCase())
        const followed = new Set((follows ?? []).map((f) => f.subject))
        filtered = filtered.filter((w) => !followed.has(w.address) && w.address !== viewerAddress.toLowerCase())
      }

      if (isMounted) setRecommended(filtered.slice(0, 8))
    }

    void fetchRecommendations()
    const pollId = setInterval(fetchRecommendations, 60_000)

    return () => {
      isMounted = false
      clearInterval(pollId)
    }
  }, [viewerAddress])

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold mb-3">Who To Follow</h3>
      {recommended.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          Gathering recommendations...
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {recommended.map((wallet) => (
            <Link
              key={wallet.address}
              href={`/wallet/${wallet.address}`}
              className="flex items-center justify-between text-xs text-muted-foreground hover:text-foreground"
            >
              <span className="font-mono">{shortAddress(wallet.address)}</span>
              <span className="text-xs text-muted-foreground">
                Rep {Math.round(wallet.reputation_score)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
