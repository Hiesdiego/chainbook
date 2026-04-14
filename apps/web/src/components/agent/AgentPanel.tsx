'use client'

// apps/web/src/components/agent/AgentPanel.tsx
//
// Chainbook AI — Agent Panel
//
// A slide-in panel fixed to the right side of the viewport.
// Communicates with /api/agent — the full agentic Claude endpoint.
//
// Usage: drop <AgentPanel /> anywhere in your layout (e.g. inside RootLayout
// or the feed shell). The panel manages its own open/close state.
// The trigger button appears at the bottom-right corner of the screen.
//
// Surfaces:
//   - Quick action chips (Whale Moves, Price Impact, Trending)
//   - Full chat history with the agent
//   - Typing indicator while the agent is thinking
//   - Streaming-style reveal with CSS animation

import { useState, useRef, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: Date
}

interface ApiMessage {
  role: 'user' | 'assistant'
  content: string
}

const MAX_CLIENT_HISTORY = 6

// ─── Quick Action Chips ───────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: '🐋 Latest Whales', prompt: 'Show me the latest whale movements on Chainbook' },
  { label: '🔥 Trending Now', prompt: 'What tokens and contracts are trending right now?' },
  { label: '📊 Price Impact', prompt: 'Analyze the price impact of the most recent whale move' },
  { label: '⚡ Network Pulse', prompt: 'Give me a quick pulse check on Somnia network activity' },
]

// ─── Unique ID Helper ─────────────────────────────────────────────────────────

let _idCounter = 0
function uid() {
  return `msg-${Date.now()}-${++_idCounter}`
}

// ─── Format timestamp ─────────────────────────────────────────────────────────

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ─── Markdown-lite renderer ───────────────────────────────────────────────────
// Handles bold (**text**), inline code (`code`), and newlines.
// Keeps bundle size zero — no external markdown lib.

function renderContent(text: string) {
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold
    const boldIdx = remaining.indexOf('**')
    // Inline code
    const codeIdx = remaining.indexOf('`')
    // Newline
    const nlIdx = remaining.indexOf('\n')

    const candidates = [boldIdx, codeIdx, nlIdx]
      .filter((i) => i !== -1)
      .sort((a, b) => a - b)

    if (candidates.length === 0) {
      parts.push(<span key={key++}>{remaining}</span>)
      break
    }

    const first = candidates[0]

    if (first > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, first)}</span>)
      remaining = remaining.slice(first)
      continue
    }

    if (remaining.startsWith('**')) {
      const end = remaining.indexOf('**', 2)
      if (end === -1) {
        parts.push(<span key={key++}>{remaining}</span>)
        break
      }
      parts.push(
        <strong key={key++} className="font-semibold text-emerald-300">
          {remaining.slice(2, end)}
        </strong>,
      )
      remaining = remaining.slice(end + 2)
      continue
    }

    if (remaining.startsWith('`')) {
      const end = remaining.indexOf('`', 1)
      if (end === -1) {
        parts.push(<span key={key++}>{remaining}</span>)
        break
      }
      parts.push(
        <code
          key={key++}
          className="rounded bg-white/10 px-1 py-0.5 font-mono text-[11px] text-emerald-400"
        >
          {remaining.slice(1, end)}
        </code>,
      )
      remaining = remaining.slice(end + 1)
      continue
    }

    if (remaining.startsWith('\n')) {
      parts.push(<br key={key++} />)
      remaining = remaining.slice(1)
      continue
    }

    // Fallback
    parts.push(<span key={key++}>{remaining[0]}</span>)
    remaining = remaining.slice(1)
  }

  return parts
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-emerald-400"
          style={{
            animation: 'cbai-bounce 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isAgent = msg.role === 'agent'

  return (
    <div
      className={`flex w-full gap-2 ${isAgent ? 'items-start' : 'flex-row-reverse items-start'}`}
      style={{ animation: 'cbai-fade-in 0.2s ease-out forwards' }}
    >
      {/* Avatar */}
      {isAgent && (
        <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-sm">
          ⚡
        </div>
      )}

      {/* Bubble */}
      <div
        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isAgent
            ? 'rounded-tl-sm bg-white/5 text-gray-100 ring-1 ring-white/10'
            : 'rounded-tr-sm bg-emerald-600/80 text-white'
        }`}
      >
        {isAgent ? renderContent(msg.content) : msg.content}
        <p
          className={`mt-1.5 text-[10px] ${isAgent ? 'text-gray-500' : 'text-emerald-200/70'}`}
        >
          {formatTime(msg.timestamp)}
        </p>
      </div>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function AgentPanel({ mode = 'floating' }: { mode?: 'floating' | 'sidebar' | 'page' }) {
  const isStaticMode = mode === 'sidebar' || mode === 'page'
  const [isOpen, setIsOpen] = useState(isStaticMode)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Keep message history for multi-turn context
  const historyRef = useRef<ApiMessage[]>([])

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isThinking])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isThinking) return

      setError(null)
      setInput('')

      // Add user message to UI
      const userMsg: ChatMessage = {
        id: uid(),
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMsg])
      setIsThinking(true)

      // Build API message history
      const apiHistory: ApiMessage[] = [
        ...historyRef.current.slice(-MAX_CLIENT_HISTORY),
        { role: 'user', content: trimmed },
      ]

      try {
        const res = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiHistory }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(err.error ?? `HTTP ${res.status}`)
        }

        const data = (await res.json()) as { reply: string }

        // Update history with both sides
        historyRef.current = [
          ...apiHistory,
          { role: 'assistant', content: data.reply },
        ]

        const agentMsg: ChatMessage = {
          id: uid(),
          role: 'agent',
          content: data.reply,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, agentMsg])
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong'
        setError(msg)
        // Remove optimistic user message on hard failure
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
        historyRef.current = historyRef.current.slice(0, -1)
      } finally {
        setIsThinking(false)
      }
    },
    [isThinking],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleQuickAction = (prompt: string) => {
    sendMessage(prompt)
  }

  const clearChat = () => {
    setMessages([])
    historyRef.current = []
    setError(null)
  }

  const isEmpty = messages.length === 0

  return (
    <>
      {/* CSS keyframes injected once */}
      <style>{`
        @keyframes cbai-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes cbai-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cbai-slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
        @keyframes cbai-pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(52,211,153,0.4); }
          70%  { box-shadow: 0 0 0 8px rgba(52,211,153,0); }
          100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
        }
      `}</style>

      {/* ── Trigger Button ─────────────────────────────────────────────────── */}
      {!isStaticMode && !isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open Chainbook AI"
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/40 bg-black/90 text-2xl shadow-2xl backdrop-blur-xl transition-transform duration-200 hover:scale-110 active:scale-95"
          style={{ animation: 'cbai-pulse-ring 2.5s ease-out infinite' }}
        >
          ⚡
        </button>
      )}

      {/* ── Panel ──────────────────────────────────────────────────────────── */}
      {isOpen && (
        <>
          {/* Backdrop (mobile) */}
          {!isStaticMode && (
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
              onClick={() => setIsOpen(false)}
            />
          )}

          {/* Panel container */}
          <div
            className={
              isStaticMode
                ? 'flex h-full w-full flex-col bg-[#0a0a0a]/60 backdrop-blur-2xl'
                : 'fixed bottom-0 right-0 top-0 z-50 flex w-full flex-col border-l border-white/10 bg-[#0a0a0a]/95 shadow-2xl backdrop-blur-2xl sm:w-[420px]'
            }
            style={
              isStaticMode
                ? undefined
                : { animation: 'cbai-slide-in 0.25s cubic-bezier(0.22,1,0.36,1) forwards' }
            }
          >
            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-white/8 px-4 py-3.5">
              <div className="flex items-center gap-3">
                {/* Animated status dot */}
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
                  <span className="text-base">⚡</span>
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0a0a0a] bg-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none text-white">Chainbook AI</p>
                  <p className="mt-0.5 text-[11px] text-emerald-400/80">
                    {isThinking ? 'Analysing on-chain data…' : 'Online · Somnia Testnet'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={clearChat}
                    title="Clear chat"
                    className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-300"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
                {!isStaticMode && (
                  <button
                    onClick={() => setIsOpen(false)}
                    title="Close"
                    className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-300"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* ── Messages area ─────────────────────────────────────────────── */}
            <div
              ref={scrollRef}
              className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
            >
              {/* Empty state */}
              {isEmpty && !isThinking && (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-3xl">
                    ⚡
                  </div>
                  <p className="text-sm font-medium text-gray-300">Chainbook AI</p>
                  <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-gray-600">
                    Ask about whale movements, price impact, trending tokens, or any wallet on Somnia.
                  </p>

                  {/* Quick actions */}
                  <div className="mt-5 flex flex-col gap-2 w-full max-w-[300px]">
                    {QUICK_ACTIONS.map((action) => (
                      <button
                        key={action.label}
                        onClick={() => handleQuickAction(action.prompt)}
                        disabled={isThinking}
                        className="w-full rounded-xl border border-white/8 bg-white/3 px-3.5 py-2.5 text-left text-xs text-gray-400 transition-all duration-150 hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:text-gray-200 disabled:pointer-events-none disabled:opacity-40"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message list */}
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}

              {/* Thinking indicator */}
              {isThinking && (
                <div className="flex items-start gap-2">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-sm">
                    ⚡
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-white/5 ring-1 ring-white/10">
                    <TypingIndicator />
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-2.5">
                  <p className="text-xs text-red-400">⚠ {error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="mt-1 text-[10px] text-red-400/60 hover:text-red-400"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>

            {/* ── Quick actions strip (visible when chat has messages) ────── */}
            {!isEmpty && (
              <div className="flex flex-shrink-0 gap-2 overflow-x-auto border-t border-white/8 px-4 py-2.5 scrollbar-none">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action.prompt)}
                    disabled={isThinking}
                    className="flex-shrink-0 rounded-full border border-white/10 bg-white/3 px-3 py-1.5 text-[11px] text-gray-500 transition-all hover:border-emerald-500/30 hover:text-gray-300 disabled:pointer-events-none disabled:opacity-40"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            {/* ── Input area ────────────────────────────────────────────────── */}
            <div className="flex-shrink-0 border-t border-white/8 p-3">
              <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/3 px-3.5 py-2.5 transition-colors focus-within:border-emerald-500/40 focus-within:bg-emerald-500/3">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about whales, price impact, trending…"
                  rows={1}
                  disabled={isThinking}
                  className="flex-1 resize-none bg-transparent text-sm text-gray-100 placeholder-gray-600 outline-none disabled:opacity-50"
                  style={{ maxHeight: '120px', overflowY: 'auto' }}
                  onInput={(e) => {
                    const el = e.currentTarget
                    el.style.height = 'auto'
                    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
                  }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isThinking}
                  className="mb-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-black transition-all hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              <p className="mt-1.5 text-center text-[10px] text-gray-700">
                Enter to send · Shift+Enter for newline · Not financial advice
              </p>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default AgentPanel
