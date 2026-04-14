import { AppShell } from '@/components/layout/AppShell'
import { AgentPanel } from '@/components/agent/AgentPanel'

export const dynamic = 'force-dynamic'

export default function AgentPage() {
  return (
    <AppShell>
      <div className="flex h-[calc(100vh-9rem)] min-h-[36rem] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]/70 shadow-2xl">
        <AgentPanel mode="page" />
      </div>
    </AppShell>
  )
}
