// apps/listener/src/lib/notificationDispatcher.ts

import { supabase } from '../config/supabase.js'
import type { PostType } from '@chainbook/shared'
import { env } from '../config/env.js'

interface NotifyParams {
  postId: string
  walletAddress: string
  contractAddress: string | null
  amountUsd: number
  isWhaleAlert: boolean
  postType: PostType
}

export async function dispatchNotifications(params: NotifyParams): Promise<void> {
  const { postId, walletAddress, contractAddress, amountUsd, isWhaleAlert } = params

  const notifications: Array<{
    wallet_address: string
    post_id: string
    type: string
  }> = []

  // 1. Notify followers of this wallet about their activity
  const { data: followers } = await supabase
    .from('follows')
    .select('follower')
    .eq('subject', walletAddress.toLowerCase())

  if (followers && followers.length > 0) {
    for (const { follower } of followers) {
      notifications.push({
        wallet_address: follower,
        post_id: postId,
        type: 'FOLLOWED_WALLET_ACTIVITY',
      })
    }
  }

  // 2. Notify users tracking this wallet
  const { data: walletTrackers } = await supabase
    .from('tracked_entities')
    .select('tracker')
    .eq('entity_address', walletAddress.toLowerCase())
    .eq('entity_type', 'WALLET')

  if (walletTrackers && walletTrackers.length > 0) {
    for (const { tracker } of walletTrackers) {
      notifications.push({
        wallet_address: tracker,
        post_id: postId,
        type: 'TRACKED_WALLET',
      })
    }
  }

  // 3. Notify users tracking this contract
  if (contractAddress) {
    const { data: trackers } = await supabase
      .from('tracked_entities')
      .select('tracker')
      .eq('entity_address', contractAddress.toLowerCase())
      .eq('entity_type', 'CONTRACT')

    if (trackers && trackers.length > 0) {
      for (const { tracker } of trackers) {
        notifications.push({
          wallet_address: tracker,
          post_id: postId,
          type: 'TRACKED_CONTRACT',
        })
      }
    }
  }

  // 4. Notify alert subscribers for this wallet
  const { data: alertSubs } = await supabase
    .from('alert_subscriptions')
    .select('wallet_address, alert_type, threshold_usd, target_address')
    .eq('target_address', walletAddress.toLowerCase())

  if (alertSubs && alertSubs.length > 0) {
    for (const sub of alertSubs) {
      if (sub.alert_type === 'ANY_ACTIVITY') {
        notifications.push({
          wallet_address: sub.wallet_address,
          post_id: postId,
          type: 'ALERT_ACTIVITY',
        })
      }

      if (sub.alert_type === 'LARGE_TRADE') {
        const threshold = sub.threshold_usd ?? env.ALERT_LARGE_TRADE_USD
        if (amountUsd >= threshold) {
          notifications.push({
            wallet_address: sub.wallet_address,
            post_id: postId,
            type: 'ALERT_LARGE_TRADE',
          })
        }
      }
    }
  }

  // 5. Notify whale alert subscribers
  if (isWhaleAlert) {
    const { data: whaleSubs } = await supabase
      .from('alert_subscriptions')
      .select('wallet_address')
      .eq('alert_type', 'WHALE_MOVE')

    if (whaleSubs && whaleSubs.length > 0) {
      for (const { wallet_address } of whaleSubs) {
        notifications.push({
          wallet_address,
          post_id: postId,
          type: 'WHALE_ALERT',
        })
      }
    }
  }

  if (notifications.length === 0) return

  // Deduplicate by wallet_address + post_id + type
  const unique = Array.from(
    new Map(notifications.map((n) => [`${n.wallet_address}-${n.post_id}-${n.type}`, n])).values(),
  )

  const { error } = await supabase.from('notifications').insert(unique)
  if (error) {
    console.error('[Notifications] Insert error:', error.message)
  }
}
