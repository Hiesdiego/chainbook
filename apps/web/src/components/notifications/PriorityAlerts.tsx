'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useConnectedAccount } from '@/lib/hooks/useConnectedAccount'
import { createClient } from '@/lib/supabase/client'
import { formatUsd, shortAddress, timeAgo } from '@/lib/utils'
import type { Post } from '@chainbook/shared'

export function PriorityAlerts() {
  const supabase = createClient()
  const { address } = useConnectedAccount()
  const [alerts, setAlerts] = useState<Post[]>([])

  useEffect(() => {
    let isMounted = true

    async function fetchAlerts() {
      if (!address) return
      const addr = address.toLowerCase()

      const { data: follows } = await supabase
        .from('follows')
        .select('subject')
        .eq('follower', addr)

      const followList = (follows ?? []).map((f) => f.subject)
      if (followList.length === 0) {
        if (isMounted) setAlerts([])
        return
      }

      const { data } = await supabase
        .from('posts')
        .select('id, wallet_address, amount_usd, created_at, type, is_whale_alert')
        .in('wallet_address', followList)
        .or('is_whale_alert.eq.true,is_significant.eq.true')
        .order('created_at', { ascending: false })
        .limit(10)

      if (isMounted) setAlerts((data ?? []) as Post[])
    }

    void fetchAlerts()
    const pollId = setInterval(fetchAlerts, 30_000)

    return () => {
      isMounted = false
      clearInterval(pollId)
    }
  }, [address])

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold">Priority Alerts</h3>
      </div>
      {alerts.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No priority alerts yet
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {alerts.map((post) => (
            <Link
              key={post.id}
              href={`/post/${post.id}`}
              className="flex items-center justify-between text-xs text-muted-foreground hover:text-foreground"
            >
              <span className="font-mono">{shortAddress(post.wallet_address)}</span>
              <span>
                {post.amount_usd ? formatUsd(post.amount_usd) : post.type}
              </span>
              <span>{timeAgo(post.created_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
