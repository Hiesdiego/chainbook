//apps/web/src/components/providers/Providers.tsx

'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { wagmiConfig, somniaTestnet } from '@/lib/wagmi/config'
import { SoundProvider } from './SoundProvider'
import { SoundEffectsInitializer } from './SoundEffectsInitializer'
import { ThemeProvider } from './ThemeProvider'
import { MobileLayoutProvider } from '@/lib/context/MobileLayoutContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
        config={{
          loginMethods: ['wallet', 'email', 'google', 'twitter'],
          appearance: {
            theme: 'dark',
            accentColor: '#06B6D4',
            logo: '/assets/chainbook-icon.png',
            walletList: ['metamask', 'coinbase_wallet', 'rainbow', 'wallet_connect'],
          },
          embeddedWallets: {
            // In newer Privy SDK versions, createOnLogin moved under the
            // chain-specific namespace rather than at the top level.
            ethereum: {
              createOnLogin: 'users-without-wallets',
            },
          },
          defaultChain: somniaTestnet,
          supportedChains: [somniaTestnet],
        }}
      >
        <QueryClientProvider client={queryClient}>
          <WagmiProvider config={wagmiConfig}>
            <SoundProvider>
              <MobileLayoutProvider>
                <SoundEffectsInitializer />
                {children}
              </MobileLayoutProvider>
            </SoundProvider>
          </WagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    </ThemeProvider>
  )
}