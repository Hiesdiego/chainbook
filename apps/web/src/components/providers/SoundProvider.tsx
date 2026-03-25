'use client'

import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'
import { PRELOAD_SOUNDS, SOUND_VOLUMES, SOUNDS } from '@/lib/sounds/soundManager'

interface SoundContextType {
  isEnabled: boolean
  toggleSounds: (enabled: boolean) => void
  play: (soundId: string, volume?: number) => Promise<void>
}

const SoundContext = createContext<SoundContextType | undefined>(undefined)

type ReactSoundsModule = {
  playSound: (name: string, options?: { volume?: number }) => Promise<void>
  preloadSounds: (sounds: string[]) => Promise<void>
  setSoundEnabled: (enabled: boolean) => void
}

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [isEnabled, setIsEnabled] = useState(true)
  const soundsModuleRef = useRef<ReactSoundsModule | null>(null)

  const getSoundsModule = useCallback(async (): Promise<ReactSoundsModule | null> => {
    if (typeof window === 'undefined') return null
    if (soundsModuleRef.current) return soundsModuleRef.current
    try {
      const imported = await import('react-sounds')
      const mod = ((imported as { default?: unknown }).default ?? imported) as ReactSoundsModule
      soundsModuleRef.current = mod
      return mod
    } catch (error) {
      console.warn('Failed to initialize react-sounds:', error)
      return null
    }
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const stored = localStorage.getItem('chainbook_sounds_enabled')
        const enabled = stored !== 'false'
        setIsEnabled(enabled)
        const sounds = await getSoundsModule()
        sounds?.setSoundEnabled(enabled)
        // Disabled sound preloading - audio files not present in public/sounds/
        // void sounds?.preloadSounds([...PRELOAD_SOUNDS])
      } catch {
        setIsEnabled(true)
      }
    })()
  }, [getSoundsModule])

  const toggleSounds = useCallback((enabled: boolean) => {
    setIsEnabled(enabled)
    void (async () => {
      const sounds = await getSoundsModule()
      sounds?.setSoundEnabled(enabled)
    })()
    try {
      localStorage.setItem('chainbook_sounds_enabled', String(enabled))
    } catch (error) {
      console.warn('Failed to save sound settings:', error)
    }
  }, [getSoundsModule])

  const play = useCallback(
    async (soundId: string, customVolume?: number) => {
      if (!isEnabled) return
      let volume = customVolume ?? 0.5
      for (const [category, sounds] of Object.entries(SOUNDS)) {
        if (Object.values(sounds).includes(soundId as any)) {
          volume =
            customVolume ??
            SOUND_VOLUMES[category as keyof typeof SOUND_VOLUMES] ??
            0.5
          break
        }
      }
      try {
        const sounds = await getSoundsModule()
        if (!sounds) return
        await sounds.playSound(soundId, { volume })
      } catch (error) {
        console.warn(`Failed to play sound ${soundId}:`, error)
      }
    },
    [isEnabled, getSoundsModule],
  )

  return (
    <SoundContext.Provider value={{ isEnabled, toggleSounds, play }}>
      {children}
    </SoundContext.Provider>
  )
}

export function useSoundContext() {
  const context = useContext(SoundContext)
  if (!context) {
    throw new Error('useSoundContext must be used within SoundProvider')
  }
  return context
}
