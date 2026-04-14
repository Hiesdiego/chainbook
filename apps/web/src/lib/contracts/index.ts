//apps/web/src/lib/contracts/index.ts
// ABIs — only the functions the frontend needs

export const POST_REGISTRY_ABI = [
  {
    name: 'PostLiked',
    type: 'event',
    inputs: [
      { indexed: true, name: 'postId', type: 'bytes32' },
      { indexed: true, name: 'liker', type: 'address' },
    ],
    anonymous: false,
  },
  {
    name: 'PostUnliked',
    type: 'event',
    inputs: [
      { indexed: true, name: 'postId', type: 'bytes32' },
      { indexed: true, name: 'liker', type: 'address' },
    ],
    anonymous: false,
  },
  {
    name: 'likePost',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'postId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'unlikePost',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'postId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'hasLiked',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'postId', type: 'bytes32' },
      { name: 'wallet', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'getLikeCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'postId', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

export const FOLLOW_GRAPH_ABI = [
  {
    name: 'follow',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'subject', type: 'address' }],
    outputs: [],
  },
  {
    name: 'unfollow',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'subject', type: 'address' }],
    outputs: [],
  },
  {
    name: 'isFollowing',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'follower', type: 'address' },
      { name: 'subject', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'getFollowerCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'subject', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

export const TRACKER_REGISTRY_ABI = [
  {
    name: 'trackEntity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'entity', type: 'address' },
      { name: 'entityType', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'untrackEntity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'entity', type: 'address' }],
    outputs: [],
  },
  {
    name: 'isTracking',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tracker', type: 'address' },
      { name: 'entity', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

export const REPUTATION_ENGINE_ABI = [
  {
    name: 'getReputation',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [
      { name: 'score',         type: 'uint256' },
      { name: 'tier',          type: 'bytes32' },
      { name: 'volumeUsd',     type: 'uint256' },
      { name: 'activityCount', type: 'uint256' },
      { name: 'lastUpdated',   type: 'uint256' },
    ],
  },
] as const

// Contract addresses from env
export const CONTRACT_ADDRESSES = {
  postRegistry:      process.env.NEXT_PUBLIC_POST_REGISTRY_ADDRESS      as `0x${string}`,
  followGraph:       process.env.NEXT_PUBLIC_FOLLOW_GRAPH_ADDRESS        as `0x${string}`,
  trackerRegistry:   process.env.NEXT_PUBLIC_TRACKER_REGISTRY_ADDRESS   as `0x${string}`,
  reputationEngine:  process.env.NEXT_PUBLIC_REPUTATION_ENGINE_ADDRESS  as `0x${string}`,
  activityRegistry:  process.env.NEXT_PUBLIC_ACTIVITY_REGISTRY_ADDRESS  as `0x${string}`,
} as const