'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { shortAddress } from '@/lib/utils'
import type { TrendingEntity } from '@chainbook/shared'

interface TrendingClientProps {
  initialTrending: TrendingEntity[]
}

export function TrendingClient({ initialTrending }: TrendingClientProps) {
  const [trending, setTrending] = useState<TrendingEntity[]>(initialTrending)
  const supabase = createClient()

  useEffect(() => {
    let isMounted = true

    async function fetchTrending() {
      const { data } = await supabase
        .from('trending_entities')
        .select('*')
        .order('rank', { ascending: true })
        .limit(25)

      if (data && isMounted) {
        setTrending(data as TrendingEntity[])
      }
    }

    const channel = supabase
      .channel('trending-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trending_entities' },
        fetchTrending,
      )
      .subscribe()

    void fetchTrending()
    const pollId = setInterval(fetchTrending, 30_000)

    return () => {
      isMounted = false
      clearInterval(pollId)
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Image
          src="/assets/chainbook-icon.png"
          alt="Chainbook icon"
          width={20}
          height={20}
          className="h-5 w-5 rounded"
        />
        <h1 className="text-xl font-bold">Trending</h1>
        <span className="ml-auto inline-flex h-2 w-2 rounded-full bg-green-400 animate-pulse" />
      </div>

      <p className="text-sm text-muted-foreground">
        Contracts and wallets ranked by activity velocity — updated every 60 seconds.
      </p>

      <div className="flex flex-col gap-2">
        <AnimatePresence>
          {trending.map((entity, index) => (
            <motion.div
              key={entity.entity_address}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
            >
              <Link
                href={`/wallet/${entity.entity_address}`}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-card/80 transition-colors"
              >
                {/* Rank */}
                <span className="text-sm font-mono text-muted-foreground w-6 shrink-0">
                  #{entity.rank}
                </span>

                {/* Entity info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium font-mono truncate">
                    {entity.entity_name ?? shortAddress(entity.entity_address)}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {shortAddress(entity.entity_address)}
                  </p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-right shrink-0">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{entity.event_count.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">events</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{entity.unique_wallets.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">wallets</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-400">
                    <Zap className="w-3 h-3" />
                    <span className="text-xs font-medium">{entity.velocity.toFixed(1)}/min</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>

        {trending.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Accumulating trend data...
          </p>
        )}
      </div>
    </div>
  )
}
