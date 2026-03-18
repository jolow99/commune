'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { Proposal, ProposalSuggestion } from '@/lib/types'

interface ProposalDocumentModalProps {
  proposal: Proposal
  userId: string
  onClose: () => void
  onVote: (proposalId: string) => void
  mergingProposalId: string | null
}

function timeAgo(ts: number | string): string {
  const epochMs = typeof ts === 'string' ? new Date(ts).getTime() : ts
  const seconds = Math.floor((Date.now() - epochMs) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(epochMs).toLocaleDateString()
}

function VoteBar({ votes, needed }: { votes: number; needed: number }) {
  const filled = Math.min(votes, needed)
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex gap-0.5">
        {Array.from({ length: needed }).map((_, i) => (
          <div
            key={i}
            className={`w-6 h-3 rounded-sm ${
              i < filled ? 'bg-indigo-400' : 'bg-slate-600'
            }`}
          />
        ))}
      </div>
      <span className="text-slate-400">{votes}/{needed}</span>
    </div>
  )
}

function SuggestionDiff({ suggestion, isAuthor, onAction }: {
  suggestion: ProposalSuggestion
  isAuthor: boolean
  onAction: (id: string, status: 'accepted' | 'rejected') => void
}) {
  return (
    <div className="border border-slate-700 rounded-lg p-3 mb-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400">by {suggestion.author.slice(0, 8)}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${
          suggestion.status === 'accepted' ? 'bg-green-500/20 text-green-400' :
          suggestion.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
          'bg-yellow-500/20 text-yellow-400'
        }`}>
          {suggestion.status}
        </span>
      </div>
      <div className="text-sm mb-1">
        <div className="bg-red-900/20 text-red-300 px-2 py-1 rounded-t font-mono text-xs whitespace-pre-wrap line-through">
          {suggestion.originalText}
        </div>
        <div className="bg-green-900/20 text-green-300 px-2 py-1 rounded-b font-mono text-xs whitespace-pre-wrap">
          {suggestion.suggestedText}
        </div>
      </div>
      {isAuthor && suggestion.status === 'pending' && (
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => onAction(suggestion.id, 'accepted')}
            className="text-xs px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-white transition-colors"
          >
            Accept
          </button>
          <button
            onClick={() => onAction(suggestion.id, 'rejected')}
            className="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-white transition-colors"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )
}

export default function ProposalDocumentModal({
  proposal,
  userId,
  onClose,
  onVote,
  mergingProposalId,
}: ProposalDocumentModalProps) {
  const [suggestions, setSuggestions] = useState<ProposalSuggestion[]>([])
  const [showSuggestForm, setShowSuggestForm] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [suggestedText, setSuggestedText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [body, setBody] = useState(proposal.body || '')
  const isAuthor = proposal.author === userId
  const isPending = proposal.status === 'pending'

  useEffect(() => {
    fetch(`/api/proposals/${proposal.id}/suggestions`)
      .then(res => res.json())
      .then(data => setSuggestions(data.suggestions || []))
      .catch(console.error)
  }, [proposal.id])

  const handleSuggest = useCallback(async () => {
    if (!selectedText.trim() || !suggestedText.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalText: selectedText, suggestedText, author: userId }),
      })
      const data = await res.json()
      if (data.suggestion) {
        setSuggestions(prev => [...prev, data.suggestion])
        setSelectedText('')
        setSuggestedText('')
        setShowSuggestForm(false)
      }
    } catch (err) {
      console.error('Suggest error:', err)
    } finally {
      setSubmitting(false)
    }
  }, [proposal.id, selectedText, suggestedText, userId])

  const handleAction = useCallback(async (suggestionId: string, status: 'accepted' | 'rejected') => {
    try {
      await fetch(`/api/proposals/${proposal.id}/suggestions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId, status, userId }),
      })
      setSuggestions(prev => prev.map(s =>
        s.id === suggestionId ? { ...s, status } : s
      ))
      // If accepted, update displayed body
      if (status === 'accepted') {
        const s = suggestions.find(s => s.id === suggestionId)
        if (s) {
          setBody(prev => prev.replace(s.originalText, s.suggestedText))
        }
      }
    } catch (err) {
      console.error('Action error:', err)
    }
  }, [proposal.id, userId, suggestions])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">{proposal.description || proposal.userPrompt}</h2>
            <p className="text-xs text-slate-400 mt-1">
              by {proposal.author.slice(0, 12)} &middot; {timeAgo(proposal.timestamp)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body + Suggestions */}
        <div className="flex-1 overflow-y-auto flex min-h-0">
          {/* Document body */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="prose prose-invert prose-sm max-w-none">
              {body.split('\n').map((line, i) => {
                if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-white mt-4 mb-2">{line.slice(2)}</h1>
                if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-semibold text-white mt-3 mb-1">{line.slice(3)}</h2>
                if (line.startsWith('### ')) return <h3 key={i} className="text-base font-medium text-white mt-2 mb-1">{line.slice(4)}</h3>
                if (line.startsWith('- ')) return <li key={i} className="text-slate-300 ml-4">{line.slice(2)}</li>
                if (line.trim() === '') return <br key={i} />
                return <p key={i} className="text-slate-300 mb-2">{line}</p>
              })}
            </div>
          </div>

          {/* Suggestions sidebar */}
          <div className="w-72 border-l border-slate-800 p-4 overflow-y-auto shrink-0">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Suggestions ({suggestions.length})
            </h3>

            {suggestions.map(s => (
              <SuggestionDiff
                key={s.id}
                suggestion={s}
                isAuthor={isAuthor}
                onAction={handleAction}
              />
            ))}

            {suggestions.length === 0 && !showSuggestForm && (
              <p className="text-xs text-slate-600">No suggestions yet</p>
            )}

            {!isAuthor && isPending && !showSuggestForm && (
              <button
                onClick={() => setShowSuggestForm(true)}
                className="mt-3 text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors w-full"
              >
                Suggest Edit
              </button>
            )}

            {showSuggestForm && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={selectedText}
                  onChange={e => setSelectedText(e.target.value)}
                  placeholder="Original text to replace..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                  rows={3}
                />
                <textarea
                  value={suggestedText}
                  onChange={e => setSuggestedText(e.target.value)}
                  placeholder="Your suggested replacement..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSuggest}
                    disabled={submitting || !selectedText.trim() || !suggestedText.trim()}
                    className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 rounded text-white transition-colors"
                  >
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                  <button
                    onClick={() => { setShowSuggestForm(false); setSelectedText(''); setSuggestedText('') }}
                    className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer: Vote */}
        {isPending && (
          <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between shrink-0">
            <VoteBar votes={proposal.votes.length} needed={proposal.votesNeeded} />
            {mergingProposalId === proposal.id ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-indigo-400">Merging...</span>
              </div>
            ) : (
              <button
                onClick={() => onVote(proposal.id)}
                disabled={proposal.votes.includes(userId)}
                className="text-xs px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-white font-medium transition-colors"
              >
                {proposal.votes.includes(userId) ? 'Voted' : 'Vote to Approve'}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
