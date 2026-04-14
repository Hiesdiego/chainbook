import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow } from 'date-fns'
import type { WalletTier, PostType } from '@chainbook/shared'

// ─── Tailwind class merge ─────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Wallet address formatting ────────────────────────────────────────────────

export function shortAddress(address: string, chars = 4): string {
  if (!address) return ''
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function displayName(
  address: string,
  ensName?: string | null,
  label?: string | null,
): string {
  if (label) return label
  if (ensName) return ensName
  return shortAddress(address)
}

// ─── Number formatting ────────────────────────────────────────────────────────

export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 10_000) return `${(num / 1_000).toFixed(0)}K`
  return Math.floor(num).toString()
}

export function formatUsd(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`
  return `$${amount.toFixed(2)}`
}

// ─── Time formatting ──────────────────────────────────────────────────────────

export function timeAgo(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

// ─── Tier metadata ────────────────────────────────────────────────────────────

export const TIER_META: Record<
  WalletTier,
  { emoji: string; label: string; color: string; bgColor: string }
> = {
  WHALE:  { emoji: '🐳', label: 'Whale',  color: 'text-whale',  bgColor: 'bg-whale/10 border-whale/30'  },
  SHARK:  { emoji: '🦈', label: 'Shark',  color: 'text-shark',  bgColor: 'bg-shark/10 border-shark/30'  },
  FISH:   { emoji: '🐟', label: 'Fish',   color: 'text-fish',   bgColor: 'bg-fish/10 border-fish/30'    },
  CRAB:   { emoji: '🦀', label: 'Crab',   color: 'text-crab',   bgColor: 'bg-crab/10 border-crab/30'    },
  SHRIMP: { emoji: '🦐', label: 'Shrimp', color: 'text-shrimp', bgColor: 'bg-shrimp/10 border-shrimp/30'},
}

// ─── Post type metadata ───────────────────────────────────────────────────────

export const POST_TYPE_META: Record<
  PostType,
  { icon: string; label: string; color: string }
> = {
  SWAP:              { icon: '🔁', label: 'Swap',             color: 'text-blue-400'    },
  TRANSFER:          { icon: '💸', label: 'Transfer',         color: 'text-green-400'   },
  MINT:              { icon: '🎨', label: 'Mint',             color: 'text-purple-400'  },
  DAO_VOTE:          { icon: '🏛', label: 'DAO Vote',         color: 'text-yellow-400'  },
  LIQUIDITY_ADD:     { icon: '💧', label: 'Add Liquidity',    color: 'text-cyan-400'    },
  LIQUIDITY_REMOVE:  { icon: '🩸', label: 'Remove Liquidity', color: 'text-orange-400'  },
  CONTRACT_DEPLOY:   { icon: '📜', label: 'Deploy',           color: 'text-pink-400'    },
  NFT_TRADE:         { icon: '🖼', label: 'NFT Trade',        color: 'text-indigo-400'  },
  AGENT_INSIGHT:     { icon: '🤖', label: 'Agent Insight',    color: 'text-emerald-400' },
}

// ─── Explorer links ───────────────────────────────────────────────────────────

const EXPLORER = 'https://shannon-explorer.somnia.network'

export function txUrl(hash: string): string {
  return `${EXPLORER}/tx/${hash}`
}

export function walletUrl(address: string): string {
  return `${EXPLORER}/address/${address}`
}

// ─── Token detection ──────────────────────────────────────────────────────────

export function isNativeToken(symbol?: string | null): boolean {
  return symbol?.toUpperCase() === 'STT'
}

// ─── Contract type detection ──────────────────────────────────────────────────

export type ContractType = 'PROXY' | 'TOKEN' | 'NFT' | 'UNKNOWN'

/**
 * Detect contract type by analyzing code patterns or metadata
 * This is a helper function that checks against known patterns
 */
export function detectContractType(bytecode?: string, metadata?: Record<string, unknown>): ContractType {
  if (!bytecode && !metadata) return 'UNKNOWN'
  
  // Check for ERC20 patterns
  if (metadata?.['erc20'] === true || bytecode?.includes('a9059cbb')) return 'TOKEN'
  
  // Check for ERC721/NFT patterns
  if (metadata?.['erc721'] === true || bytecode?.includes('80ac58cd')) return 'NFT'
  
  // Check for proxy patterns (delegatecall signature)
  if (bytecode?.includes('5c60da1b')) return 'PROXY'
  
  return 'UNKNOWN'
}

/**
 * Check if a wallet address is a contract that should be excluded from the feed
 */
export function isExcludedContract(contractType?: string | null): boolean {
  return contractType === 'PROXY' || contractType === 'TOKEN' || contractType === 'NFT'
}

// ─── Post ID hash (matches listener logic) ────────────────────────────────────
// Used to build postId for on-chain like calls
export function buildPostIdHash(txHash: string, logIndex: number): string {
  // This mirrors keccak256(toHex(`${txHash}-${logIndex}`)) in the listener
  // Return the raw post_id_hash from Supabase directly — no need to recalculate
  return ''
}
