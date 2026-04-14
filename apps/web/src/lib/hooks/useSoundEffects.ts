'use client'

import { useSoundContext } from '@/components/providers/SoundProvider'

/**
 * Hook for sound effects on specific UI interactions.
 * Use the returned `play` helpers directly in components — no global listeners.
 *
 * Example:
 *   const { playLike, playClick } = useSoundEffects()
 *   <button onClick={() => { handleLike(); playLike() }}>Like</button>
 */
export function useSoundEffects() {
  const { play } = useSoundContext()

  return {
    playLike:  () => void play('like'),
    playClick: () => void play('click'),
  }
}