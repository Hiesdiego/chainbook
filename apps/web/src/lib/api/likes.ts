type LikePayload = {
  postId: string
  walletAddress: string
}

export async function likePost(payload: LikePayload): Promise<number> {
  const res = await fetch('/api/likes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    let message = 'Like request failed'
    try {
      const data = (await res.json()) as { error?: string }
      if (data?.error) message = data.error
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message)
  }

  const data = (await res.json()) as { likeCount?: number }
  return data.likeCount ?? 0
}
