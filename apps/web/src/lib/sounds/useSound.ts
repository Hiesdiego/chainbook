'use client'

import { useCallback } from 'react'
import { useSoundContext } from '@/components/providers/SoundProvider'
import { SOUNDS } from './soundManager'

export interface UseSoundReturn {
  play: (volume?: number) => Promise<void>
  stop: () => void
  isLoading: boolean
}

export function useChainbookSound(
  soundId: string,
  options: { volume?: number } = {},
): UseSoundReturn {
  const { play } = useSoundContext()

  const playSound = useCallback(
    async (customVolume?: number) => {
      await play(soundId, customVolume ?? options.volume)
    },
    [play, soundId, options.volume],
  )

  const stop = useCallback(() => {
    // react-sounds plays one-shot effects for this app; explicit stop is not needed.
  }, [])

  return {
    play: playSound,
    stop,
    isLoading: false,
  }
}

export function useChainbookSounds() {
  const { play } = useSoundContext()

  const playLike = useCallback(async () => play(SOUNDS.SOCIAL.like), [play])
  const playWhaleAlert = useCallback(async () => play(SOUNDS.ALERT.whale), [play])
  const playNotification = useCallback(async () => play(SOUNDS.NOTIFICATION.new_notification), [play])
  const playSuccess = useCallback(async () => play(SOUNDS.UI.success), [play])
  const playError = useCallback(async () => play(SOUNDS.UI.error), [play])
  const playClick = useCallback(async () => play(SOUNDS.UI.click), [play])

  return {
    playLike,
    playWhaleAlert,
    playNotification,
    playSuccess,
    playError,
    playClick,
  }
}

export function useSoundsEnabled() {
  const { isEnabled } = useSoundContext()
  return isEnabled
}

export function useToggleSounds() {
  const { toggleSounds } = useSoundContext()
  return toggleSounds
}
