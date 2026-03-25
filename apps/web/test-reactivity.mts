// test-reactivity.mts
import { SDK } from '@somnia-chain/reactivity'
import { createPublicClient, webSocket, defineChain } from 'viem'

const chain = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { decimals: 18, name: 'STT', symbol: 'STT' },
  rpcUrls: {
    default: {
      http: ['https://dream-rpc.somnia.network'],
      webSocket: ['wss://dream-rpc.somnia.network/ws'],
    },
  },
})

const client = createPublicClient({
  chain,
  transport: webSocket('wss://dream-rpc.somnia.network/ws'),
})

const sdk = new SDK({ public: client })

console.log('Subscribing (no topicOverrides — pure wildcard)...')
const sub = await sdk.subscribe({
  ethCalls: [],
  onData: (d) => console.log('GOT DATA:', JSON.stringify(d)),
  onError: (e) => console.error('ERROR:', e),
})
console.log('Subscribed. Waiting 60s for any event...')

setTimeout(() => {
  console.log('60s elapsed — no data received. Endpoint does not push Reactivity events.')
  process.exit(0)
}, 60_000)