'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('chainbook_theme') as Theme | null
      if (stored === 'dark' || stored === 'light') {
        setTheme(stored)
        applyTheme(stored)
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        const initialTheme: Theme = prefersDark ? 'dark' : 'light'
        setTheme(initialTheme)
        applyTheme(initialTheme)
      }
    } catch {
      setTheme('dark')
      applyTheme('dark')
    }
    setIsMounted(true)
  }, [])

  const applyTheme = (newTheme: Theme) => {
    const html = document.documentElement
    if (newTheme === 'dark') {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
    html.style.colorScheme = newTheme
  }

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    applyTheme(newTheme)

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('chainbook_theme', newTheme)
      } catch (error) {
        console.warn('Failed to save theme preference:', error)
      }
    }
  }

  if (!isMounted) {
    return <>{children}</>
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
