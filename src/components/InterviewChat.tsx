'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { ConversationSummary } from '@/lib/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface InterviewChatProps {
  userId: string
  scope?: string
  externalOpen?: boolean
  onExternalOpenChange?: (open: boolean) => void
  hideFloatingButton?: boolean
  onVoiceAdded?: () => void
}

export default function InterviewChat({ userId, scope = 'movement', externalOpen, onExternalOpenChange, hideFloatingButton, onVoiceAdded }: InterviewChatProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen
  const setIsOpen = (open: boolean) => {
    if (onExternalOpenChange) onExternalOpenChange(open)
    else setInternalOpen(open)
  }
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const [completionSummary, setCompletionSummary] = useState<ConversationSummary | null>(null)
  const [voiceCount, setVoiceCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  const startInterview = useCallback(async () => {
    if (loading || messages.length > 0) return
    setLoading(true)
    try {
      const res = await fetch(`/api/interview?userId=${encodeURIComponent(userId)}&scope=${encodeURIComponent(scope)}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setConversationId(data.conversationId)
      setMessages(data.messages)
    } catch (err) {
      console.error('Failed to start interview:', err)
    } finally {
      setLoading(false)
    }
  }, [userId, scope, loading, messages.length])

  const handleOpen = useCallback(() => {
    setIsOpen(true)
    if (messages.length === 0 && !loading) {
      startInterview()
    }
  }, [messages.length, loading, startInterview])

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) return
    const userMessage = input.trim()
    setInput('')
    setSending(true)

    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])

    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, message: userMessage, userId, scope }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setConversationId(data.conversationId)
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message }])

      if (data.completed) {
        setCompleted(true)
        if (data.summary) setCompletionSummary(data.summary)
        if (data.voiceCount) setVoiceCount(data.voiceCount)
        onVoiceAdded?.()
      }
    } catch (err) {
      console.error('Interview send error:', err)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ])
    } finally {
      setSending(false)
    }
  }, [input, sending, conversationId, userId, scope, onVoiceAdded])

  const handleStartNew = () => {
    setMessages([])
    setConversationId(null)
    setCompleted(false)
    setCompletionSummary(null)
    setVoiceCount(0)
    startInterview()
  }

  const isMovement = scope === 'movement'

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!isOpen && !hideFloatingButton && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleOpen}
            className="fixed bottom-20 right-6 z-50 w-14 h-14 bg-indigo-600 hover:bg-indigo-500 rounded-full shadow-lg shadow-indigo-500/25 flex items-center justify-center transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-20 right-6 z-50 w-96 h-[32rem] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {completed ? 'Voice captured' : 'Share Your Voice'}
                </h3>
                <p className="text-xs text-slate-400">
                  {completed
                    ? `You're voice #${voiceCount} in this community`
                    : isMovement
                      ? 'Help shape the movement\'s direction'
                      : 'Share what this project should focus on'}
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white transition-colors p-1"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {loading && messages.length === 0 && (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-2 h-2 bg-indigo-400 rounded-full"
                  />
                  Starting conversation...
                </div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}

              {sending && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-slate-800 rounded-2xl px-3.5 py-2.5 text-sm text-slate-400">
                    <motion.span
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      Thinking...
                    </motion.span>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input / Completion */}
            <div className="border-t border-slate-700 px-3 py-3 shrink-0">
              {completed ? (
                <div className="space-y-3">
                  {/* Summary of what was captured */}
                  {completionSummary && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-indigo-500/8 border border-indigo-500/20 rounded-xl"
                    >
                      <p className="text-[10px] text-indigo-400 uppercase tracking-wider font-medium mb-1.5">
                        What we captured
                      </p>
                      {completionSummary.vision && (
                        <p className="text-xs text-slate-300 mb-1.5 leading-relaxed line-clamp-2">
                          &ldquo;{completionSummary.vision}&rdquo;
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {completionSummary.priorities?.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-700/60 rounded text-slate-400">
                            {completionSummary.priorities.length} priorities
                          </span>
                        )}
                        {completionSummary.ideas?.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-700/60 rounded text-slate-400">
                            {completionSummary.ideas.length} ideas
                          </span>
                        )}
                        {completionSummary.concerns?.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-700/60 rounded text-slate-400">
                            {completionSummary.concerns.length} concerns
                          </span>
                        )}
                        {completionSummary.skills?.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-700/60 rounded text-slate-400">
                            {completionSummary.skills.length} skills
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )}

                  <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                    Your perspective is now visible to the community. Others can read it and see how their views compare.
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={handleStartNew}
                      className="flex-1 text-xs py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
                    >
                      New conversation
                    </button>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="flex-1 text-xs py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Share your thoughts..."
                    disabled={sending || loading}
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !input.trim() || loading}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white p-2 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
