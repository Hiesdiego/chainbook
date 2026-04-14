// apps/web/src/app/api/agent/route.ts
//
// Chainbook AI — Chat Panel API
//
// Uses the shared agentProvider abstraction so you can swap the brain
// by changing env vars only — no code changes needed.
//
// ── Env vars ────────────────────────────────────────────────────────────────
//
//   AGENT_PROVIDER=anthropic          # anthropic | openai | gemini | groq
//   AGENT_API_KEY=sk-ant-...          # key for whichever provider
//   AGENT_MODEL=claude-haiku-4-5-...  # optional model override
//   AGENT_WALLET_ADDRESS=0x...        # agent's identity in the wallets table
//
//   Defaults when not set:
//     AGENT_PROVIDER → anthropic
//     AGENT_MODEL    → cheapest model for the chosen provider
//                      (haiku for Anthropic, gpt-4o-mini for OpenAI,
//                       gemini-2.0-flash for Gemini, llama-3.3-70b-versatile for Groq)
//
// ── Tools ────────────────────────────────────────────────────────────────────
//   get_recent_whale_alerts  — last N whale posts
//   get_trending_tokens      — top trending entities
//   estimate_price_impact    — AMM-based impact estimate
//   get_wallet_profile       — wallet tier + stats
//   post_agent_insight       — publish to the feed as Chainbook AI

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  createProviderFromEnv,
  runAgentLoop,
  type NormedMessage,
  type ToolDefinition,
  type ToolCall,
} from '@chainbook/shared'

// ─── Supabase (service role — never exposed to browser) ───────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const AGENT_WALLET = process.env.AGENT_WALLET_ADDRESS ?? '0x00chainbookai'
const CHAT_MAX_ROUNDS = Number(process.env.AGENT_CHAT_MAX_ROUNDS ?? 2)
const CHAT_MAX_TOKENS = Number(process.env.AGENT_CHAT_MAX_TOKENS ?? 256)
const CHAT_MAX_HISTORY_MESSAGES = Number(process.env.AGENT_CHAT_MAX_HISTORY_MESSAGES ?? 6)
const CHAT_MAX_MESSAGE_CHARS = Number(process.env.AGENT_CHAT_MAX_MESSAGE_CHARS ?? 600)
const CHAT_MAX_REQUESTS_PER_MINUTE = Number(process.env.AGENT_CHAT_MAX_REQUESTS_PER_MINUTE ?? 12)
const CHAT_MAX_REQUESTS_PER_DAY = Number(process.env.AGENT_CHAT_MAX_REQUESTS_PER_DAY ?? 120)

interface RateBucket {
  minuteWindowStart: number
  minuteCount: number
  dayKey: string
  dayCount: number
}

const chatRateBuckets = new Map<string, RateBucket>()

function utcDayKey() {
  return new Date().toISOString().slice(0, 10)
}

function getClientKey(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || 'unknown'
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function checkChatRateLimit(clientKey: string): { ok: true } | { ok: false; reason: string } {
  const now = Date.now()
  const dayKey = utcDayKey()
  const minuteWindowStart = now - (now % 60_000)
  const current = chatRateBuckets.get(clientKey)

  if (!current) {
    chatRateBuckets.set(clientKey, { minuteWindowStart, minuteCount: 1, dayKey, dayCount: 1 })
    return { ok: true }
  }

  if (current.dayKey !== dayKey) {
    current.dayKey = dayKey
    current.dayCount = 0
  }

  if (current.minuteWindowStart !== minuteWindowStart) {
    current.minuteWindowStart = minuteWindowStart
    current.minuteCount = 0
  }

  if (current.minuteCount >= CHAT_MAX_REQUESTS_PER_MINUTE) {
    return { ok: false, reason: `Rate limit hit: max ${CHAT_MAX_REQUESTS_PER_MINUTE} requests/min.` }
  }
  if (current.dayCount >= CHAT_MAX_REQUESTS_PER_DAY) {
    return { ok: false, reason: `Daily limit hit: max ${CHAT_MAX_REQUESTS_PER_DAY} requests/day.` }
  }

  current.minuteCount += 1
  current.dayCount += 1
  return { ok: true }
}

function sanitizeMessages(messages: NormedMessage[]): NormedMessage[] {
  const recent = messages.slice(-CHAT_MAX_HISTORY_MESSAGES)
  return recent.map((msg) => ({
    role: msg.role,
    content:
      typeof msg.content === 'string'
        ? msg.content.slice(0, CHAT_MAX_MESSAGE_CHARS)
        : msg.content,
  }))
}

// ─── Tool definitions ─────────────────────────────────────────────────────────
// Descriptions are kept short — they still count toward your token budget.

const TOOLS: ToolDefinition[] = [
  {
    name: 'get_recent_whale_alerts',
    description: 'Fetch recent whale transfer events from Chainbook. Returns wallet tiers, USD amounts, tx hashes. Call first for any whale/movement question.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'How many to return (default 5, max 10)' },
      },
      required: [],
    },
  },
  {
    name: 'get_trending_tokens',
    description: 'Fetch top trending tokens/contracts ranked by event count and velocity. Call first for any trending question.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'How many to return (default 5, max 10)' },
      },
      required: [],
    },
  },
  {
    name: 'estimate_price_impact',
    description: 'Estimate % price impact of a transfer using on-chain swap volume as liquidity proxy. Returns severity: NEGLIGIBLE/LOW/MEDIUM/HIGH/CRITICAL.',
    parameters: {
      type: 'object',
      properties: {
        amount_usd:    { type: 'number', description: 'Transfer value in USD' },
        token_address: { type: 'string', description: 'Token contract address (optional, narrows estimate)' },
      },
      required: ['amount_usd'],
    },
  },
  {
    name: 'get_wallet_profile',
    description: "Fetch a wallet's Chainbook profile: tier (WHALE/SHARK/FISH/CRAB/SHRIMP), reputation, volume, activity. Use when given a 0x address.",
    parameters: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Wallet address (0x...)' },
      },
      required: ['address'],
    },
  },
  {
    name: 'post_agent_insight',
    description: 'Publish an AGENT_INSIGHT post to the Chainbook feed as Chainbook AI. Only when user explicitly asks to post something.',
    parameters: {
      type: 'object',
      properties: {
        heading:        { type: 'string',  description: 'Headline (max 100 chars)' },
        content:        { type: 'string',  description: 'Analysis (max 500 chars)' },
        related_tx_hash:{ type: 'string',  description: 'Related tx hash (optional)' },
        related_token:  { type: 'string',  description: 'Related token address (optional)' },
        is_whale_alert: { type: 'boolean', description: 'True if about a whale event' },
      },
      required: ['heading', 'content'],
    },
  },
]

// ─── Tool executor ────────────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {

    case 'get_recent_whale_alerts': {
      const limit = Math.min(Number(input.limit ?? 5), 10)
      const { data, error } = await supabase
        .from('posts')
        .select('id, wallet_address, amount_usd, token_in, token_out, contract_address, tx_hash, block_number, created_at, heading')
        .eq('is_whale_alert', true)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) return { error: error.message }

      const addrs = Array.from(new Set((data ?? []).map((p) => p.wallet_address).filter(Boolean)))
      let tierMap: Record<string, string> = {}
      if (addrs.length) {
        const { data: ws } = await supabase.from('wallets').select('address, tier').in('address', addrs)
        tierMap = Object.fromEntries((ws ?? []).map((w) => [w.address, w.tier]))
      }

      return {
        whale_alerts: (data ?? []).map((p) => ({ ...p, wallet_tier: tierMap[p.wallet_address] ?? 'UNKNOWN' })),
        count: (data ?? []).length,
      }
    }

    case 'get_trending_tokens': {
      const limit = Math.min(Number(input.limit ?? 5), 10)
      const { data, error } = await supabase
        .from('trending_entities')
        .select('entity_address, entity_name, entity_type, event_count, unique_wallets, velocity, rank')
        .order('rank', { ascending: true })
        .limit(limit)
      return error ? { error: error.message } : { trending: data ?? [], count: (data ?? []).length }
    }

    case 'estimate_price_impact': {
      const amountUsd = Number(input.amount_usd ?? 0)
      if (amountUsd <= 0) return { error: 'amount_usd must be > 0' }

      const since = new Date(Date.now() - 3_600_000).toISOString()
      let q = supabase
        .from('posts').select('amount_usd')
        .in('type', ['SWAP', 'LIQUIDITY_ADD', 'LIQUIDITY_REMOVE'])
        .gte('created_at', since).not('amount_usd', 'is', null).gt('amount_usd', 0)

      if (input.token_address) {
        const a = String(input.token_address).toLowerCase()
        q = q.or(`token_in.eq.${a},token_out.eq.${a},contract_address.eq.${a}`)
      }

      const { data: swaps } = await q.limit(200)
      const vol = (swaps ?? []).reduce((s, r) => s + Number(r.amount_usd ?? 0), 0)
      const liq = Math.max(vol * 5, 5_000)
      const pct = (amountUsd / (liq + amountUsd)) * 100

      return {
        amount_usd: amountUsd,
        estimated_liquidity_usd: Math.round(liq),
        price_impact_pct: parseFloat(pct.toFixed(2)),
        severity: pct < 0.5 ? 'NEGLIGIBLE' : pct < 2 ? 'LOW' : pct < 7 ? 'MEDIUM' : pct < 20 ? 'HIGH' : 'CRITICAL',
        confidence: vol > 50_000 ? 'HIGH' : vol > 5_000 ? 'MEDIUM' : 'LOW',
      }
    }

    case 'get_wallet_profile': {
      const addr = String(input.address ?? '').trim().toLowerCase()
      if (!addr.startsWith('0x')) return { error: 'Invalid address — must start with 0x' }

      const { data, error } = await supabase
        .from('wallets')
        .select('address, ens_name, label, tier, reputation_score, volume_usd, follower_count, following_count, activity_count, first_seen_at')
        .eq('address', addr).single()

      if (error || !data) return { error: 'Wallet not found on Chainbook' }

      const { count } = await supabase
        .from('posts').select('id', { count: 'exact', head: true })
        .eq('wallet_address', addr)
        .gte('created_at', new Date(Date.now() - 86_400_000).toISOString())

      return { wallet: { ...data, recent_posts_24h: count ?? 0 } }
    }

    case 'post_agent_insight': {
      const heading = String(input.heading ?? '').trim().slice(0, 100)
      const content = String(input.content ?? '').trim().slice(0, 500)
      if (!heading || !content) return { error: 'heading and content required' }

      await supabase.from('wallets').upsert(
        { address: AGENT_WALLET, label: 'Chainbook AI', tier: 'WHALE', updated_at: new Date().toISOString() },
        { onConflict: 'address' },
      )

      const { data: post, error } = await supabase.from('posts').insert({
        post_id_hash:   `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type:           'AGENT_INSIGHT',
        wallet_address: AGENT_WALLET,
        contract_address: (input.related_token as string) ?? null,
        token_in:       (input.related_token as string) ?? null,
        amount_usd:     0,
        amount_raw:     0,
        tx_hash:        input.related_tx_hash ? String(input.related_tx_hash) : `0xagent${Date.now().toString(16).padStart(60, '0')}`,
        block_number:   0,
        heading,
        content,
        is_whale_alert: Boolean(input.is_whale_alert),
        is_agent_post:  true,
        is_significant: true,
        significance_score: 30,
        metadata:       { agent: true, source: 'chat_panel', generated_at: new Date().toISOString() },
      }).select('id, created_at').single()

      return error ? { error: error.message } : { posted: true, post_id: post?.id, heading }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────
// Kept tight — every token in the system prompt is paid on every call.

const SYSTEM_PROMPT = `You are Chainbook AI — on-chain analyst for Chainbook, a social layer for Somnia Network.

Rules:
1. Always call a tool before answering — never rely on memory.
2. For whale questions: get_recent_whale_alerts → estimate_price_impact.
3. For wallet questions: get_wallet_profile.
4. For trending: get_trending_tokens.
5. Only call post_agent_insight when the user explicitly asks you to post.
6. Be concise: 2-4 sentences. Include specific numbers (USD, %, tiers).
7. Never give financial advice. Use "this suggests..." not "you should...".
8. Never shorten addresses. Always show full 0x wallet/contract addresses when mentioning them.

Wallet tiers: WHALE ≥$100k | SHARK | FISH | CRAB | SHRIMP (smallest)
Emoji: 🐋 whale | 🔥 trending | 📊 price | ⚡ Somnia`

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json() as { messages: NormedMessage[] }
    const clientKey = getClientKey(req)
    const rate = checkChatRateLimit(clientKey)

    if (rate.ok === false) {
      return NextResponse.json({ error: rate.reason }, { status: 429 })
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 })
    }

    const trimmedMessages = sanitizeMessages(messages)

    // Build provider from env — swap brain by changing AGENT_PROVIDER + AGENT_API_KEY
    let provider
    try {
      provider = createProviderFromEnv()
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 })
    }

    const executor = async (calls: ToolCall[]) =>
      Promise.all(calls.map(async (call) => ({
        id: call.id,
        result: await executeTool(call.name, call.input).catch((err) => ({ error: String(err) })),
      })))

    const reply = await runAgentLoop({
      provider,
      initialMessages: trimmedMessages,
      tools: TOOLS,
      system: SYSTEM_PROMPT,
      executor,
      maxRounds: CHAT_MAX_ROUNDS,
      maxTokens: CHAT_MAX_TOKENS,
    })

    return NextResponse.json({ reply })

  } catch (err) {
    console.error('[Agent chat] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
