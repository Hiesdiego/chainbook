'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useAccount } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { PostCard } from './PostCard'
import { SuggestedFollows } from './SuggestedFollows'
import { useSoundContext } from '@/components/providers/SoundProvider'
import { createClient } from '@/lib/supabase/client'
import { getCommentCounts } from '@/lib/api/comments'
import { isExcludedContract } from '@/lib/utils'
import { SOUNDS } from '@/lib/sounds/soundManager'
import type { Post, PostType } from '@chainbook/shared'

interface FeedStreamProps {
  initialPosts: Post[]
}

type FeedMode = 'for_you' | 'following' | 'spotlight'
type SpotlightEventFilter =
  | 'all'
  | 'TRANSFER'
  | 'SWAP'
  | 'MINT'
  | 'DAO_VOTE'
  | 'LIQUIDITY'
  | 'CONTRACT_DEPLOY'
  | 'NFT_TRADE'

function matchesSpotlightEventFilter(type: PostType, filter: SpotlightEventFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'LIQUIDITY') {
    return type === 'LIQUIDITY_ADD' || type === 'LIQUIDITY_REMOVE'
  }
  return type === filter
}

export function FeedStream({ initialPosts }: FeedStreamProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [newCount, setNewCount] = useState(0)
  const [mode, setMode] = useState<FeedMode>('for_you')
  const [spotlightContractFilter, setSpotlightContractFilter] = useState('')
  const [spotlightEventFilter, setSpotlightEventFilter] =
    useState<SpotlightEventFilter>('all')
  const [followingAddresses, setFollowingAddresses] = useState<string[]>([])
  const [followingLoaded, setFollowingLoaded] = useState(false)
  const supabase = createClient()
  const { address: wagmiAddress } = useAccount()
  const { user } = usePrivy()
  const { play: playSound } = useSoundContext()
  const viewerAddress = wagmiAddress ?? user?.wallet?.address
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const normalizedSpotlightContract = spotlightContractFilter.trim().toLowerCase()

  // Create a callback for like sound
  const playLikeSound = useCallback(() => {
    void playSound(SOUNDS.SOCIAL.like)
  }, [playSound])

  // Filter out posts from contract addresses (proxy, tokens, NFTs)
  const filterContractPosts = useCallback((postsToFilter: Post[]): Post[] => {
    return postsToFilter.filter(
      (post) => !isExcludedContract((post.wallet as any)?.contract_type)
    )
  }, [])

  const prependPost = useCallback((post: Post) => {
    // Don't add if wallet is an excluded contract
    if (isExcludedContract((post.wallet as any)?.contract_type)) return
    
    setPosts((prev) => {
      // Avoid duplicates
      if (prev.some((p) => p.id === post.id)) return prev
      return [post, ...prev]
    })
    setNewCount((c) => c + 1)
    if (post.is_whale_alert) {
      void playSound(SOUNDS.ALERT.whale)
    }
  }, [playSound])

  const syncCommentCounts = useCallback(async (postIds: string[]) => {
    if (postIds.length === 0) return
    try {
      const counts = await getCommentCounts(postIds)
      setPosts((prev) => {
        let changed = false
        const next = prev.map((p) => {
          const count = counts[p.id]
          if (count === undefined) return p
          const current = p.comment_count ?? 0
          if (current === count) return p
          changed = true
          return { ...p, comment_count: count }
        })
        return changed ? next : prev
      })
    } catch (error) {
      console.warn('Comment count sync failed:', error)
    }
  }, [])

  useEffect(() => {
    if (!viewerAddress) {
      setFollowingAddresses([])
      setFollowingLoaded(true)
      return
    }
    setFollowingLoaded(false)
    const addr = viewerAddress.toLowerCase()
    supabase
      .from('follows')
      .select('subject')
      .eq('follower', addr)
      .then(({ data }) => {
        setFollowingAddresses((data ?? []).map((d) => d.subject))
        setFollowingLoaded(true)
      })
  }, [viewerAddress])

  useEffect(() => {
    let isMounted = true

    async function fetchLatest() {
      let query = supabase
        .from('posts')
        .select('*, wallet:wallets(*)')
        .order('created_at', { ascending: false })
        .limit(30)

      if (mode === 'following') {
        if (!followingLoaded) return  // Still fetching who we follow — wait
        if (followingAddresses.length === 0) {
          if (isMounted) setPosts([])
          return
        }
        query = query.in('wallet_address', followingAddresses)
      } else if (mode === 'spotlight') {
        const { data: spotlightRows, error: spotlightError } = await supabase
          .from('reactivity_spotlight_posts')
          .select('post_id')
          .order('created_at', { ascending: false })
          .limit(30)
        if (spotlightError || !isMounted) return
        const spotlightPostIds = (spotlightRows ?? []).map((row) => row.post_id)
        if (spotlightPostIds.length === 0) {
          if (isMounted) setPosts([])
          return
        }
        query = query.in('id', spotlightPostIds)
        if (normalizedSpotlightContract) {
          const isExactAddress = /^0x[a-f0-9]{40}$/.test(normalizedSpotlightContract)
          if (isExactAddress) {
            query = query.eq('contract_address', normalizedSpotlightContract)
          } else {
            query = query.ilike('contract_address', `%${normalizedSpotlightContract}%`)
          }
        }
        if (spotlightEventFilter !== 'all') {
          if (spotlightEventFilter === 'LIQUIDITY') {
            query = query.in('type', ['LIQUIDITY_ADD', 'LIQUIDITY_REMOVE'])
          } else {
            query = query.eq('type', spotlightEventFilter)
          }
        }
      } else {
        if (followingAddresses.length > 0) {
          const inList = followingAddresses.join(',')
          query = query.or(`wallet_address.in.(${inList}),is_whale_alert.eq.true,is_significant.eq.true`)
        } else {
          query = query.eq('is_significant', true)
        }
      }

      const { data, error } = await query

      if (error || !data || !isMounted) return

      // Filter out contract posts
      const filteredData = filterContractPosts(data)

      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        const incoming = filteredData.filter((p) => !seen.has(p.id))
        if (incoming.length > 0) {
          setNewCount((c) => c + incoming.length)
        }
        return incoming.length > 0 ? [...incoming, ...prev] : prev
      })
    }

    const channel = supabase
      .channel('chainbook-feed')
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'posts',
        },
        async (payload) => {
          if (mode === 'spotlight') {
            const { data: spotlightRow } = await supabase
              .from('reactivity_spotlight_posts')
              .select('post_id')
              .eq('post_id', payload.new.id)
              .maybeSingle()
            if (!spotlightRow) return
          }
          // Fetch the full post with wallet relation
          const { data } = await supabase
            .from('posts')
            .select('*, wallet:wallets(*)')
            .eq('id', payload.new.id)
            .single()

          if (!data) return
          if (mode === 'spotlight') {
            const contractAddress = (data as Post).contract_address?.toLowerCase() ?? ''
            if (normalizedSpotlightContract) {
              const isExactAddress = /^0x[a-f0-9]{40}$/.test(normalizedSpotlightContract)
              if (isExactAddress && contractAddress !== normalizedSpotlightContract) return
              if (!isExactAddress && !contractAddress.includes(normalizedSpotlightContract)) return
            }
            if (!matchesSpotlightEventFilter((data as Post).type, spotlightEventFilter)) return
          }
          prependPost(data as Post)
        },
      )
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'posts',
        },
        (payload) => {
          // Keep like_count and comment_count in sync without refetching
          if (!isMounted) return
          setPosts((prev) =>
            prev.map((p) =>
              p.id === payload.new.id
                ? { ...p, like_count: payload.new.like_count, comment_count: payload.new.comment_count }
                : p,
            ),
          )
        },
      )
      .subscribe()

    void fetchLatest()
    const pollId = setInterval(fetchLatest, 30_000)

    return () => {
      isMounted = false
      clearInterval(pollId)
      supabase.removeChannel(channel)
    }
  }, [
    prependPost,
    supabase,
    mode,
    followingAddresses,
    followingLoaded,
    normalizedSpotlightContract,
    spotlightEventFilter,
  ])

  useEffect(() => {
    if (posts.length === 0) return
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      void syncCommentCounts(posts.map((p) => p.id))
    }, 200)
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    }
  }, [posts, syncCommentCounts])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => {
            setPosts([])
            setNewCount(0)
            setMode('for_you')
          }}
          className={`px-3 py-1 rounded-full border ${mode === 'for_you' ? 'border-blue-400 text-blue-400' : 'border-border text-muted-foreground'}`}
        >
          For You
        </button>
        <button
          onClick={() => {
            setPosts([])
            setNewCount(0)
            setMode('following')
          }}
          className={`px-3 py-1 rounded-full border ${mode === 'following' ? 'border-blue-400 text-blue-400' : 'border-border text-muted-foreground'}`}
        >
          Following
        </button>
        <button
          onClick={() => {
            setPosts([])
            setNewCount(0)
            setMode('spotlight')
          }}
          className={`px-3 py-1 rounded-full border ${mode === 'spotlight' ? 'border-blue-400 text-blue-400' : 'border-border text-muted-foreground'}`}
        >
          Spotlight
        </button>
      </div>
      {mode === 'spotlight' && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input
            value={spotlightContractFilter}
            onChange={(event) => {
              setSpotlightContractFilter(event.target.value)
              setPosts([])
              setNewCount(0)
            }}
            placeholder="Filter by contract address"
            className="w-full max-w-sm rounded-md border border-border bg-transparent px-3 py-1.5 text-foreground outline-none focus:border-blue-400"
          />
          <button
            onClick={() => {
              setSpotlightEventFilter('all')
              setPosts([])
              setNewCount(0)
            }}
            className={`rounded-md border px-3 py-1.5 ${
              spotlightEventFilter === 'all'
                ? 'border-blue-400 text-blue-400'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
          <button
            onClick={() => {
              setSpotlightEventFilter('TRANSFER')
              setPosts([])
              setNewCount(0)
            }}
            className={`rounded-md border px-3 py-1.5 ${
              spotlightEventFilter === 'TRANSFER'
                ? 'border-blue-400 text-blue-400'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Transfer
          </button>
          <button
            onClick={() => {
              setSpotlightEventFilter('SWAP')
              setPosts([])
              setNewCount(0)
            }}
            className={`rounded-md border px-3 py-1.5 ${
              spotlightEventFilter === 'SWAP'
                ? 'border-blue-400 text-blue-400'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Swap
          </button>
          <button
            onClick={() => {
              setSpotlightEventFilter('MINT')
              setPosts([])
              setNewCount(0)
            }}
            className={`rounded-md border px-3 py-1.5 ${
              spotlightEventFilter === 'MINT'
                ? 'border-blue-400 text-blue-400'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Mint
          </button>
          <button
            onClick={() => {
              setSpotlightEventFilter('DAO_VOTE')
              setPosts([])
              setNewCount(0)
            }}
            className={`rounded-md border px-3 py-1.5 ${
              spotlightEventFilter === 'DAO_VOTE'
                ? 'border-blue-400 text-blue-400'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            DAO
          </button>
          <button
            onClick={() => {
              setSpotlightEventFilter('LIQUIDITY')
              setPosts([])
              setNewCount(0)
            }}
            className={`rounded-md border px-3 py-1.5 ${
              spotlightEventFilter === 'LIQUIDITY'
                ? 'border-blue-400 text-blue-400'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Liquidity
          </button>
          <button
            onClick={() => {
              setSpotlightEventFilter('CONTRACT_DEPLOY')
              setPosts([])
              setNewCount(0)
            }}
            className={`rounded-md border px-3 py-1.5 ${
              spotlightEventFilter === 'CONTRACT_DEPLOY'
                ? 'border-blue-400 text-blue-400'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Deploy
          </button>
          <button
            onClick={() => {
              setSpotlightEventFilter('NFT_TRADE')
              setPosts([])
              setNewCount(0)
            }}
            className={`rounded-md border px-3 py-1.5 ${
              spotlightEventFilter === 'NFT_TRADE'
                ? 'border-blue-400 text-blue-400'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            NFT
          </button>
          <button
            onClick={() => {
              setSpotlightContractFilter('')
              setSpotlightEventFilter('all')
              setPosts([])
              setNewCount(0)
            }}
            className="rounded-md border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
        </div>
      )}

      {/* New posts indicator */}
      {newCount > 0 && (
        <button
          onClick={() => {
            setNewCount(0)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="text-xs text-blue-400 font-medium text-center py-2 border border-blue-400/20 rounded-lg bg-blue-400/5 hover:bg-blue-400/10 transition-colors"
        >
          ↑ {newCount} new {newCount === 1 ? 'event' : 'events'}
        </button>
      )}

      <AnimatePresence mode="popLayout">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onLikeSound={playLikeSound}
            viewerAddress={viewerAddress?.toLowerCase()}
            followingAddresses={followingAddresses}
            onFollowChange={(address, following) => {
              setFollowingAddresses((prev) =>
                following
                  ? [...prev, address.toLowerCase()]
                  : prev.filter((a) => a !== address.toLowerCase()),
              )
            }}
          />
        ))}
      </AnimatePresence>

      {posts.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          {mode === 'following' && !followingLoaded ? (
            <>
              <p className="text-3xl mb-3">⏳</p>
              <p className="text-sm">Loading feed…</p>
            </>
          ) : mode === 'following' && followingLoaded && followingAddresses.length === 0 ? (
            <SuggestedFollows
              followingAddresses={followingAddresses}
              onFollowChange={(addr: string, following: boolean) => {
                setFollowingAddresses((prev) =>
                  following
                    ? [...prev, addr.toLowerCase()]
                    : prev.filter((a) => a !== addr.toLowerCase()),
                )
              }}
            />
          ) : (
            <>
              <p className="text-4xl mb-3">📡</p>
              <p className="text-sm">
                {mode === 'following'
                  ? 'No recent activity from wallets you follow.'
                  : mode === 'spotlight'
                    ? 'No spotlight events yet.'
                  : 'Listening for on-chain activity...'}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
