'use client'

import { useState } from 'react'
import { PostCard } from '@/components/feed/PostCard'
import { CommentSection } from '@/components/feed/CommentSection'
import type { Post, Comment } from '@chainbook/shared'

interface PostDetailClientProps {
  post: Post
  initialComments: Comment[]
}

export function PostDetailClient({ post, initialComments }: PostDetailClientProps) {
  const [commentCount, setCommentCount] = useState(post.comment_count ?? 0)

  return (
    <div className="flex flex-col gap-4">
      <PostCard
        post={{ ...post, comment_count: commentCount }}
        showFollowButton={false}
      />
      <CommentSection
        postId={post.id}
        initialComments={initialComments}
        onCountChange={setCommentCount}
      />
    </div>
  )
}
