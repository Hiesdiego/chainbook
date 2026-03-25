// apps/listener/src/config/chain.ts

import { createPublicClient, http, webSocket, defineChain } from 'viem'
import { env } from './env.js'

function makeSomniaChain(wsUrl: string) {
  return defineChain({
    id: 50312,
    name: 'Somnia Testnet',
    nativeCurrency: {
      decimals: 18,
      name: 'Somnia Test Token',
      symbol: 'STT',
    },
    rpcUrls: {
      default: {
        http: [env.SOMNIA_RPC_HTTP],
        webSocket: [wsUrl],
      },
    },
    blockExplorers: {
      default: {
        name: 'Somnia Explorer',
        url: 'https://shannon-explorer.somnia.network',
      },
    },
    testnet: true,
  })
}

export const somniaTestnet = makeSomniaChain(env.SOMNIA_RPC_WS)
export const somniaReactivityTestnet = makeSomniaChain(
  env.SOMNIA_REACTIVITY_WS ?? env.SOMNIA_RPC_WS,
)

// HTTP client — used for reading contract state
export const publicClientHttp = createPublicClient({
  chain: somniaTestnet,
  transport: http(env.SOMNIA_RPC_HTTP, {
    timeout: env.RPC_TIMEOUT_MS,
    retryCount: env.RPC_RETRY_COUNT,
    retryDelay: env.RPC_RETRY_DELAY_MS,
  }),
})

// WebSocket client — used for Reactivity SDK
export const publicClientWs = createPublicClient({
  chain: somniaTestnet,
  transport: webSocket(env.SOMNIA_RPC_WS),
})

// Reactivity SDK internally creates its own WS transport from chain metadata.
// Keep a dedicated chain config so we can point reactivity to a provider
// that supports `somnia_watch` without affecting regular WS consumers.
export const publicClientReactivityWs = createPublicClient({
  chain: somniaReactivityTestnet,
  transport: webSocket(env.SOMNIA_REACTIVITY_WS ?? env.SOMNIA_RPC_WS),
})
