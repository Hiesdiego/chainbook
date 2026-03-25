import { notFound } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { createAdminClient } from '@/lib/supabase/server'
import { PostDetailClient } from '@/components/feed/PostDetailClient'
import type { Post, Comment } from '@chainbook/shared'

interface PostPageProps {
  params: Promise<{ id: string }>
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: post } = await supabase
    .from('posts')
    .select('*, wallet:wallets(*)')
    .eq('id', id)
    .single()

  if (!post) notFound()

  const { data: comments } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', id)
    .order('created_at', { ascending: true })

  const postWithCounts = {
    ...(post as Post),
    comment_count: comments?.length ?? 0,
  }

  return (
    <AppShell>
      <PostDetailClient
        post={postWithCounts}
        initialComments={(comments ?? []) as Comment[]}
      />
    </AppShell>
  )
}
