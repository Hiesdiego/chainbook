'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { POST_TYPE_META } from '@/lib/utils'
import type { PostType } from '@chainbook/shared'

interface PulseClientProps {
  seedCounts: Record<string, number>
  seedEvents?: { id: string; type: string; wallet: string; time: string }[]
  seedSpark?: { t: string; count: number }[]
}

interface SparkPoint {
  t: string
  count: number
}

type PulseRange = '1H' | '3H' | '1D'

const STAT_TYPES: PostType[] = [
  'SWAP',
  'TRANSFER',
  'MINT',
  'DAO_VOTE',
  'LIQUIDITY_ADD',
  'LIQUIDITY_REMOVE',
  'CONTRACT_DEPLOY',
  'NFT_TRADE',
]

const RANGE_OPTIONS: { value: PulseRange; label: string; durationMs: number }[] = [
  { value: '1H', label: '1H', durationMs: 60 * 60_000 },
  { value: '3H', label: '3H', durationMs: 3 * 60 * 60_000 },
  { value: '1D', label: '1D', durationMs: 24 * 60 * 60_000 },
]

function createEmptyCounts() {
  return {
    SWAP: 0,
    TRANSFER: 0,
    MINT: 0,
    DAO_VOTE: 0,
    LIQUIDITY_ADD: 0,
    LIQUIDITY_REMOVE: 0,
    CONTRACT_DEPLOY: 0,
    NFT_TRADE: 0,
    WHALE_ALERT: 0,
  } as Record<string, number>
}

function getRangeStart(range: PulseRange) {
  const option = RANGE_OPTIONS.find((item) => item.value === range) ?? RANGE_OPTIONS[0]
  return new Date(Date.now() - option.durationMs).toISOString()
}

export function PulseClient({ seedCounts, seedEvents = [], seedSpark }: PulseClientProps) {
  const [counts, setCounts] = useState<Record<string, number>>(seedCounts)
  const [whaleCount, setWhaleCount] = useState(seedCounts['WHALE_ALERT'] ?? 0)
  const [selectedRange, setSelectedRange] = useState<PulseRange>('1H')
  const [sparkData, setSparkData] = useState<SparkPoint[]>(() => {
    if (seedSpark && seedSpark.length > 0) return seedSpark
    const now = Date.now()
    return Array.from({ length: 10 }, (_, i) => ({
      t: new Date(now - (9 - i) * 60_000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      count: 0,
    }))
  })
  const [recentEvents, setRecentEvents] = useState<
    { id: string; type: PostType; wallet: string; time: string }[]
  >(seedEvents as { id: string; type: PostType; wallet: string; time: string }[])
  const [supabase] = useState(() => createClient())
  const isRefreshingRef = useRef(false)

  async function refreshPulseFromDb(range: PulseRange) {
    if (isRefreshingRef.current) return
    isRefreshingRef.current = true
    try {
      const rangeStart = getRangeStart(range)
      const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString()

      const [{ data: rows }, { data: minuteRows }, { data: recentRows }] = await Promise.all([
        supabase
          .from('posts')
          .select('type, is_whale_alert')
          .gte('created_at', rangeStart),
        supabase
          .from('posts')
          .select('created_at')
          .gte('created_at', tenMinAgo),
        supabase
          .from('posts')
          .select('id, type, wallet_address, created_at')
          .gte('created_at', rangeStart)
          .order('created_at', { ascending: false })
          .limit(8),
      ])

      const nextCounts = createEmptyCounts()
      let nextWhale = 0

      for (const row of rows ?? []) {
        const type = row.type as string
        nextCounts[type] = (nextCounts[type] ?? 0) + 1
        if (row.is_whale_alert) nextWhale += 1
      }

      const now = Date.now()
      const nextSpark = Array.from({ length: 10 }, (_, i) => {
        const bucketStart = now - (9 - i) * 60_000
        const bucketEnd = bucketStart + 60_000
        const count = (minuteRows ?? []).filter((r) => {
          const t = new Date(r.created_at).getTime()
          return t >= bucketStart && t < bucketEnd
        }).length
        return {
          t: new Date(bucketStart).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          count,
        }
      })

      const nextRecent = (recentRows ?? []).map((p) => ({
        id: p.id,
        type: p.type as PostType,
        wallet: p.wallet_address,
        time: new Date(p.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      }))

      setCounts(nextCounts)
      setWhaleCount(nextWhale)
      setSparkData(nextSpark)
      setRecentEvents(nextRecent)
    } finally {
      isRefreshingRef.current = false
    }
  }

  useEffect(() => {
    void refreshPulseFromDb(selectedRange)
    const channel = supabase
      .channel('pulse-stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        (payload) => {
          const post = payload.new as {
            id: string
            type: PostType
            wallet_address: string
            is_whale_alert: boolean
            created_at: string
          }

          // Increment type counter
          setCounts((prev) => ({
            ...prev,
            [post.type]: (prev[post.type] ?? 0) + 1,
          }))

          if (post.is_whale_alert) {
            setWhaleCount((c) => c + 1)
          }

          // Append to sparkline — bump last bucket
          setSparkData((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              count: updated[updated.length - 1].count + 1,
            }
            return updated
          })

          // Rolling recent events ticker (last 8)
          setRecentEvents((prev) =>
            [
              {
                id:     post.id,
                type:   post.type,
                wallet: post.wallet_address,
                time:   new Date(post.created_at).toLocaleTimeString([], {
                  hour:   '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                }),
              },
              ...prev,
            ].slice(0, 8),
          )
        },
      )
      .subscribe()
    const refreshInterval = setInterval(() => {
      void refreshPulseFromDb(selectedRange)
    }, 15_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(refreshInterval)
    }
  }, [selectedRange, supabase])

  const totalEvents = Object.entries(counts)
    .filter(([k]) => k !== 'WHALE_ALERT')
    .reduce((sum, [, v]) => sum + v, 0)

  const distributionData = useMemo(
    () =>
      STAT_TYPES.map((type) => ({
        type,
        label: POST_TYPE_META[type].label,
        count: counts[type] ?? 0,
      })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    [counts],
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Image
          src="/assets/chainbook-icon.png"
          alt="Chainbook icon"
          width={20}
          height={20}
          className="h-5 w-5 rounded"
        />
        <h1 className="text-xl font-bold">Activity Pulse</h1>
        <span className="ml-auto inline-flex h-2 w-2 rounded-full bg-green-400 animate-pulse" />
      </div>

      <div className="flex items-center gap-2">
        {RANGE_OPTIONS.map((option) => {
          const isActive = option.value === selectedRange
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelectedRange(option.value)}
              className={[
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {/* Sparkline */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">Events per minute (last 10 min)</p>
          <p className="text-2xl font-bold tabular-nums">{totalEvents.toLocaleString()}</p>
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={sparkData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
            <defs>
              <linearGradient id="pulseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#6B7280' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: 'hsl(224 71% 6%)',
                border: '1px solid hsl(216 34% 17%)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#3B82F6"
              strokeWidth={1.5}
              fill="url(#pulseGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Distribution chart */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            Type distribution ({selectedRange === '1D' ? 'last 1 day' : `last ${selectedRange.toLowerCase()}`})
          </p>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={distributionData}
            margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(216 34% 17%)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6B7280' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: 'hsl(224 71% 6%)',
                border: '1px solid hsl(216 34% 17%)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Whale alert card */}
        <div className="col-span-2 rounded-xl border border-whale/30 bg-whale/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🐋</span>
            <div>
              <p className="text-sm font-medium">Whale Moves</p>
              <p className="text-xs text-muted-foreground">&gt;$100K transactions</p>
            </div>
          </div>
          <span className="text-3xl font-bold tabular-nums text-whale">
            {whaleCount.toLocaleString()}
          </span>
        </div>

        {/* Per-type cards */}
        {distributionData.map(({ type }) => {
          const meta = POST_TYPE_META[type]
          return (
            <div
              key={type}
              className="rounded-xl border border-border bg-card p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{meta.icon}</span>
                <span className="text-sm text-muted-foreground">{meta.label}</span>
              </div>
              <span className={`text-xl font-bold tabular-nums ${meta.color}`}>
                {(counts[type] ?? 0).toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>

      {/* Live event ticker */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">Live events</p>
        <div className="flex flex-col gap-2 min-h-[120px]">
          <AnimatePresence mode="popLayout">
            {recentEvents.map((ev) => {
              const meta = POST_TYPE_META[ev.type]
              return (
                <motion.div
                  key={ev.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-3 text-xs"
                >
                  <span>{meta.icon}</span>
                  <span className={`font-medium ${meta.color}`}>{meta.label}</span>
                  <span className="font-mono text-muted-foreground">
                    {ev.wallet.slice(0, 10)}...
                  </span>
                  <span className="ml-auto text-muted-foreground font-mono">{ev.time}</span>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {recentEvents.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Waiting for events...
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
