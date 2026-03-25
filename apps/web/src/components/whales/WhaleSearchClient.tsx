'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useWriteContract, useReadContract } from 'wagmi'
import { Star, UserPlus, UserMinus, ExternalLink } from 'lucide-react'
import { useConnectedAccount } from '@/lib/hooks/useConnectedAccount'
import { createClient } from '@/lib/supabase/client'
import { formatUsd, formatNumber, shortAddress } from '@/lib/utils'
import { FOLLOW_GRAPH_ABI, CONTRACT_ADDRESSES } from '@/lib/contracts'
import { cn } from '@/lib/utils'
import type { Wallet } from '@chainbook/shared'

const WHALE_MIN_USD = 100_000
const WHALE_MIN_REP = 100_000

export function WhaleSearchClient() {
  const supabase = createClient()
  const { isConnected, address: connectedAddress, handleConnect, requireConnection } = useConnectedAccount()
  const [input, setInput] = useState('')
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [isTracking, setIsTracking] = useState(false)

  const { writeContractAsync, isPending: isFollowPending } = useWriteContract()
  const [isFollowing, setIsFollowing] = useState(false)

  // Check if the connected wallet is following this profile
  useReadContract({
    address: CONTRACT_ADDRESSES.followGraph,
    abi: FOLLOW_GRAPH_ABI,
    functionName: 'isFollowing',
    args: connectedAddress && wallet
      ? [connectedAddress as `0x${string}`, wallet.address as `0x${string}`]
      : undefined,
    query: { enabled: !!connectedAddress && !!wallet },
    onSuccess: (data) => setIsFollowing(!!data),
  })

  async function handleSearch() {
    const addr = input.trim().toLowerCase()
    if (!addr) return
    setStatus('Searching...')
    const { data } = await supabase
      .from('wallets')
      .select('*')
      .eq('address', addr)
      .single()

    if (!data) {
      setWallet(null)
      setStatus('Wallet not found yet. Run the listener and try again.')
      return
    }

    setWallet(data as Wallet)
    setStatus(null)
  }

  async function handleTrack() {
    // Require connection before proceeding
    if (!requireConnection()) return
    if (!wallet) return
    setIsTracking(true)
    await supabase.from('tracked_entities').insert({
      tracker: connectedAddress!.toLowerCase(),
      entity_address: wallet.address,
      entity_type: 'WALLET',
    })
    setIsTracking(false)
  }

  async function handleFollow() {
    // Require connection before proceeding
    if (!requireConnection()) return
    if (!wallet || isFollowPending) return

    try {
      if (isFollowing) {
        await writeContractAsync({
          address: CONTRACT_ADDRESSES.followGraph,
          abi: FOLLOW_GRAPH_ABI,
          functionName: 'unfollow',
          args: [wallet.address as `0x${string}`],
        })
        setIsFollowing(false)
      } else {
        await writeContractAsync({
          address: CONTRACT_ADDRESSES.followGraph,
          abi: FOLLOW_GRAPH_ABI,
          functionName: 'follow',
          args: [wallet.address as `0x${string}`],
        })
        setIsFollowing(true)
      }
    } catch (err) {
      console.error('Follow action failed:', err)
    }
  }

  const isWhale =
    (wallet?.volume_usd ?? 0) >= WHALE_MIN_USD ||
    (wallet?.wallet_balance_usd ?? 0) >= WHALE_MIN_USD ||
    (wallet?.reputation_score ?? 0) >= WHALE_MIN_REP

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Image
          src="/assets/chainbook-icon.png"
          alt="Chainbook icon"
          width={20}
          height={20}
          className="h-5 w-5 rounded"
        />
        <h1 className="text-xl font-bold">Whale Search</h1>
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="0x..."
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
        >
          Search
        </button>
      </div>

      {status && (
        <p className="text-sm text-muted-foreground">{status}</p>
      )}

      {wallet && (
        <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-sm text-foreground">{shortAddress(wallet.address)}</div>
              {wallet.ens_name && (
                <p className="text-xs text-muted-foreground">{wallet.ens_name}</p>
              )}
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
              isWhale
                ? 'bg-whale/20 text-whale border border-whale/30'
                : 'bg-muted text-muted-foreground'
            }`}>
              {isWhale ? '🐳 Whale' : 'Not a whale'}
            </span>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="text-muted-foreground font-medium">Volume</div>
              <div className="text-foreground font-semibold mt-1">{formatUsd(wallet.volume_usd ?? 0)}</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="text-muted-foreground font-medium">Balance</div>
              <div className="text-foreground font-semibold mt-1">{formatUsd(wallet.wallet_balance_usd ?? 0)}</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="text-muted-foreground font-medium">Rep</div>
              <div className="text-foreground font-semibold mt-1">{formatNumber(wallet.reputation_score ?? 0)}</div>
            </div>
          </div>

          {/* Followers */}
          <div className="flex gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">Followers</span>
              <p className="font-semibold text-foreground">{formatNumber(wallet.follower_count ?? 0)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Following</span>
              <p className="font-semibold text-foreground">{formatNumber(wallet.following_count ?? 0)}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 flex-wrap">
            {!isConnected ? (
              <button
                onClick={handleConnect}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
              >
                Connect to interact
              </button>
            ) : (
              <>
                <button
                  onClick={handleTrack}
                  disabled={isTracking}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50',
                    'border border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  <Star className="w-4 h-4" />
                  Track
                </button>

                <button
                  onClick={handleFollow}
                  disabled={isFollowPending}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50',
                    isFollowing
                      ? 'border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  )}
                >
                  {isFollowing ? (
                    <>
                      <UserMinus className="w-4 h-4" />
                      Unfollow
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Follow
                    </>
                  )}
                </button>
              </>
            )}

            <Link
              href={`/wallet/${wallet.address}`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View Profile
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
