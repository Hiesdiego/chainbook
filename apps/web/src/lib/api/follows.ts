export type FollowPayload = {
  follower: string
  subject: string
}

async function requestFollow(endpoint: string, payload: FollowPayload, method: 'POST' | 'DELETE') {
  const res = await fetch(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    let message = 'Follow request failed'
    try {
      const data = (await res.json()) as { error?: string }
      if (data?.error) message = data.error
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message)
  }
}

export async function followWallet(payload: FollowPayload) {
  await requestFollow('/api/follows', payload, 'POST')
}

export async function unfollowWallet(payload: FollowPayload) {
  await requestFollow('/api/follows', payload, 'DELETE')
}
