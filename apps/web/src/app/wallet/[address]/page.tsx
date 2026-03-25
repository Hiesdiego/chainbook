import { AppShell } from '@/components/layout/AppShell'
import { createAdminClient } from '@/lib/supabase/server'
import { WalletProfileClient } from '@/components/wallet/WalletProfileClient'
import type { Post, Wallet, MintedToken, WalletTokenHolding } from '@chainbook/shared'

export const dynamic = 'force-dynamic'

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

  // Fetch wallet
  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('address', addressLower)
    .single()

  // Fetch recent activity posts
  const { data: posts } = await supabase
    .from('posts')
    .select('*, wallet:wallets(*)')
    .eq('wallet_address', addressLower)
    .order('created_at', { ascending: false })
    .limit(20)

  // Fetch followers
  const { data: followers } = await supabase
    .from('follows')
    .select('follower')
    .eq('subject', addressLower)

  // Fetch following
  const { data: following } = await supabase
    .from('follows')
    .select('subject')
    .eq('follower', addressLower)

  // Fetch minted/created tokens
  const { data: mintedTokens } = await supabase
    .from('minted_tokens')
    .select('*')
    .eq('wallet_address', addressLower)
    .order('created_at', { ascending: false })
    .limit(50)

  let enrichedMinted = (mintedTokens ?? []) as MintedToken[]
  if (enrichedMinted.length > 0) {
    const addresses = enrichedMinted.map((m) => m.token_address)
    const { data: meta } = await supabase
      .from('token_metadata')
      .select('address, name, symbol')
      .in('address', addresses)
    const metaMap = new Map(
      (meta ?? []).map((m) => [m.address, { name: m.name, symbol: m.symbol }]),
    )
    enrichedMinted = enrichedMinted.map((m) => ({
      ...m,
      token_name: metaMap.get(m.token_address)?.name ?? null,
      token_symbol: metaMap.get(m.token_address)?.symbol ?? null,
    }))
  }

  // Fetch token holdings
  const { data: tokenHoldings } = await supabase
    .from('wallet_token_holdings')
    .select('*')
    .eq('wallet_address', addressLower)
    .order('updated_at', { ascending: false })
    .limit(100)

  let enrichedHoldings = (tokenHoldings ?? []) as WalletTokenHolding[]
  if (enrichedHoldings.length > 0) {
    const addresses = enrichedHoldings.map((h) => h.token_address)
    const { data: tokenMeta } = await supabase
      .from('token_metadata')
      .select('address, name, symbol')
      .in('address', addresses)
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
        wallet={wallet as Wallet | null}
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
