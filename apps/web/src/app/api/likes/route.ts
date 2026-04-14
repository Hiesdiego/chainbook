import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

type LikePayload = {
  postId?: string
  walletAddress?: string
}

function normalizeAddress(value: string) {
  return value.trim().toLowerCase()
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as LikePayload | null
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.postId || !body.walletAddress) {
    return NextResponse.json({ error: 'Missing postId or walletAddress.' }, { status: 400 })
  }

  const postId = body.postId.trim()
  const walletAddress = normalizeAddress(body.walletAddress)
  if (!postId || !walletAddress) {
    return NextResponse.json({ error: 'Invalid postId or walletAddress.' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { error: walletError } = await supabase
    .from('wallets')
    .upsert({ address: walletAddress }, { onConflict: 'address' })
  if (walletError) {
    return NextResponse.json({ error: walletError.message }, { status: 500 })
  }

  const { data: currentPost, error: currentPostError } = await supabase
    .from('posts')
    .select('like_count')
    .eq('id', postId)
    .single()
  if (currentPostError) {
    return NextResponse.json({ error: currentPostError.message }, { status: 500 })
  }

  const nextLikeCount = Number(currentPost?.like_count ?? 0) + 1
  const { error: updateError } = await supabase
    .from('posts')
    .update({ like_count: nextLikeCount })
    .eq('id', postId)
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('like_count')
    .eq('id', postId)
    .single()
  if (postError) {
    return NextResponse.json({ error: postError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, likeCount: Number(post?.like_count ?? 0) })
}
