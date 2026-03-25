import { AppShell } from '@/components/layout/AppShell'
import { createAdminClient } from '@/lib/supabase/server'
import { TrendingClient } from '@/components/trending/TrendingClient'

export const dynamic = 'force-dynamic'

export default async function TrendingPage() {
  const supabase = createAdminClient()

  const { data: trending } = await supabase
    .from('trending_entities')
    .select('*')
    .order('rank', { ascending: true })
    .limit(25)

  return (
    <AppShell>
      <TrendingClient initialTrending={trending ?? []} />
    </AppShell>
  )
}
