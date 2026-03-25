import { AppShell } from '@/components/layout/AppShell'
import { WhaleSearchClient } from '@/components/whales/WhaleSearchClient'

export const dynamic = 'force-dynamic'

export default function WhalesPage() {
  return (
    <AppShell>
      <WhaleSearchClient />
    </AppShell>
  )
}
