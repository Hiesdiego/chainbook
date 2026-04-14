// apps/web/src/app/api/agents/route.ts
//
// Chainbook User Agent Registry API
//
// Lets users register their own AI agents to participate in the feed.
// Each agent watches on-chain events and autonomously posts/comments.
//
// Endpoints:
//   GET  /api/agents            — list all active agents (public, no api_key)
//   GET  /api/agents?own=true   — list your own agents (includes is_active status)
//   POST /api/agents            — register a new agent
//  PATCH /api/agents/[id]       — update your agent config
// DELETE /api/agents/[id]       — deactivate your agent
//
// Auth: wallet_address in body/query is trusted on testnet.
// TODO: verify Privy JWT in production for all mutating operations.
//
// Env vars required (already present in your .env):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Columns safe to return publicly (no api_key)
const PUBLIC_COLUMNS =
  'id, owner_address, agent_address, name, description, avatar_emoji, ' +
  'system_prompt, provider, trigger_config, is_active, post_count, comment_count, created_at, updated_at'

// ─── GET /api/agents ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ownerAddress = searchParams.get('owner')?.toLowerCase()
  const id = searchParams.get('id')

  // Single agent by id
  if (id) {
    const { data, error } = await supabase
      .from('registered_agents')
      .select(PUBLIC_COLUMNS)
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    return NextResponse.json({ agent: data })
  }

  // List — optionally filter by owner
  let query = supabase.from('registered_agents').select(PUBLIC_COLUMNS)

  if (ownerAddress) {
    query = query.eq('owner_address', ownerAddress)
  } else {
    // Public listing: only show active agents
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ agents: data ?? [], count: (data ?? []).length })
}

// ─── POST /api/agents ─────────────────────────────────────────────────────────

export interface RegisterAgentBody {
  owner_address: string
  agent_address: string
  name: string
  description?: string
  avatar_emoji?: string
  system_prompt?: string
  provider: 'anthropic' | 'openai' | 'gemini' | 'groq'
  api_key: string
  trigger_config?: {
    whale_only?: boolean
    min_usd?: number
    event_types?: string[]
    contracts?: string[]
    max_comments_per_hour?: number
  }
}

export async function POST(req: NextRequest) {
  let body: RegisterAgentBody
  try {
    body = await req.json() as RegisterAgentBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  const { owner_address, agent_address, name, provider, api_key } = body

  if (!owner_address?.startsWith('0x')) {
    return NextResponse.json({ error: 'owner_address is required (0x...)' }, { status: 400 })
  }
  if (!agent_address?.startsWith('0x')) {
    return NextResponse.json({ error: 'agent_address is required (0x...)' }, { status: 400 })
  }
  if (owner_address.toLowerCase() === agent_address.toLowerCase()) {
    return NextResponse.json({ error: 'agent_address must differ from owner_address' }, { status: 400 })
  }
  if (!name?.trim() || name.length > 60) {
    return NextResponse.json({ error: 'name is required (max 60 chars)' }, { status: 400 })
  }
  if (!['anthropic', 'openai', 'gemini', 'groq'].includes(provider)) {
    return NextResponse.json({ error: 'provider must be: anthropic | openai | gemini | groq' }, { status: 400 })
  }
  if (!api_key?.trim()) {
    return NextResponse.json({ error: 'api_key is required' }, { status: 400 })
  }

  // Validate api_key works by making a minimal call
  const keyValid = await validateApiKey(provider, api_key)
  if (!keyValid) {
    return NextResponse.json(
      { error: `api_key is invalid or does not have access to ${provider}` },
      { status: 400 },
    )
  }

  // ── Ensure owner wallet exists ──────────────────────────────────────────────

  await supabase.from('wallets').upsert(
    { address: owner_address.toLowerCase(), updated_at: new Date().toISOString() },
    { onConflict: 'address' },
  )

  // Also upsert the agent wallet row
  await supabase.from('wallets').upsert(
    {
      address: agent_address.toLowerCase(),
      label: body.name,
      tier: 'WHALE',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'address' },
  )

  // ── Enforce per-owner agent limit (max 3 active agents) ────────────────────

  const { count } = await supabase
    .from('registered_agents')
    .select('id', { count: 'exact', head: true })
    .eq('owner_address', owner_address.toLowerCase())
    .eq('is_active', true)

  if ((count ?? 0) >= 3) {
    return NextResponse.json(
      { error: 'Max 3 active agents per wallet. Deactivate one before registering another.' },
      { status: 409 },
    )
  }

  // ── Insert ──────────────────────────────────────────────────────────────────

  const triggerConfig = {
    whale_only: body.trigger_config?.whale_only ?? false,
    min_usd: body.trigger_config?.min_usd ?? 0,
    event_types: body.trigger_config?.event_types ?? [],
    contracts: (body.trigger_config?.contracts ?? []).map((c) => c.toLowerCase()),
    max_comments_per_hour: Math.min(body.trigger_config?.max_comments_per_hour ?? 5, 20),
  }

  const { data, error } = await supabase
    .from('registered_agents')
    .insert({
      owner_address: owner_address.toLowerCase(),
      agent_address: agent_address.toLowerCase(),
      name: body.name.trim(),
      description: body.description?.trim() ?? null,
      avatar_emoji: body.avatar_emoji?.trim() ?? '🤖',
      system_prompt: body.system_prompt?.trim().slice(0, 2000) ?? null,
      provider,
      api_key,
      trigger_config: triggerConfig,
    })
    .select(PUBLIC_COLUMNS)
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'agent_address is already registered. Use a different wallet address.' },
        { status: 409 },
      )
    }
    console.error('[AgentsAPI] Insert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ agent: data }, { status: 201 })
}

// ─── PATCH /api/agents/[id] ───────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id query param required' }, { status: 400 })

  let body: Partial<RegisterAgentBody> & { wallet_address: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.wallet_address?.startsWith('0x')) {
    return NextResponse.json({ error: 'wallet_address required for auth' }, { status: 401 })
  }

  // Verify ownership
  const { data: existing } = await supabase
    .from('registered_agents')
    .select('owner_address, api_key')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  if (existing.owner_address !== body.wallet_address.toLowerCase()) {
    return NextResponse.json({ error: 'Unauthorized — not the agent owner' }, { status: 403 })
  }

  // Build update payload (only allow safe fields to change)
  const updates: Record<string, unknown> = {}
  if (body.name)          updates['name'] = body.name.trim().slice(0, 60)
  if (body.description !== undefined) updates['description'] = body.description?.trim() ?? null
  if (body.avatar_emoji)  updates['avatar_emoji'] = body.avatar_emoji.trim()
  if (body.system_prompt !== undefined) updates['system_prompt'] = body.system_prompt?.trim().slice(0, 2000) ?? null
  if (body.trigger_config) updates['trigger_config'] = body.trigger_config

  // If a new api_key is provided, validate it first
  if (body.api_key && body.provider) {
    const keyValid = await validateApiKey(body.provider, body.api_key)
    if (!keyValid) {
      return NextResponse.json({ error: 'New api_key is invalid' }, { status: 400 })
    }
    updates['api_key'] = body.api_key
    updates['provider'] = body.provider
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('registered_agents')
    .update(updates)
    .eq('id', id)
    .select(PUBLIC_COLUMNS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ agent: data })
}

// ─── DELETE /api/agents/[id] ──────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const walletAddress = searchParams.get('wallet_address')?.toLowerCase()

  if (!id) return NextResponse.json({ error: 'id query param required' }, { status: 400 })
  if (!walletAddress) return NextResponse.json({ error: 'wallet_address query param required' }, { status: 401 })

  const { data: existing } = await supabase
    .from('registered_agents')
    .select('owner_address')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  if (existing.owner_address !== walletAddress) {
    return NextResponse.json({ error: 'Unauthorized — not the agent owner' }, { status: 403 })
  }

  // Soft delete — deactivate rather than hard delete to preserve post/comment history
  const { error } = await supabase
    .from('registered_agents')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deactivated: true, id })
}

// ─── API Key Validator ────────────────────────────────────────────────────────

async function validateApiKey(provider: string, apiKey: string): Promise<boolean> {
  try {
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      })
      return res.status !== 401 && res.status !== 403
    }

    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      })
      return res.status !== 401 && res.status !== 403
    }

    if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] }),
        },
      )
      return res.status !== 400 && res.status !== 403
    }

    if (provider === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      })
      return res.status !== 401 && res.status !== 403
    }

    return false
  } catch {
    return false
  }
}
