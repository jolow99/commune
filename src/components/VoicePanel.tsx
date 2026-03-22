'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ConversationSummary } from '@/lib/types'

interface VoicePanelProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  onStartInterview: () => void
}

interface VoiceEntry {
  id: string
  scope: string
  summary: ConversationSummary
  createdAt: string
  updatedAt: string
}

function SummaryCard({ entry, userId, onUpdate }: {
  entry: VoiceEntry
  userId: string
  onUpdate: (id: string, summary: ConversationSummary) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ConversationSummary>(entry.summary)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/voice', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: entry.id, summary: draft, userId }),
      })
      onUpdate(entry.id, draft)
      setEditing(false)
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  const timeAgo = (ts: string) => {
    const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-500">
          {entry.scope === 'movement' ? 'Movement' : 'Project'} &middot; {timeAgo(entry.updatedAt)}
        </span>
        <button
          onClick={() => setEditing(!editing)}
          className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider">Vision</label>
            <textarea
              value={draft.vision}
              onChange={(e) => setDraft({ ...draft, vision: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white mt-1 resize-none"
              rows={2}
            />
          </div>
          {(['priorities', 'skills', 'ideas', 'concerns'] as const).map((field) => (
            <div key={field}>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider">{field}</label>
              <textarea
                value={(draft[field] || []).join('\n')}
                onChange={(e) => setDraft({ ...draft, [field]: e.target.value.split('\n').filter(Boolean) })}
                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white mt-1 resize-none"
                rows={2}
              />
            </div>
          ))}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full text-xs py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 rounded text-white transition-colors"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <p className="text-xs text-slate-400 font-medium">Vision</p>
            <p className="text-xs text-slate-300">{entry.summary.vision}</p>
          </div>
          {entry.summary.priorities?.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 font-medium">Priorities</p>
              <ul className="text-xs text-slate-300 list-disc list-inside">
                {entry.summary.priorities.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
          {entry.summary.skills?.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 font-medium">Skills</p>
              <ul className="text-xs text-slate-300 list-disc list-inside">
                {entry.summary.skills.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
          {entry.summary.ideas?.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 font-medium">Ideas</p>
              <ul className="text-xs text-slate-300 list-disc list-inside">
                {entry.summary.ideas.map((idea, i) => <li key={i}>{idea}</li>)}
              </ul>
            </div>
          )}
          {entry.summary.concerns?.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 font-medium">Concerns</p>
              <ul className="text-xs text-slate-300 list-disc list-inside">
                {entry.summary.concerns.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function VoicePanel({ isOpen, onClose, userId, onStartInterview }: VoicePanelProps) {
  const [entries, setEntries] = useState<VoiceEntry[]>([])
  const [loading, setLoading] = useState(false)

  const loadVoices = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/voice?userId=${encodeURIComponent(userId)}`)
      const data = await res.json()
      setEntries(data.conversations || [])
    } catch (err) {
      console.error('Failed to load voices:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (isOpen) loadVoices()
  }, [isOpen, loadVoices])

  const handleUpdate = (id: string, summary: ConversationSummary) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, summary } : e))
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-96 bg-slate-900 border-l border-slate-700 flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-white">Your Voice</h2>
                <p className="text-xs text-slate-400">How you&apos;re shaping community direction</p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Explainer */}
            <div className="px-4 pt-3 pb-1">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Share your thoughts through a short AI-guided interview. The system finds patterns across
                everyone&apos;s input and surfaces <span className="text-slate-400">community themes</span>.
                When enough people share a theme, it automatically becomes a proposal.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <p className="text-sm text-slate-500">Loading...</p>
              ) : entries.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-400 mb-1">No interviews yet</p>
                  <p className="text-xs text-slate-600 mb-4 max-w-xs mx-auto">
                    Take a 2-minute interview so the community can hear what matters to you.
                  </p>
                  <button
                    onClick={() => { onClose(); onStartInterview() }}
                    className="text-xs px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors"
                  >
                    Start interview
                  </button>
                </div>
              ) : (
                entries.map(entry => (
                  <SummaryCard
                    key={entry.id}
                    entry={entry}
                    userId={userId}
                    onUpdate={handleUpdate}
                  />
                ))
              )}
            </div>

            {entries.length > 0 && (
              <div className="border-t border-slate-700 px-4 py-3 shrink-0">
                <button
                  onClick={() => { onClose(); onStartInterview() }}
                  className="w-full text-xs py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
                >
                  Start a new conversation
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
