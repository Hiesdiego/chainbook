import type { Comment } from '@chainbook/shared'

type CreateCommentPayload = {
  postId: string
  walletAddress: string
  content: string
}

export async function createComment(payload: CreateCommentPayload): Promise<Comment> {
  const res = await fetch('/api/comments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    let message = 'Comment request failed'
    try {
      const data = (await res.json()) as { error?: string }
      if (data?.error) message = data.error
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message)
  }

  const data = (await res.json()) as { comment: Comment }
  return data.comment
}

export async function getCommentCounts(postIds: string[]): Promise<Record<string, number>> {
  const res = await fetch('/api/comments/counts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ postIds }),
  })

  if (!res.ok) {
    let message = 'Comment counts request failed'
    try {
      const data = (await res.json()) as { error?: string }
      if (data?.error) message = data.error
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message)
  }

  const data = (await res.json()) as { counts?: Record<string, number> }
  return data.counts ?? {}
}
