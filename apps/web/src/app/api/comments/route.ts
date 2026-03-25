import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

type CommentPayload = {
  postId?: string
  walletAddress?: string
  content?: string
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as CommentPayload | null
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.postId || !body.walletAddress || !body.content) {
    return NextResponse.json({ error: 'Missing postId, walletAddress, or content.' }, { status: 400 })
  }

  const postId = body.postId.trim()
  const walletAddress = normalize(body.walletAddress)
  const content = body.content.trim()

  if (!postId || !walletAddress || !content) {
    return NextResponse.json({ error: 'Invalid postId, walletAddress, or content.' }, { status: 400 })
  }

  if (content.length > 500) {
    return NextResponse.json({ error: 'Comment is too long.' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { error: walletError } = await supabase
    .from('wallets')
    .upsert({ address: walletAddress }, { onConflict: 'address' })
  if (walletError) {
    return NextResponse.json({ error: walletError.message }, { status: 500 })
  }

  const { data: comment, error } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      wallet_address: walletAddress,
      content,
    })
    .select('*')
    .single()

  if (error || !comment) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create comment.' }, { status: 500 })
  }

  return NextResponse.json({ comment })
}
