'use client'

import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useAccount } from 'wagmi'

/**
 * Custom hook that ensures both Privy authentication and Wagmi account are synced
 * Returns reliable connection state and prevents race conditions
 */
export function useConnectedAccount() {
  const { authenticated, user, ready: privyReady, login, logout: privyLogout } = usePrivy()
  const { address: wagmiAddress, isConnecting: wagmiConnecting } = useAccount()
  const [lastConnectAttempt, setLastConnectAttempt] = useState<number>(0)
  const [isWaitingForConnection, setIsWaitingForConnection] = useState(false)
  
  // Get address from either wagmi (preferred) or Privy fallback
  const address = wagmiAddress || user?.wallet?.address
  
  // True when both Privy is authenticated AND we have an address
  const isConnected = authenticated && !!address
  
  // True when system is ready (Privy initialized and not connecting)
  const isReady = privyReady && !wagmiConnecting

  // When authentication status changes, reset waiting state
  useEffect(() => {
    if (isConnected) {
      setIsWaitingForConnection(false)
    }
  }, [isConnected])

  /**
   * Smart connect function that opens Privy login
   * Privy handles wallet creation automatically based on config
   */
  const handleConnect = async () => {
    // Prevent rapid repeated click attempts
    const now = Date.now()
    if (now - lastConnectAttempt < 500) return
    
    setLastConnectAttempt(now)
    
    if (!authenticated) {
      setIsWaitingForConnection(true)
      login()
    }
  }

  /**
   * Connect if needed - prompts user to connect if not already connected
   * Returns true if user is already connected or waiting for connection, checks connectivity
   */
  const requireConnection = (callback?: () => void): boolean => {
    if (isConnected) {
      if (callback) callback()
      return true
    }
    
    if (!isWaitingForConnection) {
      handleConnect()
    }
    
    return false
  }

  /**
   * Proper logout function that clears Privy session
   */
  const handleLogout = async () => {
    try {
      await privyLogout()
      setIsWaitingForConnection(false)
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return {
    address,
    isConnected,
    isReady,
    authenticated,
    user,
    isWaitingForConnection,
    handleConnect,
    requireConnection,
    handleLogout,
    login,
    logout: privyLogout,
  }
}

