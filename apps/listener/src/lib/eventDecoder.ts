// apps/listener/src/lib/eventDecoder.ts

import {
  decodeAbiParameters,
  parseAbiParameters,
  type Hex,
} from 'viem'
import type { PostType } from '@chainbook/shared'
import {
  ERC20_TRANSFER_TOPIC,
  ERC20_APPROVAL_TOPIC,
  ERC1155_TRANSFER_SINGLE_TOPIC,
  ERC1155_TRANSFER_BATCH_TOPIC,
  SWAP_V2_TOPIC,
  SWAP_V3_TOPIC,
  LIQUIDITY_ADD_TOPIC,
  LIQUIDITY_REMOVE_TOPIC,
  DAO_VOTE_TOPIC,
  WHALE_DETECTED_TOPIC,
  ZERO_ADDRESS,
} from './eventSignatures.js'

export interface DecodedEvent {
  wallet: string          // primary wallet involved
  contractAddress: string
  tokenIn: string | null
  tokenOut: string | null
  amountRaw: bigint | null
  metadata: Record<string, unknown>
  isWhaleEvent?: boolean
}

export function decodeEvent(
  topic0: string,
  topics: readonly Hex[],
  data: Hex,
  contractAddress: string,
): DecodedEvent | null {
  try {
    switch (topic0) {
      case ERC20_TRANSFER_TOPIC: {
        // Transfer(address indexed from, address indexed to, uint256 value)
        const from = topics[1] ? `0x${topics[1].slice(26)}` : null
        const to   = topics[2] ? `0x${topics[2].slice(26)}` : null
        const [value] = decodeAbiParameters(parseAbiParameters('uint256'), data)
        const wallet = from === ZERO_ADDRESS && to ? to : from ?? contractAddress
        return {
          wallet,
          contractAddress,
          tokenIn: contractAddress,
          tokenOut: null,
          amountRaw: value,
          metadata: { from, to, value: value.toString() },
        }
      }

      case ERC20_APPROVAL_TOPIC: {
        // Approval(address indexed owner, address indexed spender, uint256 value)
        const owner = topics[1] ? `0x${topics[1].slice(26)}` : contractAddress
        const spender = topics[2] ? `0x${topics[2].slice(26)}` : null
        const [value] = decodeAbiParameters(parseAbiParameters('uint256'), data)
        return {
          wallet: owner,
          contractAddress,
          tokenIn: contractAddress,
          tokenOut: null,
          amountRaw: value,
          metadata: {
            event_kind: 'APPROVAL',
            approval_owner: owner,
            approval_spender: spender,
            approval_value: value.toString(),
          },
        }
      }

      case ERC1155_TRANSFER_SINGLE_TOPIC: {
        // TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)
        const operator = topics[1] ? `0x${topics[1].slice(26)}` : null
        const from = topics[2] ? `0x${topics[2].slice(26)}` : null
        const to = topics[3] ? `0x${topics[3].slice(26)}` : null
        const [tokenId, value] = decodeAbiParameters(
          parseAbiParameters('uint256, uint256'),
          data,
        )
        const wallet = from === ZERO_ADDRESS && to ? to : from ?? operator ?? contractAddress
        return {
          wallet,
          contractAddress,
          tokenIn: contractAddress,
          tokenOut: null,
          amountRaw: value,
          metadata: {
            event_kind: 'ERC1155_TRANSFER_SINGLE',
            operator,
            from,
            to,
            token_id: tokenId.toString(),
            value: value.toString(),
          },
        }
      }

      case ERC1155_TRANSFER_BATCH_TOPIC: {
        // TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)
        const operator = topics[1] ? `0x${topics[1].slice(26)}` : null
        const from = topics[2] ? `0x${topics[2].slice(26)}` : null
        const to = topics[3] ? `0x${topics[3].slice(26)}` : null
        const [tokenIds, values] = decodeAbiParameters(
          parseAbiParameters('uint256[], uint256[]'),
          data,
        )
        const total = (values as bigint[]).reduce((sum, next) => sum + next, 0n)
        const wallet = from === ZERO_ADDRESS && to ? to : from ?? operator ?? contractAddress
        return {
          wallet,
          contractAddress,
          tokenIn: contractAddress,
          tokenOut: null,
          amountRaw: total,
          metadata: {
            event_kind: 'ERC1155_TRANSFER_BATCH',
            operator,
            from,
            to,
            token_ids: (tokenIds as bigint[]).map((id) => id.toString()),
            values: (values as bigint[]).map((value) => value.toString()),
            transfer_count: (values as bigint[]).length,
            value_total: total.toString(),
          },
        }
      }

      case SWAP_V2_TOPIC: {
        // Swap(address indexed sender, uint256 a0In, uint256 a1In, uint256 a0Out, uint256 a1Out, address indexed to)
        const sender = topics[1] ? `0x${topics[1].slice(26)}` : contractAddress
        const [a0In, a1In, a0Out, a1Out] = decodeAbiParameters(
          parseAbiParameters('uint256, uint256, uint256, uint256'),
          data,
        )
        const amountIn  = a0In > 0n ? a0In : a1In
        const amountOut = a0Out > 0n ? a0Out : a1Out
        return {
          wallet: sender,
          contractAddress,
          tokenIn: null,
          tokenOut: null,
          amountRaw: amountIn,
          metadata: {
            sender,
            amount0In: a0In.toString(),
            amount1In: a1In.toString(),
            amount0Out: a0Out.toString(),
            amount1Out: a1Out.toString(),
            amountIn: amountIn.toString(),
            amountOut: amountOut.toString(),
          },
        }
      }

      case SWAP_V3_TOPIC: {
        // Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, ...)
        const sender = topics[1] ? `0x${topics[1].slice(26)}` : contractAddress
        const [amount0, amount1] = decodeAbiParameters(
          parseAbiParameters('int256, int256'),
          data,
        )
        const amountRaw = amount0 < 0n ? -amount0 : amount0
        return {
          wallet: sender,
          contractAddress,
          tokenIn: null,
          tokenOut: null,
          amountRaw,
          metadata: {
            sender,
            amount0: amount0.toString(),
            amount1: amount1.toString(),
          },
        }
      }

      case LIQUIDITY_ADD_TOPIC:
      case LIQUIDITY_REMOVE_TOPIC: {
        const sender = topics[1] ? `0x${topics[1].slice(26)}` : contractAddress
        const [amount0, amount1] = decodeAbiParameters(
          parseAbiParameters('uint256, uint256'),
          data,
        )
        return {
          wallet: sender,
          contractAddress,
          tokenIn: null,
          tokenOut: null,
          amountRaw: amount0 + amount1,
          metadata: { sender, amount0: amount0.toString(), amount1: amount1.toString() },
        }
      }

      case DAO_VOTE_TOPIC: {
        // VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)
        const voter = topics[1] ? `0x${topics[1].slice(26)}` : contractAddress
        const [proposalId, support, weight] = decodeAbiParameters(
          parseAbiParameters('uint256, uint8, uint256'),
          data,
        )
        return {
          wallet: voter,
          contractAddress,
          tokenIn: null,
          tokenOut: null,
          amountRaw: null,
          metadata: {
            voter,
            proposalId: proposalId.toString(),
            support: Number(support),
            weight: weight.toString(),
          },
        }
      }

      case WHALE_DETECTED_TOPIC: {
        // WhaleDetected(address indexed from, address indexed to, uint256 amount, address indexed token)
        const from = topics[1] ? `0x${topics[1].slice(26)}` : null
        const to = topics[2] ? `0x${topics[2].slice(26)}` : null
        const token = topics[3] ? `0x${topics[3].slice(26)}` : null
        const [amount] = decodeAbiParameters(parseAbiParameters('uint256'), data)
        return {
          wallet: from ?? contractAddress,
          contractAddress: token ?? contractAddress,
          tokenIn: token,
          tokenOut: null,
          amountRaw: amount,
          isWhaleEvent: true,
          metadata: {
            event_kind: 'WHALE_DETECTED',
            from,
            to,
            value: amount.toString(),
            token,
            whale_watcher_contract: contractAddress,
            detected_on_chain: true,
          },
        }
      }

      default:
        return null
    }
  } catch {
    return null
  }
}
