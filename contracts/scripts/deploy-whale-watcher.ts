/**
 * apps/listener/scripts/deploy-whale-watcher.ts
 *
 * One-time deployment script.  Run with:
 *   tsx apps/listener/scripts/deploy-whale-watcher.ts
 *
 * What it does:
 *   1. Deploys WhaleWatcher.sol to Somnia testnet
 *   2. Creates a Somnia on-chain subscription that forwards ERC20 Transfer
 *      events from all watched WSTT contracts to the WhaleWatcher handler
 *   3. Prints the env vars you need to add to your .env
 *
 * Prerequisites:
 *   - DEPLOYER_PRIVATE_KEY in your .env
 *   - Deployer wallet funded with enough STT for deployment gas
 *   - Deployer wallet holds >= 32 SOMI (subscription minimum balance)
 *   - @somnia-chain/reactivity and viem installed
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { privateKeyToAccount } from 'viem/accounts'

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') })

import {
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  defineChain,
  parseGwei,
  parseUnits,
  keccak256,
  toBytes,
  type Hex,
} from 'viem'
import { SDK } from '@somnia-chain/reactivity'

// ─── Chain definition ────────────────────────────────────────────────────────

const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { decimals: 18, name: 'Somnia Test Token', symbol: 'STT' },
  rpcUrls: {
    default: {
      http: [process.env.SOMNIA_RPC_HTTP ?? 'https://dream-rpc.somnia.network'],
      webSocket: [process.env.SOMNIA_RPC_WS ?? 'wss://dream-rpc.somnia.network/ws'],
    },
  },
})

// ─── Configuration ───────────────────────────────────────────────────────────

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined
if (!PRIVATE_KEY) throw new Error('DEPLOYER_PRIVATE_KEY not set in .env')

// Whale threshold: 100,000 WSTT (18 decimals)
const WHALE_THRESHOLD = parseUnits('100000', 18)

// WSTT contract addresses to watch — add more as needed
const WSTT_ADDRESSES: Hex[] = [
  '0x4A3BC48C156384f9564Fd65A53a2f3D534D8f2b7',
  '0x0E11D445E28b4D3de722285D66c925007F979999',
]

// ERC20 Transfer topic (hardcoded — it never changes)
const TRANSFER_TOPIC: Hex =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

// WhaleDetected(address indexed from, address indexed to, uint256 amount, address indexed token)
const WHALE_DETECTED_TOPIC = keccak256(
  toBytes('WhaleDetected(address,address,uint256,address)'),
) as Hex

// ─── Compiled WhaleWatcher bytecode ──────────────────────────────────────────
// Generate this by compiling WhaleWatcher.sol with your Hardhat/Foundry setup:
//   npx hardhat compile  →  artifacts/contracts/WhaleWatcher.sol/WhaleWatcher.json → bytecode
// Then paste the "bytecode" field here.
const WHALE_WATCHER_BYTECODE = process.env.WHALE_WATCHER_BYTECODE as Hex | undefined
if (!WHALE_WATCHER_BYTECODE) {
  throw new Error(
    'WHALE_WATCHER_BYTECODE not set.\n' +
    'Compile WhaleWatcher.sol and set the bytecode in your .env:\n' +
    '  WHALE_WATCHER_BYTECODE=0x...',
  )
}

// ABI for deployment (constructor only — minimal)
const WHALE_WATCHER_ABI = [
  {
    type: 'constructor',
    inputs: [
      { name: '_threshold', type: 'uint256' },
      { name: '_tokens',    type: 'address[]' },
    ],
    stateMutability: 'nonpayable',
  },
] as const

// ─── Clients ─────────────────────────────────────────────────────────────────

const account = privateKeyToAccount(PRIVATE_KEY)

const publicClient = createPublicClient({
  chain: somniaTestnet,
  transport: http(process.env.SOMNIA_RPC_HTTP),
})

const walletClient = createWalletClient({
  account,
  chain: somniaTestnet,
  transport: http(process.env.SOMNIA_RPC_HTTP),
})

const wsPublicClient = createPublicClient({
  chain: somniaTestnet,
  transport: webSocket(process.env.SOMNIA_RPC_WS),
})

const sdk = new SDK({
  public: wsPublicClient,
  wallet: walletClient,
})

// ─── Deploy ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nDeploying WhaleWatcher from: ${account.address}`)
  console.log(`Threshold: ${WHALE_THRESHOLD.toString()} wei (100,000 WSTT)`)
  console.log(`Watching ${WSTT_ADDRESSES.length} WSTT contract(s):`)
  WSTT_ADDRESSES.forEach((a) => console.log(`  ${a}`))

  // 1. Deploy the contract
  console.log('\n[1/3] Deploying WhaleWatcher contract...')
  const deployHash = await walletClient.deployContract({
    abi: WHALE_WATCHER_ABI,
    bytecode: WHALE_WATCHER_BYTECODE,
    args: [WHALE_THRESHOLD, WSTT_ADDRESSES],
  })
  console.log(`  tx: ${deployHash}`)

  const deployReceipt = await publicClient.waitForTransactionReceipt({
    hash: deployHash,
  })
  const contractAddress = deployReceipt.contractAddress
  if (!contractAddress) throw new Error('Deployment failed — no contract address in receipt')
  console.log(`  deployed at: ${contractAddress}`)

  // 2. Create one Somnia subscription per WSTT address
  //    Each subscription: "when Transfer fires from <wstt>, call WhaleWatcher"
  console.log(`\n[2/3] Creating ${WSTT_ADDRESSES.length} Somnia subscription(s)...`)
  const subscriptionIds: string[] = []

  for (const wsttAddress of WSTT_ADDRESSES) {
    console.log(`  subscribing for emitter: ${wsttAddress}`)
    const subId = await sdk.createSoliditySubscription({
      handlerContractAddress: contractAddress,
      emitter: wsttAddress,
      eventTopics: [TRANSFER_TOPIC],
      priorityFeePerGas: parseGwei('0'),    // 0 gwei — standard
      maxFeePerGas:      parseGwei('10'),   // 10 gwei ceiling
      gasLimit:          2_000_000n,        // sufficient for emit + storage check
      isGuaranteed:      true,              // deliver even if block distance > 1
      isCoalesced:       false,             // one notification per Transfer
    })
    console.log(`  subscription id: ${subId}`)
    subscriptionIds.push(String(subId))
  }

  // 3. Print env vars
  console.log('\n[3/3] Add these to your .env:\n')
  console.log(`REACTIVITY_SHOWCASE_HANDLER_ADDRESS=${contractAddress}`)
  console.log(`REACTIVITY_SHOWCASE_TOPIC0=${WHALE_DETECTED_TOPIC}`)
  console.log(`WHALE_WATCHER_ADDRESS=${contractAddress}`)
  console.log(`# Subscription IDs (keep for reference): ${subscriptionIds.join(', ')}`)
  console.log(`\nWhaleDetected topic0: ${WHALE_DETECTED_TOPIC}`)
  console.log('\nDone. Restart your listener after updating .env.')
}

main().catch((err) => {
  console.error('Deploy failed:', err)
  process.exit(1)
})
