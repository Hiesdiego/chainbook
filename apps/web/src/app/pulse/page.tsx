import { AppShell } from '@/components/layout/AppShell'
import { PulseClient } from '@/components/pulse/PulseClient'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function PulsePage() {
  const supabase = createAdminClient()

  // Last-hour aggregate counts for SSR seed
  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString()

  const { data: counts } = await supabase
    .from('posts')
    .select('type, is_whale_alert')
    .gte('created_at', oneHourAgo)

  const seed = {
    SWAP:             0,
    TRANSFER:         0,
    MINT:             0,
    DAO_VOTE:         0,
    LIQUIDITY_ADD:    0,
    LIQUIDITY_REMOVE: 0,
    CONTRACT_DEPLOY:  0,
    NFT_TRADE:        0,
    WHALE_ALERT:      0,
  } as Record<string, number>

  for (const row of counts ?? []) {
    seed[row.type] = (seed[row.type] ?? 0) + 1
    if (row.is_whale_alert) seed['WHALE_ALERT']++
  }

  // Seed recent events for the live ticker (last 8 events in the last hour)
  const { data: recentPostsRaw } = await supabase
    .from('posts')
    .select('id, type, wallet_address, created_at')
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false })
    .limit(8)

  type SeedEvent = { id: string; type: string; wallet: string; time: string }
  const seedEvents: SeedEvent[] = (recentPostsRaw ?? []).map((p) => ({
    id: p.id,
    type: p.type,
    wallet: p.wallet_address,
    time: new Date(p.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  }))

  // Build per-minute sparkline buckets for the last 10 minutes
  const tenMinAgo = new Date(Date.now() - 10 * 60_000)
  const { data: recentMinutePosts } = await supabase
    .from('posts')
    .select('created_at')
    .gte('created_at', tenMinAgo.toISOString())

  // 10 one-minute buckets ending now
  const now = Date.now()
  const seedSpark = Array.from({ length: 10 }, (_, i) => {
    const bucketStart = now - (9 - i) * 60_000
    const bucketEnd   = bucketStart + 60_000
    const count = (recentMinutePosts ?? []).filter((p) => {
      const t = new Date(p.created_at).getTime()
      return t >= bucketStart && t < bucketEnd
    }).length
    return {
      t: new Date(bucketStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      count,
    }
  })

  return (
    <AppShell>
      <PulseClient seedCounts={seed} seedEvents={seedEvents} seedSpark={seedSpark} />
    </AppShell>
  )
}
