'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'
import { cn } from '@/lib/utils'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'rounded-xl border p-2 transition',
        theme === 'dark'
          ? 'border-yellow-300/30 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/15'
          : 'border-blue-300/45 bg-blue-500/10 text-blue-600 hover:bg-blue-500/15'
      )}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  )
}
