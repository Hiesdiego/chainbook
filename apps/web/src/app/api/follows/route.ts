import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

type FollowPayload = {
  follower?: string
  subject?: string
}

function normalizeAddress(value: string) {
  return value.trim().toLowerCase()
}

function validatePayload(payload: FollowPayload) {
  if (!payload.follower || !payload.subject) {
    return { error: 'Missing follower or subject address.' }
  }
  const follower = normalizeAddress(payload.follower)
  const subject = normalizeAddress(payload.subject)
  if (!follower || !subject) {
    return { error: 'Invalid follower or subject address.' }
  }
  if (follower === subject) {
    return { error: 'Cannot follow your own wallet.' }
  }
  return { follower, subject }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as FollowPayload | null
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const validated = validatePayload(body)
  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const { follower, subject } = validated
  const supabase = createAdminClient()

  const { error: walletError } = await supabase
    .from('wallets')
    .upsert(
      [{ address: follower }, { address: subject }],
      { onConflict: 'address' },
    )
  if (walletError) {
    return NextResponse.json({ error: walletError.message }, { status: 500 })
  }

  const { error } = await supabase
    .from('follows')
    .upsert({ follower, subject }, { onConflict: 'follower,subject' })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => null)) as FollowPayload | null
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const validated = validatePayload(body)
  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const { follower, subject } = validated
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower', follower)
    .eq('subject', subject)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
