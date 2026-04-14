'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { UserPlus, UserMinus, ExternalLink, Bell, Star, Copy, X } from 'lucide-react'
import { PostCard } from '@/components/feed/PostCard'
import { WalletAvatar } from '@/components/wallet/WalletAvatar'
import { useConnectedAccount } from '@/lib/hooks/useConnectedAccount'
import { formatUsd, formatNumber, shortAddress, displayName, TIER_META, walletUrl, isNativeToken } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { followWallet, unfollowWallet } from '@/lib/api/follows'
import type { Post, Wallet, WalletTier, MintedToken, WalletTokenHolding } from '@chainbook/shared'

const TABS = ['Activity', 'Minted', 'Tokens'] as const
type Tab = (typeof TABS)[number]

interface WalletProfileClientProps {
  wallet: Wallet | null
  address: string
  posts: Post[]
  followerCount: number
  followingCount: number
  mintedTokens: MintedToken[]
  tokenHoldings: WalletTokenHolding[]
}

export function WalletProfileClient({
  wallet,
  address,
  posts,
  followerCount,
  followingCount,
  mintedTokens,
  tokenHoldings,
}: WalletProfileClientProps) {
  const { isConnected, address: connectedAddress, requireConnection, isWaitingForConnection, handleConnect } = useConnectedAccount()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<Tab>('Activity')
  const [localFollowerCount, setLocalFollowerCount] = useState(followerCount)
  const [localFollowingCount, setLocalFollowingCount] = useState(followingCount)
  const [isFollowing, setIsFollowing] = useState(false)
  const [isFollowPending, setIsFollowPending] = useState(false)
  const [isTracked, setIsTracked] = useState(false)
  const [isAlerted, setIsAlerted] = useState(false)
  const [isSavingTrack, setIsSavingTrack] = useState(false)
  const [isSavingAlert, setIsSavingAlert] = useState(false)
  const [showFollowingModal, setShowFollowingModal] = useState(false)
  const [followingList, setFollowingList] = useState<{ address: string; label?: string | null; ens_name?: string | null }[]>([])

  const mintedList = mintedTokens

  // Inject STT (native balance) as the first holding if the wallet has a USD balance recorded
  const sttHolding: WalletTokenHolding | null =
    wallet?.wallet_balance_usd != null && wallet.wallet_balance_usd > 0
      ? {
          wallet_address: address,
          token_address: '0x0000000000000000000000000000000000000000',
          token_symbol: 'STT',
          token_name: 'Somnia Token',
          balance_raw: null,
          decimals: 18,
          balance_usd: wallet.wallet_balance_usd,
          updated_at: wallet.updated_at,
        }
      : null

  const holdingsList: WalletTokenHolding[] = [
    ...(sttHolding ? [sttHolding] : []),
    ...tokenHoldings,
  ]

  const isOwnProfile = connectedAddress?.toLowerCase() === address.toLowerCase()
  const tier = (wallet?.tier ?? 'SHRIMP') as WalletTier
  const tierMeta = TIER_META[tier]
  const totalTokensHeld = holdingsList.length
  const totalMinted = mintedList.length

  // For own profile: load the list of wallets this address follows (for the modal)
  useEffect(() => {
    if (!isOwnProfile) return
    supabase
      .from('follows')
      .select('subject')
      .eq('follower', address.toLowerCase())
      .then(async ({ data: followData }) => {
        const subjects = (followData ?? []).map((r: any) => r.subject as string)
        let walletMap = new Map<string, { label?: string | null; ens_name?: string | null }>()
        if (subjects.length > 0) {
          const { data: wallets } = await supabase
            .from('wallets')
            .select('address, label, ens_name')
            .in('address', subjects)
          walletMap = new Map((wallets ?? []).map((w: any) => [w.address, w]))
        }
        const list = subjects.map((addr: string) => ({
          address: addr,
          label: walletMap.get(addr)?.label ?? null,
          ens_name: walletMap.get(addr)?.ens_name ?? null,
        }))
        setFollowingList(list)
        setLocalFollowingCount(list.length)
      })
  }, [isOwnProfile, address])

  // Check follow status from Supabase
  useEffect(() => {
    if (!connectedAddress || isOwnProfile) {
      setIsFollowing(false)
      return
    }
    supabase
      .from('follows')
      .select('subject')
      .eq('follower', connectedAddress.toLowerCase())
      .eq('subject', address.toLowerCase())
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setIsFollowing(!!data))
  }, [connectedAddress, address, isOwnProfile])

  useEffect(() => {
    if (!connectedAddress || isOwnProfile) return
    const tracker = connectedAddress.toLowerCase()
    const target = address.toLowerCase()

    supabase
      .from('tracked_entities')
      .select('tracker')
      .eq('tracker', tracker)
      .eq('entity_address', target)
      .eq('entity_type', 'WALLET')
      .limit(1)
      .single()
      .then(({ data, error }) => {
        setIsTracked(!!data && !error)
      })

    supabase
      .from('alert_subscriptions')
      .select('id')
      .eq('wallet_address', tracker)
      .eq('target_address', target)
      .eq('alert_type', 'ANY_ACTIVITY')
      .limit(1)
      .single()
      .then(({ data, error }) => {
        setIsAlerted(!!data && !error)
      })
  }, [connectedAddress, address, isOwnProfile, supabase])

  async function handleFollow() {
    if (!requireConnection()) return
    if (isFollowPending || isWaitingForConnection) return

    const follower = connectedAddress!.toLowerCase()
    const subject = address.toLowerCase()
    setIsFollowPending(true)

    try {
      if (isFollowing) {
        await unfollowWallet({ follower, subject })
        setIsFollowing(false)
        setLocalFollowerCount((c) => Math.max(0, c - 1))
      } else {
        await followWallet({ follower, subject })
        setIsFollowing(true)
        setLocalFollowerCount((c) => c + 1)
      }
    } catch (err) {
      console.error('Follow action failed:', err)
    } finally {
      setIsFollowPending(false)
    }
  }

  async function handleTrack() {
    if (!requireConnection() || isSavingTrack || isOwnProfile || !connectedAddress) return
    if (isWaitingForConnection) return

    setIsSavingTrack(true)
    const tracker = connectedAddress.toLowerCase()
    const target = address.toLowerCase()
    try {
      if (isTracked) {
        await supabase
          .from('tracked_entities')
          .delete()
          .eq('tracker', tracker)
          .eq('entity_address', target)
          .eq('entity_type', 'WALLET')
        setIsTracked(false)
      } else {
        await supabase.from('tracked_entities').insert({
          tracker,
          entity_address: target,
          entity_type: 'WALLET',
        })
        setIsTracked(true)
      }
    } catch (err) {
      console.error('Track action failed:', err)
    } finally {
      setIsSavingTrack(false)
    }
  }

  async function handleAlert() {
    if (!requireConnection() || isSavingAlert || isOwnProfile || !connectedAddress) return
    setIsSavingAlert(true)
    const tracker = connectedAddress.toLowerCase()
    const target = address.toLowerCase()
    try {
      if (isAlerted) {
        await supabase
          .from('alert_subscriptions')
          .delete()
          .eq('wallet_address', tracker)
          .eq('target_address', target)
          .eq('alert_type', 'ANY_ACTIVITY')
        setIsAlerted(false)
      } else {
        await supabase.from('alert_subscriptions').insert({
          wallet_address: tracker,
          target_address: target,
          alert_type: 'ANY_ACTIVITY',
          threshold_usd: null,
        })
        setIsAlerted(true)
      }
    } catch (err) {
      console.error('Alert action failed:', err)
    } finally {
      setIsSavingAlert(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Profile header */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 flex flex-col gap-4">

        {/* ── Avatar row + action buttons ─────────────────────────────────── */}
        <div className="flex items-start justify-between gap-2">
          <WalletAvatar
            address={address}
            tier={tier}
            ensName={wallet?.ens_name}
            label={wallet?.label}
            size="lg"
            showName
            linkable={false}
          />

          {/* Action buttons — icon-only on mobile, icon + label on sm+ */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap justify-end">
            {/* Explorer link */}
            <a
              href={walletUrl(address)}
              target="_blank"
              rel="noopener noreferrer"
              title="View on explorer"
              className="p-2 rounded-lg border border-border hover:bg-accent transition-colors"
            >
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </a>

            {/* Track button */}
            {!isOwnProfile && (isConnected || isWaitingForConnection) && (
              <button
                onClick={handleTrack}
                disabled={isSavingTrack || isWaitingForConnection}
                title={isTracked ? 'Untrack' : 'Track'}
                className={cn(
                  'flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50',
                  isTracked
                    ? 'border border-border text-foreground hover:bg-accent'
                    : 'border border-border text-muted-foreground hover:text-foreground hover:bg-accent',
                )}
              >
                <Star className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{isTracked ? 'Tracking' : 'Track'}</span>
              </button>
            )}

            {/* Alert button */}
            {!isOwnProfile && (isConnected || isWaitingForConnection) && (
              <button
                onClick={handleAlert}
                disabled={isSavingAlert || isWaitingForConnection}
                title={isAlerted ? 'Remove alert' : 'Set alert'}
                className={cn(
                  'flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50',
                  isAlerted
                    ? 'border border-blue-500 text-blue-500 hover:bg-blue-500/10'
                    : 'border border-border text-muted-foreground hover:text-foreground hover:bg-accent',
                )}
              >
                <Bell className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{isAlerted ? 'Alerting' : 'Alert'}</span>
              </button>
            )}

            {/* Follow / Unfollow button */}
            {!isOwnProfile && (
              isConnected || isWaitingForConnection ? (
                <button
                  onClick={handleFollow}
                  disabled={isFollowPending || isWaitingForConnection}
                  title={isFollowing ? 'Unfollow' : 'Follow'}
                  className={cn(
                    'flex items-center gap-1.5 px-2 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50',
                    isFollowing
                      ? 'border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30'
                      : 'bg-blue-500 hover:bg-blue-600 text-white',
                  )}
                >
                  {isFollowing ? (
                    <>
                      <UserMinus className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline">Unfollow</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline">Follow</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleConnect}
                  className="flex items-center gap-1.5 px-2 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-blue-500 hover:bg-blue-600 text-white"
                >
                  <UserPlus className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Connect to Follow</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 pt-2 border-t border-border">
          <Stat label="Volume" value={formatUsd(wallet?.volume_usd ?? 0)} />
          <Stat label="Rep Score" value={formatNumber(wallet?.reputation_score ?? 0)} />
          <Stat label="Followers" value={formatNumber(localFollowerCount)} />
          {isOwnProfile ? (
            <button
              onClick={() => setShowFollowingModal(true)}
              className="flex flex-col text-left hover:opacity-70 transition-opacity"
            >
              <span className="text-lg font-bold text-foreground">{formatNumber(localFollowingCount)}</span>
              <span className="text-xs text-blue-400 underline underline-offset-2">Following</span>
            </button>
          ) : (
            <Stat label="Following" value={formatNumber(localFollowingCount)} />
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Tokens Held" value={formatNumber(totalTokensHeld)} />
          <Stat label="Tokens Minted" value={formatNumber(totalMinted)} />
        </div>

        {/* Tier badge */}
        <div className="flex gap-2 items-start flex-wrap">
          <div
            className={cn(
              'inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border self-start',
              tierMeta.bgColor,
              tierMeta.color,
            )}
          >
            <span>{tierMeta.emoji}</span>
            <span className="font-medium">{tierMeta.label}</span>
          </div>

          {/* Contract type badge */}
          {wallet?.contract_type && (
            <div
              className={cn(
                'inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border self-start',
                {
                  'bg-yellow-500/10 border-yellow-500/30 text-yellow-400': wallet.contract_type === 'PROXY',
                  'bg-blue-500/10 border-blue-500/30 text-blue-400': wallet.contract_type === 'TOKEN',
                  'bg-purple-500/10 border-purple-500/30 text-purple-400': wallet.contract_type === 'NFT',
                }
              )}
            >
              <span className="font-medium">
                {wallet.contract_type === 'PROXY' && '🔗 Proxy Contract'}
                {wallet.contract_type === 'TOKEN' && '💰 Token Contract'}
                {wallet.contract_type === 'NFT' && '🖼️ NFT Contract'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === tab
                ? 'border-blue-400 text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'Activity' && (
        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          {posts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No activity yet
            </p>
          )}
        </div>
      )}

      {activeTab === 'Minted' && (
        <div className="flex flex-col gap-3">
          {mintedList.map((minted) => (
            <div
              key={`${minted.token_address}-${minted.tx_hash}-${minted.kind}`}
              className="rounded-xl border border-border bg-card p-4 flex items-center justify-between"
            >
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">
                  {minted.kind === 'CREATED' ? 'Created token' : 'Minted token'}
                </span>
                <a
                  href={`/wallet/${minted.token_address}`}
                  className="text-sm font-mono text-muted-foreground hover:text-foreground"
                >
                  {minted.token_symbol ?? shortAddress(minted.token_address)}
                </a>
              </div>
              <span className="text-xs text-muted-foreground">
                {minted.kind}
              </span>
            </div>
          ))}
          {mintedList.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No minted or created tokens yet
            </p>
          )}
        </div>
      )}

      {activeTab === 'Tokens' && (
        <TokensTab holdingsList={holdingsList} />
      )}

      {/* Following modal — own profile only */}
      {showFollowingModal && (
        <FollowingModal
          followingList={followingList}
          onUnfollow={async (targetAddress: string) => {
            if (!connectedAddress) return
            await unfollowWallet({
              follower: connectedAddress.toLowerCase(),
              subject: targetAddress.toLowerCase(),
            })
            setFollowingList((prev) => prev.filter((w) => w.address !== targetAddress))
            setLocalFollowingCount((c) => Math.max(0, c - 1))
          }}
          onClose={() => setShowFollowingModal(false)}
        />
      )}
    </div>
  )
}

function TokensTab({ holdingsList }: { holdingsList: WalletTokenHolding[] }) {
  const [selectedHolding, setSelectedHolding] = useState<WalletTokenHolding | null>(null)

  return (
    <>
      <div className="flex flex-col gap-3">
        {holdingsList.map((holding) => (
          <button
            key={`${holding.token_address}`}
            onClick={() => setSelectedHolding(holding)}
            className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:bg-card/80 transition-colors text-left"
          >
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-foreground">
                {holding.token_symbol ?? 'Unknown Token'}
              </span>
              {holding.token_name && (
                <span className="text-xs text-muted-foreground truncate">{holding.token_name}</span>
              )}
              <span className="text-xs text-muted-foreground mt-1">
                {formatTokenAmount(holding.balance_raw, holding.decimals)}
              </span>
            </div>
            <div className="text-right shrink-0 ml-4">
              {holding.balance_usd != null && isNativeToken(holding.token_symbol) && (
                <div className="text-sm font-semibold text-foreground">
                  {formatUsd(holding.balance_usd)}
                </div>
              )}
            </div>
          </button>
        ))}
        {holdingsList.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No token holdings recorded yet
          </p>
        )}
      </div>

      {/* Token Details Modal */}
      {selectedHolding && (
        <TokenDetailsModal
          holding={selectedHolding}
          onClose={() => setSelectedHolding(null)}
        />
      )}
    </>
  )
}

interface TokenDetailsModalProps {
  holding: WalletTokenHolding
  onClose: () => void
}

function TokenDetailsModal({ holding, onClose }: TokenDetailsModalProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="rounded-xl border border-border bg-background max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {holding.token_symbol ?? 'Token'}
            </h2>
            {holding.token_name && (
              <p className="text-xs text-muted-foreground">{holding.token_name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Amount */}
          <div>
            <span className="text-xs font-medium text-muted-foreground">Amount Held</span>
            <p className="text-lg font-semibold text-foreground mt-1">
              {formatTokenAmount(holding.balance_raw, holding.decimals)}
            </p>
          </div>

          {/* Value */}
          {holding.balance_usd != null && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                {isNativeToken(holding.token_symbol) ? 'Value (USD)' : 'Balance (USD)'}
              </span>
              <p className="text-lg font-semibold text-foreground mt-1">
                {formatUsd(holding.balance_usd)}
              </p>
            </div>
          )}

          {/* Contract Address */}
          <div>
            <span className="text-xs font-medium text-muted-foreground">Contract Address</span>
            <div className="mt-1 flex items-center gap-2 bg-muted p-2 rounded-lg">
              <span className="text-xs font-mono text-foreground flex-1 truncate">
                {shortAddress(holding.token_address, 6)}
              </span>
              <button
                onClick={() => handleCopy(holding.token_address, 'contract')}
                className="p-1 hover:bg-accent rounded transition-colors"
              >
                <Copy className="w-3 h-3 text-muted-foreground" />
              </button>
              {copied === 'contract' && (
                <span className="text-xs text-green-400">Copied!</span>
              )}
            </div>
          </div>

          {/* Token Symbol */}
          {holding.token_symbol && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Symbol</span>
              <p className="text-sm text-foreground mt-1">{holding.token_symbol}</p>
            </div>
          )}

          {/* Decimals */}
          <div>
            <span className="text-xs font-medium text-muted-foreground">Decimals</span>
            <p className="text-sm text-foreground mt-1">{holding.decimals}</p>
          </div>

          {/* View on Explorer */}
          <a
            href={`https://shannon-explorer.somnia.network/address/${holding.token_address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 mt-4 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors text-sm text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="w-4 h-4" />
            View on Explorer
          </a>
        </div>
      </div>
    </div>
  )
}

interface FollowingModalProps {
  followingList: { address: string; label?: string | null; ens_name?: string | null }[]
  onUnfollow: (address: string) => Promise<void>
  onClose: () => void
}

function FollowingModal({ followingList, onUnfollow, onClose }: FollowingModalProps) {
  const [pendingUnfollow, setPendingUnfollow] = useState<string | null>(null)

  async function handleUnfollow(address: string) {
    setPendingUnfollow(address)
    try {
      await onUnfollow(address)
    } finally {
      setPendingUnfollow(null)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="rounded-xl border border-border bg-background max-w-sm w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h2 className="text-sm font-bold">Wallets You Follow</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded-lg transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto p-4 flex flex-col gap-2">
          {followingList.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              You're not following anyone yet
            </p>
          )}
          {followingList.map((w) => (
            <div
              key={w.address}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <WalletAvatar address={w.address} size="sm" linkable />
              <Link
                href={`/wallet/${w.address}`}
                className="flex-1 text-sm font-medium text-foreground hover:underline truncate"
                onClick={onClose}
              >
                {displayName(w.address, w.ens_name, w.label)}
              </Link>
              <button
                onClick={() => handleUnfollow(w.address)}
                disabled={pendingUnfollow === w.address}
                className="text-xs text-muted-foreground hover:text-red-400 border border-border hover:border-red-400/30 px-2 py-1 rounded-lg transition-colors disabled:opacity-40"
              >
                {pendingUnfollow === w.address ? '…' : 'Unfollow'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-bold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function scientificToInteger(s: string): string {
  // Convert scientific notation like "9.938116608191584e+26" to a plain integer string
  const lower = s.toLowerCase()
  if (!lower.includes('e')) return s
  const eIdx = lower.indexOf('e')
  const mantissa = lower.slice(0, eIdx)
  const exp = parseInt(lower.slice(eIdx + 1), 10)
  const dotIdx = mantissa.indexOf('.')
  const digits = mantissa.replace('.', '')
  const intDigits = dotIdx === -1 ? digits.length : dotIdx
  const totalIntDigits = intDigits + exp
  if (totalIntDigits >= digits.length) {
    return digits + '0'.repeat(totalIntDigits - digits.length)
  } else if (totalIntDigits <= 0) {
    return '0'
  }
  return digits.slice(0, totalIntDigits)
}

function formatTokenAmount(balanceRaw?: string | null, decimals?: number | null): string {
  if (!balanceRaw) return '—'
  const dec = decimals ?? 18
  try {
    const normalized = scientificToInteger(balanceRaw.trim())
    const raw = normalized.replace(/^0+/, '') || '0'
    if (dec === 0) return raw
    const pad = raw.padStart(dec + 1, '0')
    const intPart = pad.slice(0, -dec)
    let fracPart = pad.slice(-dec).replace(/0+$/, '')
    if (fracPart.length > 6) fracPart = fracPart.slice(0, 6)
    return fracPart ? `${intPart}.${fracPart}` : intPart
  } catch {
    return balanceRaw
  }
}