'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import { Bell } from 'lucide-react'
import { useConnectedAccount } from '@/lib/hooks/useConnectedAccount'
import { createClient } from '@/lib/supabase/client'
import { timeAgo, POST_TYPE_META } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Notification, PostType } from '@chainbook/shared'

const NOTIFICATION_LABELS: Record<string, string> = {
  WHALE_ALERT:              '🐋 Whale move detected',
  FOLLOWED_WALLET_ACTIVITY: '👤 Wallet you follow was active',
  TRACKED_CONTRACT:         '📜 Tracked contract activity',
  TRACKED_WALLET:           '★ Tracked wallet activity',
  ALERT_ACTIVITY:           '🔔 Alert: wallet activity',
  ALERT_LARGE_TRADE:        '🔔 Alert: large trade',
}

export function NotificationsClient() {
  const { isConnected, address, handleConnect } = useConnectedAccount()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!address) return

    const addr = address.toLowerCase()

    // Initial fetch
    supabase
      .from('notifications')
      .select('*, post:posts(id, type, wallet_address, amount_usd, created_at)')
      .eq('wallet_address', addr)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setNotifications((data ?? []) as Notification[])
        setIsLoading(false)
      })

    // Real-time
    const channel = supabase
      .channel(`notifs-${addr}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `wallet_address=eq.${addr}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from('notifications')
            .select('*, post:posts(id, type, wallet_address, amount_usd, created_at)')
            .eq('id', payload.new.id)
            .single()
          if (data) {
            setNotifications((prev) => [data as Notification, ...prev])
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [address, supabase])

  async function markAllRead() {
    if (!address) return
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('wallet_address', address.toLowerCase())
      .eq('read', false)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Bell className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          Connect your wallet to see notifications
        </p>
        <button
          onClick={handleConnect}
          className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
        >
          Connect
        </button>
      </div>
    )
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image
            src="/assets/chainbook-icon.png"
            alt="Chainbook icon"
            width={20}
            height={20}
            className="h-5 w-5 rounded"
          />
          <h1 className="text-xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <span className="text-xs font-medium bg-blue-500 text-white px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <AnimatePresence>
          {notifications.map((notif) => {
            const post = notif.post as {
              id: string
              type: PostType
              wallet_address: string
              amount_usd: number | null
              created_at: string
            } | null

            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Link
                  href={post ? `/post/${post.id}` : '#'}
                  onClick={() => markRead(notif.id)}
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-xl border transition-colors',
                    notif.read
                      ? 'border-border bg-card hover:bg-card/80'
                      : 'border-blue-400/20 bg-blue-400/5 hover:bg-blue-400/10',
                  )}
                >
                  <div className="text-xl shrink-0">
                    {notif.type === 'WHALE_ALERT' ? '🐋'
                      : notif.type === 'FOLLOWED_WALLET_ACTIVITY' ? '👤'
                      : notif.type === 'TRACKED_CONTRACT' ? '📜'
                      : notif.type === 'TRACKED_WALLET' ? '★'
                      : '🔔'}
                  </div>
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {NOTIFICATION_LABELS[notif.type] ?? notif.type}
                    </p>
                    {post && (
                      <p className="text-xs text-muted-foreground">
                        {POST_TYPE_META[post.type]?.label ?? post.type}
                        {post.amount_usd
                          ? ` · $${post.amount_usd.toFixed(0)}`
                          : null}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {timeAgo(notif.created_at)}
                    </p>
                  </div>
                  {!notif.read && (
                    <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-1.5" />
                  )}
                </Link>
              </motion.div>
            )
          })}
        </AnimatePresence>
      )}

      {!isLoading && notifications.length === 0 && (
        <div className="text-center py-16">
          <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No notifications yet</p>
        </div>
      )}
    </div>
  )
}
