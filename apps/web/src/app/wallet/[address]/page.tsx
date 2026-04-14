// apps/web/src/app/wallet/[address]/page.tsx

import { AppShell } from '@/components/layout/AppShell'
import { createAdminClient } from '@/lib/supabase/server'
import { WalletProfileClient } from '@/components/wallet/WalletProfileClient'
import { createPublicClient, http, defineChain, formatUnits } from 'viem'
import type { Post, Wallet, MintedToken, WalletTokenHolding } from '@chainbook/shared'

export const dynamic = 'force-dynamic'

// Minimal Somnia chain definition for server-side RPC calls.
// This is intentionally separate from the wagmi client config —
// server components cannot use browser hooks.
const somniaRpc = process.env.SOMNIA_RPC_HTTP ?? process.env.NEXT_PUBLIC_SOMNIA_RPC_HTTP ?? 'https://dream-rpc.somnia.network'

const somniaChain = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { decimals: 18, name: 'Somnia Test Token', symbol: 'STT' },
  rpcUrls: {
    default: { http: [somniaRpc] },
  },
})

const publicClient = createPublicClient({
  chain: somniaChain,
  transport: http(somniaRpc, { timeout: 8_000 }),
})

// Fetch the live native STT balance for a wallet directly from the RPC.
// Used when wallet_balance_usd is null/zero in the DB — the listener may not
// have seen a native transfer from this wallet yet.
// Returns null on any RPC error so the page still renders.
async function fetchLiveBalance(address: string): Promise<number | null> {
  const sttUsdPriceEnv = process.env.NEXT_PUBLIC_STT_USD_PRICE
  const sttUsdPrice = sttUsdPriceEnv ? Number(sttUsdPriceEnv) : null

  try {
    const rawBalance = await publicClient.getBalance({
      address: address as `0x${string}`,
    })
    if (rawBalance === 0n) return 0

    const sttAmount = Number(formatUnits(rawBalance, 18))

    if (sttUsdPrice && sttUsdPrice > 0) {
      return sttAmount * sttUsdPrice
    }

    // Fallback: try CoinGecko (no key required, best-effort)
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=somnia-network&vs_currencies=usd',
        { next: { revalidate: 300 } }, // cache for 5 minutes
      )
      if (res.ok) {
        const json = (await res.json()) as Record<string, { usd: number }>
        const price = json['somnia-network']?.usd
        if (price && price > 0) return sttAmount * price
      }
    } catch {
      // CoinGecko unavailable — return raw STT amount as USD approximation of 0
    }

    // No price available — return null so the UI shows '—' rather than $0.00
    return null
  } catch {
    return null
  }
}

interface WalletPageProps {
  params: Promise<{ address: string }>
}

export default async function WalletPage({ params }: WalletPageProps) {
  const { address } = await params
  if (!address) {
    return (
      <AppShell>
        <div className="text-center text-muted-foreground py-16">
          Wallet not found.
        </div>
      </AppShell>
    )
  }

  const supabase = createAdminClient()
  const addressLower = address.toLowerCase()

  // Fetch wallet row
  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('address', addressLower)
    .single()

  // If wallet_balance_usd is missing or zero, fetch live from the RPC.
  // This covers wallets the listener has seen (and created a row for) but
  // hasn't yet updated with a balance because no native transfer above the
  // minimum threshold has occurred since the listener started.
  let resolvedWallet = wallet as Wallet | null
  if (resolvedWallet && (resolvedWallet.wallet_balance_usd == null || resolvedWallet.wallet_balance_usd === 0)) {
    const liveBalance = await fetchLiveBalance(addressLower)
    if (liveBalance !== null) {
      resolvedWallet = { ...resolvedWallet, wallet_balance_usd: liveBalance }
      // Persist back to DB so subsequent loads are instant and the listener
      // doesn't have to wait for a transfer event to hydrate this field.
      void supabase
        .from('wallets')
        .update({ wallet_balance_usd: liveBalance })
        .eq('address', addressLower)
    }
  }

  // Fetch recent activity posts
  const { data: posts } = await supabase
    .from('posts')
    .select('*, wallet:wallets(*)')
    .eq('wallet_address', addressLower)
    .order('created_at', { ascending: false })
    .limit(20)

  // Fetch followers / following counts
  const { data: followers } = await supabase
    .from('follows')
    .select('follower')
    .eq('subject', addressLower)

  const { data: following } = await supabase
    .from('follows')
    .select('subject')
    .eq('follower', addressLower)

  // Fetch minted / created tokens
  const { data: mintedTokens } = await supabase
    .from('minted_tokens')
    .select('*')
    .eq('wallet_address', addressLower)
    .order('created_at', { ascending: false })
    .limit(50)

  let enrichedMinted = (mintedTokens ?? []) as MintedToken[]
  if (enrichedMinted.length > 0) {
    const tokenAddresses = enrichedMinted.map((m) => m.token_address)
    const { data: meta } = await supabase
      .from('token_metadata')
      .select('address, name, symbol')
      .in('address', tokenAddresses)
    const metaMap = new Map(
      (meta ?? []).map((m) => [m.address, { name: m.name, symbol: m.symbol }]),
    )
    enrichedMinted = enrichedMinted.map((m) => ({
      ...m,
      token_name: metaMap.get(m.token_address)?.name ?? null,
      token_symbol: metaMap.get(m.token_address)?.symbol ?? null,
    }))
  }

  // Fetch ERC20 token holdings
  // Note: this table is populated by the listener when ENABLE_TOKEN_HOLDING_TRACKING=true.
  // If that flag is false, this will return an empty array and only the synthetic
  // STT holding (derived from wallet_balance_usd) will show in the Tokens tab.
  const { data: tokenHoldings } = await supabase
    .from('wallet_token_holdings')
    .select('*')
    .eq('wallet_address', addressLower)
    .order('updated_at', { ascending: false })
    .limit(100)

  let enrichedHoldings = (tokenHoldings ?? []) as WalletTokenHolding[]
  if (enrichedHoldings.length > 0) {
    const holdingAddresses = enrichedHoldings.map((h) => h.token_address)
    const { data: tokenMeta } = await supabase
      .from('token_metadata')
      .select('address, name, symbol')
      .in('address', holdingAddresses)
    const metaMap = new Map(
      (tokenMeta ?? []).map((m) => [m.address, { name: m.name, symbol: m.symbol }]),
    )
    enrichedHoldings = enrichedHoldings.map((h) => ({
      ...h,
      token_name: metaMap.get(h.token_address)?.name ?? null,
      token_symbol: metaMap.get(h.token_address)?.symbol ?? null,
    }))
  }

  return (
    <AppShell>
      <WalletProfileClient
        wallet={resolvedWallet}
        address={address}
        posts={(posts ?? []) as Post[]}
        followerCount={followers?.length ?? 0}
        followingCount={following?.length ?? 0}
        mintedTokens={enrichedMinted}
        tokenHoldings={enrichedHoldings}
      />
    </AppShell>
  )
}