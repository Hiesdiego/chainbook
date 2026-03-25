import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

type LikePayload = {
  postId?: string
  walletAddress?: string
}

function normalize(value: string) {
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
  const walletAddress = normalize(body.walletAddress)
  if (!postId || !walletAddress) {
    return NextResponse.json({ error: 'Invalid postId or walletAddress.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: existingPost, error: postError } = await supabase
    .from('posts')
    .select('id')
    .eq('id', postId)
    .single()
  if (postError || !existingPost) {
    return NextResponse.json({ error: 'Post not found.' }, { status: 404 })
  }

  const { error } = await supabase.rpc('increment_post_likes', { p_post_id: postId })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: updated, error: readError } = await supabase
    .from('posts')
    .select('like_count')
    .eq('id', postId)
    .single()
  if (readError || !updated) {
    return NextResponse.json({ error: readError?.message ?? 'Failed to read like count.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, likeCount: updated.like_count ?? 0 })
}
