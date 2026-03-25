import { SDK } from '@somnia-chain/reactivity'
import { createPublicClient, createWalletClient, http, parseGwei, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { somniaTestnet } from '../config/chain.js'
import { env } from '../config/env.js'
import {
  ERC20_TRANSFER_TOPIC,
  SWAP_V2_TOPIC,
  SWAP_V3_TOPIC,
  LIQUIDITY_ADD_TOPIC,
  LIQUIDITY_REMOVE_TOPIC,
  DAO_VOTE_TOPIC,
} from '../lib/eventSignatures.js'

function normalizePrivateKey(raw: string | undefined): Hex | undefined {
  if (!raw) return undefined

  let value = raw.trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).trim()
  }
  if (!value.startsWith('0x')) {
    value = `0x${value}`
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    return undefined
  }
  return value as Hex
}

async function main() {
  if (!env.REACTIVITY_SHOWCASE_HANDLER_ADDRESS) {
    throw new Error('Missing REACTIVITY_SHOWCASE_HANDLER_ADDRESS')
  }
  const privateKey = normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY)
  if (!privateKey) {
    throw new Error('Invalid DEPLOYER_PRIVATE_KEY. Expected 64 hex chars, with or without 0x prefix.')
  }

  const account = privateKeyToAccount(privateKey)
  const publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: http(env.SOMNIA_RPC_HTTP),
  })
  const walletClient = createWalletClient({
    account,
    chain: somniaTestnet,
    transport: http(env.SOMNIA_RPC_HTTP),
  })

  const sdk = new SDK({
    public: publicClient,
    wallet: walletClient,
  })

  const eventTopics = (env.REACTIVITY_SPOTLIGHT_TOPICS.length > 0
    ? env.REACTIVITY_SPOTLIGHT_TOPICS
    : [
        ERC20_TRANSFER_TOPIC,
        SWAP_V2_TOPIC,
        SWAP_V3_TOPIC,
        LIQUIDITY_ADD_TOPIC,
        LIQUIDITY_REMOVE_TOPIC,
        DAO_VOTE_TOPIC,
      ]) as Hex[]

  const result = await sdk.createSoliditySubscription({
    eventTopics,
    handlerContractAddress: env.REACTIVITY_SHOWCASE_HANDLER_ADDRESS as Hex,
    priorityFeePerGas: parseGwei('2'),
    maxFeePerGas: parseGwei('10'),
    gasLimit: 500_000n,
    isGuaranteed: true,
    isCoalesced: false,
  } as never)

  if (result instanceof Error) {
    throw result
  }

  console.log('Showcase subscription tx hash:', result)
}

main().catch((error) => {
  console.error('[ShowcaseSubscription] Failed:', error)
  process.exit(1)
})
