'use client'

import { useSoundEffects } from '@/lib/hooks/useSoundEffects'

/**
 * Wrapper component to enable global sound effects
 * Place this near the root for universal click sounds
 */
export function SoundEffectsInitializer() {
  useSoundEffects()
  return null
}
