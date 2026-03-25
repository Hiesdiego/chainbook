// apps/listener/src/lib/eventSignatures.ts

import { keccak256, toHex, encodeAbiParameters, parseAbiParameters } from 'viem'
import type { PostType } from '@chainbook/shared'

// ─── ERC-20 & ERC-721 standards ───────────────────────────────────────────────

// Transfer(address indexed from, address indexed to, uint256 value)
export const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

// Approval(address indexed owner, address indexed spender, uint256 value)
export const ERC20_APPROVAL_TOPIC =
  '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'

// ERC-1155 TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)
export const ERC1155_TRANSFER_SINGLE_TOPIC =
  '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62'

// ERC-1155 TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)
export const ERC1155_TRANSFER_BATCH_TOPIC =
  '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb'

// ─── Uniswap V2/V3 compatible swap ───────────────────────────────────────────

// Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)
export const SWAP_V2_TOPIC =
  '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822'

// Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)
export const SWAP_V3_TOPIC =
  '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67'

// ─── Liquidity ────────────────────────────────────────────────────────────────

// Mint(address indexed sender, uint256 amount0, uint256 amount1)
export const LIQUIDITY_ADD_TOPIC =
  '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f'

// Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to)
export const LIQUIDITY_REMOVE_TOPIC =
  '0xdccd412f0b1252819cb1fd330b93224ca42612892bb3f4f789976e6d81936496'

// ─── NFT ─────────────────────────────────────────────────────────────────────

// Transfer from zero address = Mint
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

// ─── DAO / Governance ────────────────────────────────────────────────────────

// VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)
export const DAO_VOTE_TOPIC =
  '0xb8e138887d0aa13bab447e82de9d5c1777041ecd21ca36ba824ff1e6c07ddda4'

// WhaleDetected(address indexed from, address indexed to, uint256 amount, address indexed token)
export const WHALE_DETECTED_TOPIC = keccak256(
  toHex('WhaleDetected(address,address,uint256,address)'),
)

// ─── Topic → PostType mapping ─────────────────────────────────────────────────

export function classifyEventTopic(topic0: string, from?: string): PostType | null {
  switch (topic0) {
    case ERC20_TRANSFER_TOPIC:
      // If from == zero address it's a mint
      if (from === ZERO_ADDRESS) return 'MINT'
      return 'TRANSFER'
    case ERC20_APPROVAL_TOPIC:
      // Reuse TRANSFER lane in feed; metadata distinguishes approvals.
      return 'TRANSFER'
    case ERC1155_TRANSFER_SINGLE_TOPIC:
    case ERC1155_TRANSFER_BATCH_TOPIC:
      if (from === ZERO_ADDRESS) return 'MINT'
      return 'NFT_TRADE'
    case SWAP_V2_TOPIC:
    case SWAP_V3_TOPIC:
      return 'SWAP'
    case LIQUIDITY_ADD_TOPIC:
      return 'LIQUIDITY_ADD'
    case LIQUIDITY_REMOVE_TOPIC:
      return 'LIQUIDITY_REMOVE'
    case DAO_VOTE_TOPIC:
      return 'DAO_VOTE'
    case WHALE_DETECTED_TOPIC:
      // WhaleWatcher validated threshold on-chain; processEvent forces whale alert.
      return 'TRANSFER'
    default:
      return null
  }
}

export function extractFromAddressForTopic(
  topic0: string,
  topics: readonly string[],
): string | undefined {
  if (topic0 === ERC1155_TRANSFER_SINGLE_TOPIC || topic0 === ERC1155_TRANSFER_BATCH_TOPIC) {
    const fromRaw = topics[2]
    return fromRaw ? `0x${fromRaw.slice(26)}` : undefined
  }

  const fromRaw = topics[1]
  return fromRaw ? `0x${fromRaw.slice(26)}` : undefined
}
