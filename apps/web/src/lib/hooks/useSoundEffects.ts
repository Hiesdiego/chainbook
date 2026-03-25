'use client'

import { useEffect } from 'react'
import { useSoundContext } from '@/components/providers/SoundProvider'
import { SOUNDS } from '@/lib/sounds/soundManager'

/**
 * Hook to add sound effects to common UI interactions
 * Call this in your component root to enable click sounds globally
 */
export function useSoundEffects() {
  const { play } = useSoundContext()

  useEffect(() => {
    // Add click sound to all interactive elements
    const handleElementClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      // Check if it's a clickable element
      const isClickable = 
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest('button') ||
        target.closest('a') ||
        target.closest('[role="button"]')

      if (isClickable) {
        void play(SOUNDS.UI.click)
      }
    }

    // Add hover sound to interactive elements (optional - can be disabled for less noise)
    const handleElementHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        // Uncommnet to enable hover sounds
        // void play(SOUNDS.UI.hover, 0.2)
      }
    }

    document.addEventListener('click', handleElementClick, true)
    document.addEventListener('mouseover', handleElementHover, true)

    return () => {
      document.removeEventListener('click', handleElementClick, true)
      document.removeEventListener('mouseover', handleElementHover, true)
    }
  }, [play])
}
