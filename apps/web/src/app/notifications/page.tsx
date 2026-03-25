import { AppShell } from '@/components/layout/AppShell'
import { NotificationsClient } from '@/components/notifications/NotificationsClient'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const supabase = createAdminClient()

  // Auth check happens client-side via Privy
  return (
    <AppShell>
      <NotificationsClient />
    </AppShell>
  )
}
