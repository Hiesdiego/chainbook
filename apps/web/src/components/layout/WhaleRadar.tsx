'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatUsd, shortAddress, timeAgo } from '@/lib/utils'
import type { Post } from '@chainbook/shared'

export function WhaleRadar() {
  const [whalePosts, setWhalePosts] = useState<Post[]>([])
  const supabase = createClient()

  useEffect(() => {
    let isMounted = true

    async function fetchWhales() {
      const { data } = await supabase
        .from('posts')
        .select('*, wallet:wallets(*)')
        .eq('is_whale_alert', true)
        .order('created_at', { ascending: false })
        .limit(10)

      if (data && isMounted) setWhalePosts(data as Post[])
    }

    fetchWhales()

    // Real-time subscription
    const channel = supabase
      .channel('whale-radar')
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'posts',
          filter: 'is_whale_alert=eq.true',
        },
        async (payload) => {
          const { data } = await supabase
            .from('posts')
            .select('*, wallet:wallets(*)')
            .eq('id', payload.new.id)
            .single()

          if (data) {
            setWhalePosts((prev) => [data as Post, ...prev].slice(0, 10))
          }
        },
      )
      .subscribe()

    const pollId = setInterval(fetchWhales, 30_000)

    return () => {
      isMounted = false
      clearInterval(pollId)
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🐋</span>
        <h3 className="font-semibold text-sm">Whale Radar</h3>
        <span className="ml-auto inline-flex h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
      </div>

      {whalePosts.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          Watching for whale moves...
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {whalePosts.map((post) => (
            <Link
              key={post.id}
              href={`/post/${post.id}`}
              className="flex flex-col gap-0.5 hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium font-mono text-muted-foreground">
                  {shortAddress(post.wallet_address)}
                </span>
                <span className="text-xs font-semibold text-blue-400">
                  {post.amount_usd ? formatUsd(post.amount_usd) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground capitalize">
                  {post.type.toLowerCase().replace('_', ' ')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {timeAgo(post.created_at)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
