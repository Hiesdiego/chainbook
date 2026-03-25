// apps/listener/src/lib/walletHelper.ts

import { supabase } from '../config/supabase.js'

export async function ensureWallet(address: string): Promise<void> {
  if (!address || address === '0x0000000000000000000000000000000000000000') return

  const payload = {
    address: address.toLowerCase(),
    updated_at: new Date().toISOString(),
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { error } = await supabase
        .from('wallets')
        .upsert(payload, { onConflict: 'address', ignoreDuplicates: true })

      if (!error) return
      if (!error.message.toLowerCase().includes('fetch failed') || attempt === 3) {
        console.error(`[WalletUpsert] Failed for ${address}:`, error.message)
        return
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!message.toLowerCase().includes('fetch failed') || attempt === 3) {
        console.error(`[WalletUpsert] Failed for ${address}:`, message)
        return
      }
    }

    await sleep(attempt * 300)
  }
}

export async function incrementWalletStats(
  address: string,
  volumeUsd: number,
): Promise<void> {
  if (!address) return

  await supabase.rpc('increment_wallet_stats', {
    p_address: address.toLowerCase(),
    p_volume_usd: volumeUsd,
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
