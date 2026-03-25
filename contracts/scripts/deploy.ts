import { network } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

async function main() {
  const { viem } = await network.connect()
  const publicClient = await viem.getPublicClient()
  const [deployer] = await viem.getWalletClients()

  if (!deployer) {
    throw new Error('No deployer wallet configured. Set DEPLOYER_PRIVATE_KEY in .env.')
  }

  const address = deployer.account.address
  const balance = await publicClient.getBalance({ address })
  console.log('Deploying contracts with:', address)
  console.log('Balance:', balance.toString(), 'wei')

  console.log('\n-> Deploying ActivityRegistry...')
  const activityRegistry = await viem.deployContract('ActivityRegistry')
  const activityRegistryAddress = activityRegistry.address
  console.log('  ActivityRegistry deployed to:', activityRegistryAddress)

  console.log('\n-> Deploying TrackerRegistry...')
  const trackerRegistry = await viem.deployContract('TrackerRegistry')
  const trackerRegistryAddress = trackerRegistry.address
  console.log('  TrackerRegistry deployed to:', trackerRegistryAddress)

  console.log('\n-> Deploying FollowGraph...')
  const followGraph = await viem.deployContract('FollowGraph')
  const followGraphAddress = followGraph.address
  console.log('  FollowGraph deployed to:', followGraphAddress)

  console.log('\n-> Deploying PostRegistry...')
  const postRegistry = await viem.deployContract('PostRegistry')
  const postRegistryAddress = postRegistry.address
  console.log('  PostRegistry deployed to:', postRegistryAddress)

  console.log('\n-> Deploying ReputationEngine...')
  const reputationEngine = await viem.deployContract('ReputationEngine')
  const reputationEngineAddress = reputationEngine.address
  console.log('  ReputationEngine deployed to:', reputationEngineAddress)

  console.log('\n-> Deploying ChainbookReactivityShowcase...')
  const reactivityShowcase = await viem.deployContract('ChainbookReactivityShowcase')
  const reactivityShowcaseAddress = reactivityShowcase.address
  console.log('  ChainbookReactivityShowcase deployed to:', reactivityShowcaseAddress)

  const chainId = await publicClient.getChainId()
  const addresses = {
    ActivityRegistry: activityRegistryAddress,
    TrackerRegistry: trackerRegistryAddress,
    FollowGraph: followGraphAddress,
    PostRegistry: postRegistryAddress,
    ReputationEngine: reputationEngineAddress,
    ChainbookReactivityShowcase: reactivityShowcaseAddress,
    deployedAt: new Date().toISOString(),
    chainId,
  }

  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const outputPath = path.join(__dirname, '../deployments.json')
  fs.writeFileSync(outputPath, JSON.stringify(addresses, null, 2))
  console.log('\nAll contracts deployed. Addresses saved to contracts/deployments.json')
  const envPath = path.resolve(__dirname, '../../.env')
  const updates: Record<string, string> = {
    NEXT_PUBLIC_ACTIVITY_REGISTRY_ADDRESS: activityRegistryAddress,
    NEXT_PUBLIC_TRACKER_REGISTRY_ADDRESS: trackerRegistryAddress,
    NEXT_PUBLIC_FOLLOW_GRAPH_ADDRESS: followGraphAddress,
    NEXT_PUBLIC_POST_REGISTRY_ADDRESS: postRegistryAddress,
    NEXT_PUBLIC_REPUTATION_ENGINE_ADDRESS: reputationEngineAddress,
    REACTIVITY_SHOWCASE_HANDLER_ADDRESS: reactivityShowcaseAddress,
  }

  let envText = ''
  if (fs.existsSync(envPath)) {
    envText = fs.readFileSync(envPath, 'utf8')
  }

  const lines = envText.split(/\r?\n/)
  const seen = new Set<string>()
  const nextLines = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/)
    if (!match) return line
    const key = match[1]
    if (key in updates) {
      seen.add(key)
      return `${key}=${updates[key]}`
    }
    return line
  })

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) nextLines.push(`${key}=${value}`)
  }

  const finalText = nextLines.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n')
  fs.writeFileSync(envPath, finalText.endsWith('\n') ? finalText : `${finalText}\n`)
  console.log('\nUpdated .env with deployed contract addresses.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
