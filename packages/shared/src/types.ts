// ─── Wallet / Profile ─────────────────────────────────────────────────────────

export type WalletTier = 'WHALE' | 'SHARK' | 'FISH' | 'SHRIMP' | 'CRAB'
export type ContractType = 'PROXY' | 'TOKEN' | 'NFT' | 'UNKNOWN' | null

export interface Wallet {
  address: string
  ens_name: string | null
  label: string | null
  tier: WalletTier
  reputation_score: number
  volume_usd: number
  follower_count: number
  following_count: number
  nft_count: number
  wallet_balance_usd?: number | null
  contract_type?: ContractType
  first_seen_at: string
  updated_at: string
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export type PostType =
  | 'SWAP'
  | 'TRANSFER'
  | 'MINT'
  | 'DAO_VOTE'
  | 'LIQUIDITY_ADD'
  | 'LIQUIDITY_REMOVE'
  | 'CONTRACT_DEPLOY'
  | 'NFT_TRADE'

export interface Post {
  id: string
  post_id_hash: string
  type: PostType
  heading?: string | null
  content?: string | null
  wallet_address: string
  contract_address: string | null
  token_in: string | null
  token_out: string | null
  amount_raw: string | null
  amount_usd: number | null
  tx_hash: string
  block_number: number
  metadata: Record<string, unknown>
  like_count: number
  comment_count: number
  is_whale_alert: boolean
  significance_score?: number | null
  is_significant?: boolean | null
  created_at: string
  wallet?: Wallet
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export interface Comment {
  id: string
  post_id: string
  wallet_address: string
  content: string
  created_at: string
  wallet?: Wallet
}

// ─── Follows ──────────────────────────────────────────────────────────────────

export interface Follow {
  follower: string
  subject: string
  created_at: string
}

// ─── Trending ─────────────────────────────────────────────────────────────────

export interface TrendingEntity {
  entity_address: string
  entity_type: 'WALLET' | 'CONTRACT' | 'TOKEN' | 'NFT'
  entity_name: string | null
  event_count: number
  unique_wallets: number
  velocity: number
  rank: number
  updated_at: string
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface Notification {
  id: string
  wallet_address: string
  post_id: string
  type:
    | 'WHALE_ALERT'
    | 'FOLLOWED_WALLET_ACTIVITY'
    | 'TRACKED_CONTRACT'
    | 'TRACKED_WALLET'
    | 'ALERT_ACTIVITY'
    | 'ALERT_LARGE_TRADE'
  read: boolean
  created_at: string
  post?: Post
}

// Token metadata cache
export interface TokenMetadata {
  address: string
  name: string | null
  symbol: string | null
  decimals: number | null
  is_nft: boolean
  updated_at: string
}

export interface WalletTokenHolding {
  wallet_address: string
  token_address: string
  balance_raw: string | null
  decimals: number | null
  balance_usd: number | null
  token_symbol?: string | null
  token_name?: string | null
  updated_at: string
}

export interface MintedToken {
  wallet_address: string
  token_address: string
  kind: 'CREATED' | 'MINTED'
  tx_hash: string
  created_at: string
  token_symbol?: string | null
  token_name?: string | null
}

// ─── Somnia Chain Definition ──────────────────────────────────────────────────

export const SOMNIA_TESTNET_CHAIN_ID = 50312

export const SOMNIA_TESTNET = {
  id: SOMNIA_TESTNET_CHAIN_ID,
  name: 'Somnia Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Somnia Test Token',
    symbol: 'STT',
  },
  rpcUrls: {
    default: {
      http: ['https://dream-rpc.somnia.network'],
      webSocket: ['wss://dream-rpc.somnia.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Somnia Explorer',
      url: 'https://shannon-explorer.somnia.network',
    },
  },
  testnet: true,
} as const

// ─── Whale threshold ─────────────────────────────────────────────────────────

export const WHALE_ALERT_THRESHOLD_USD = 100_000
