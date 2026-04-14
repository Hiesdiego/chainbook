'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

interface MobileLayoutContextType {
  isSidebarOpen: boolean
  toggleSidebar: () => void
  closeSidebar: () => void
  openSidebar: () => void
  isMobile: boolean
}

const defaultMobileLayoutContext: MobileLayoutContextType = {
  isSidebarOpen: false,
  toggleSidebar: () => {},
  closeSidebar: () => {},
  openSidebar: () => {},
  isMobile: false,
}

const MobileLayoutContext = createContext<MobileLayoutContextType | undefined>(
  undefined
)

export function MobileLayoutProvider({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile screen size
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1024px)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
      // Close sidebar when switching to desktop
      if (!e.matches) {
        setIsSidebarOpen(false)
      }
    }

    setIsMobile(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev)
  }, [])

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false)
  }, [])

  const openSidebar = useCallback(() => {
    setIsSidebarOpen(true)
  }, [])

  return (
    <MobileLayoutContext.Provider
      value={{
        isSidebarOpen,
        toggleSidebar,
        closeSidebar,
        openSidebar,
        isMobile,
      }}
    >
      {children}
    </MobileLayoutContext.Provider>
  )
}

export function useMobileLayout() {
  const context = useContext(MobileLayoutContext)
  return context ?? defaultMobileLayoutContext
}
