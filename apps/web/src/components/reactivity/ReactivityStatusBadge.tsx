import { createAdminClient } from '@/lib/supabase/server'

const LIVE_WINDOW_MS = 15 * 60 * 1000

function formatRelativeMinutes(ts: string | null): string {
  if (!ts) return 'No proof yet'
  const diffMs = Date.now() - new Date(ts).getTime()
  if (diffMs < 60_000) return 'just now'
  const minutes = Math.floor(diffMs / 60_000)
  return `${minutes}m ago`
}

export async function ReactivityStatusBadge() {
  const hasShowcaseAddress = Boolean(process.env.REACTIVITY_SHOWCASE_HANDLER_ADDRESS)
  const spotlightEnabled = process.env.NEXT_PUBLIC_REACTIVITY_SPOTLIGHT_ENABLED === 'true'

  let lastShowcaseAt: string | null = null
  if (hasShowcaseAddress) {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('reactivity_showcase_events')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    lastShowcaseAt = data?.created_at ?? null
  }

  const isLive = Boolean(
    lastShowcaseAt && Date.now() - new Date(lastShowcaseAt).getTime() <= LIVE_WINDOW_MS,
  )

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span
        className={`inline-flex h-2 w-2 rounded-full ${isLive ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}
      />
      <span>On-chain Reactor: {hasShowcaseAddress ? (isLive ? 'Live' : 'Idle') : 'Not Configured'}</span>
      <span className="opacity-70">({formatRelativeMinutes(lastShowcaseAt)})</span>
      <span className={`px-2 py-0.5 rounded-full border ${spotlightEnabled ? 'border-blue-400/40 text-blue-400' : 'border-border'}`}>
        Spotlight {spotlightEnabled ? 'On' : 'Off'}
      </span>
    </div>
  )
}
