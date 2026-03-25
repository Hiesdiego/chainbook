'use client'

import Link from 'next/link'
import { cn, shortAddress, displayName, TIER_META } from '@/lib/utils'
import type { WalletTier } from '@chainbook/shared'

interface WalletAvatarProps {
  address: string
  tier?: WalletTier
  ensName?: string | null
  label?: string | null
  size?: 'sm' | 'md' | 'lg'
  showName?: boolean
  linkable?: boolean
  className?: string
}

const SIZE_MAP = {
  sm: { outer: 'w-8 h-8 text-base',  emoji: 'text-sm',  name: 'text-xs' },
  md: { outer: 'w-10 h-10 text-lg',  emoji: 'text-base', name: 'text-sm' },
  lg: { outer: 'w-14 h-14 text-2xl', emoji: 'text-xl',  name: 'text-base' },
}

export function WalletAvatar({
  address,
  tier = 'SHRIMP',
  ensName,
  label,
  size = 'md',
  showName = false,
  linkable = true,
  className,
}: WalletAvatarProps) {
  const meta = TIER_META[tier]
  const sizes = SIZE_MAP[size]
  const name = displayName(address, ensName, label)

  const avatar = (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'rounded-full flex items-center justify-center border shrink-0',
          sizes.outer,
          meta.bgColor,
        )}
        title={`${meta.label} — ${address}`}
      >
        <span className={sizes.emoji}>{meta.emoji}</span>
      </div>
      {showName && (
        <div className="flex flex-col min-w-0">
          <span className={cn('font-medium text-foreground truncate', sizes.name)}>
            {name}
          </span>
          {ensName || label ? (
            <span className="text-xs text-muted-foreground font-mono truncate">
              {shortAddress(address)}
            </span>
          ) : null}
        </div>
      )}
    </div>
  )

  if (!linkable) return avatar

  return <Link href={`/wallet/${address}`}>{avatar}</Link>
}