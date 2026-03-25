import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

type CountsPayload = {
  postIds?: string[]
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as CountsPayload | null
  if (!body || !Array.isArray(body.postIds)) {
    return NextResponse.json({ error: 'Invalid postIds.' }, { status: 400 })
  }

  const postIds = body.postIds
    .map((id) => id.trim())
    .filter((id) => id.length > 0)

  if (postIds.length === 0) {
    return NextResponse.json({ counts: {} })
  }

  if (postIds.length > 100) {
    return NextResponse.json({ error: 'Too many postIds.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('get_comment_counts', { p_post_ids: postIds })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.post_id as string] = Number(row.comment_count ?? 0)
  }
  for (const id of postIds) {
    if (counts[id] === undefined) counts[id] = 0
  }

  return NextResponse.json({ counts })
}
