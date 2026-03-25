'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Send } from 'lucide-react'
import { useConnectedAccount } from '@/lib/hooks/useConnectedAccount'
import { createClient } from '@/lib/supabase/client'
import { createComment } from '@/lib/api/comments'
import { shortAddress, timeAgo } from '@/lib/utils'
import { WalletAvatar } from '@/components/wallet/WalletAvatar'
import type { Comment } from '@chainbook/shared'

interface CommentSectionProps {
  postId: string
  initialComments: Comment[]
  onCountChange?: (count: number) => void
}

export function CommentSection({ postId, initialComments, onCountChange }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { isConnected, address, requireConnection, handleConnect, isWaitingForConnection } = useConnectedAccount()
  const supabase = createClient()
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const channel = supabase
      .channel(`comments-${postId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'comments',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          const incoming = payload.new as Comment
          setComments((prev) => {
            if (prev.some((c) => c.id === incoming.id)) return prev
            // Replace local placeholder if it has same content + wallet (optimistic)
            const withoutLocal = prev.filter(
              (c) => !(
                c.id.startsWith('local-') &&
                c.wallet_address === incoming.wallet_address &&
                c.content === incoming.content
              )
            )
            if (withoutLocal.length < prev.length) {
              return [...withoutLocal, incoming]
            }
            return [...prev, incoming]
          })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [postId])

  useEffect(() => {
    onCountChange?.(comments.length)
  }, [comments.length, onCountChange])

  async function handleSubmit() {
    setSubmitError(null)
    
    // Require connection before proceeding
    if (!requireConnection()) {
      setSubmitError('Please connect your wallet to comment')
      return
    }
    
    if (!text.trim() || isSubmitting || isWaitingForConnection || !address) return

    setIsSubmitting(true)
    const content = text.trim()
    setText('')
    const walletAddr = address.toLowerCase()
    const placeholderId = `local-${Date.now()}`

    try {
      // Immediately add to local state so it appears without waiting for realtime
      setComments((prev) => [
        ...prev,
        {
          id: placeholderId,
          post_id: postId,
          wallet_address: walletAddr,
          content,
          created_at: new Date().toISOString(),
        },
      ])

      const created = await createComment({
        postId,
        walletAddress: walletAddr,
        content,
      })

      setComments((prev) =>
        prev.map((comment) => (comment.id === placeholderId ? created : comment)),
      )
    } catch (error) {
      console.error('Comment error:', error)
      setText(content) // restore on failure
      setSubmitError(error instanceof Error ? error.message : 'Failed to post comment')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">
      <h3 className="text-sm font-semibold">
        Comments{' '}
        {comments.length > 0 && (
          <span className="text-muted-foreground font-normal">({comments.length})</span>
        )}
      </h3>

      {/* Comment list */}
      <div className="flex flex-col gap-4">
        <AnimatePresence>
          {comments.map((comment) => (
            <motion.div
              key={comment.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="flex gap-3"
            >
              <WalletAvatar
                address={comment.wallet_address}
                size="sm"
                linkable
              />
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium font-mono text-muted-foreground">
                    {shortAddress(comment.wallet_address)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(comment.created_at)}
                  </span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  {comment.content}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            No comments yet. Be first.
          </p>
        )}
      </div>

      {/* Error message */}
      {submitError && (
        <div className="text-xs text-red-400 bg-red-500/10 rounded px-2 py-1.5 border border-red-500/20 mt-2">
          {submitError}
        </div>
      )}

      {/* Input */}
      {isConnected ? (
        <div className="flex gap-2 pt-2 border-t border-border">
          <WalletAvatar address={address!} size="sm" linkable={false} />
          <div className="flex-1 flex gap-2">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              placeholder="Add a comment..."
              rows={1}
              maxLength={500}
              disabled={isSubmitting || isWaitingForConnection}
              className="flex-1 resize-none bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-400 min-h-[38px] disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || isSubmitting || isWaitingForConnection}
              title={isWaitingForConnection ? 'Connecting wallet...' : ''}
              className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : isWaitingForConnection ? (
        <div className="text-xs text-blue-400 animate-pulse text-center pt-2 border-t border-border font-medium">
          Connecting wallet...
        </div>
      ) : (
        <button
          onClick={handleConnect}
          className="text-xs text-blue-400 hover:underline text-center pt-2 border-t border-border w-full hover:bg-blue-400/10 py-1.5 rounded transition-colors"
        >
          Connect wallet to comment
        </button>
      )}
    </div>
  )
}
