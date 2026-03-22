'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ConversationSummary } from '@/lib/types'

interface Voice {
  id: string
  userId: string
  summary: ConversationSummary
  createdAt: string
  updatedAt: string
}

interface CommunityVoicesProps {
  scope: string
  userId: string
  refreshKey?: number
  onStartInterview: () => void
  isMovement?: boolean
}

function timeAgo(ts: string): string {
  const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

function VoiceCard({ voice, isOwn, isNew }: { voice: Voice; isOwn: boolean; isNew?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const s = voice.summary

  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: -8, scale: 0.98 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
        isOwn
          ? 'bg-indigo-500/8 border-indigo-500/20 hover:border-indigo-500/40'
          : 'bg-slate-800/60 border-slate-700/50 hover:border-slate-600/60'
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {isOwn ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium">
              You
            </span>
          ) : (
            <span className="text-[11px] text-slate-500">
              {voice.userId.slice(0, 8)}
            </span>
          )}
          {isNew && (
            <span className="text-[10px] text-emerald-400">new</span>
          )}
        </div>
        <span className="text-[10px] text-slate-600">{timeAgo(voice.updatedAt)}</span>
      </div>

      {/* Vision preview (always visible) */}
      {s.vision && (
        <p className={`text-xs leading-relaxed ${isOwn ? 'text-slate-200' : 'text-slate-300'} ${expanded ? '' : 'line-clamp-2'}`}>
          &ldquo;{s.vision}&rdquo;
        </p>
      )}

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2.5 pt-2.5 border-t border-slate-700/40 space-y-2">
              {s.priorities && s.priorities.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Priorities</p>
                  <ul className="space-y-0.5">
                    {s.priorities.map((p, i) => (
                      <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                        <span className="text-indigo-400/60 mt-1 shrink-0">&bull;</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {s.ideas && s.ideas.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Ideas</p>
                  <ul className="space-y-0.5">
                    {s.ideas.map((idea, i) => (
                      <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                        <span className="text-emerald-400/60 mt-1 shrink-0">&bull;</span>
                        {idea}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {s.concerns && s.concerns.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Concerns</p>
                  <ul className="space-y-0.5">
                    {s.concerns.map((c, i) => (
                      <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                        <span className="text-amber-400/60 mt-1 shrink-0">&bull;</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {s.skills && s.skills.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Skills offered</p>
                  <div className="flex flex-wrap gap-1">
                    {s.skills.map((skill, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 bg-slate-700/60 rounded text-slate-400">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expand hint */}
      {!expanded && (s.priorities?.length || s.ideas?.length || s.concerns?.length) ? (
        <p className="text-[10px] text-slate-600 mt-1.5">
          Click to see {[
            s.priorities?.length && `${s.priorities.length} priorities`,
            s.ideas?.length && `${s.ideas.length} ideas`,
            s.concerns?.length && `${s.concerns.length} concerns`,
          ].filter(Boolean).join(', ')}
        </p>
      ) : null}
    </motion.div>
  )
}

export default function CommunityVoices({ scope, userId, refreshKey, onStartInterview, isMovement }: CommunityVoicesProps) {
  const [voices, setVoices] = useState<Voice[]>([])
  const [voiceCount, setVoiceCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [prevRefreshKey, setPrevRefreshKey] = useState(refreshKey)

  const fetchVoices = useCallback(async () => {
    try {
      const res = await fetch(`/api/community-voices?scope=${encodeURIComponent(scope)}`)
      const data = await res.json()
      setVoices(data.voices || [])
      setVoiceCount(data.voiceCount || 0)
    } catch (err) {
      console.error('Failed to load community voices:', err)
    } finally {
      setLoading(false)
    }
  }, [scope])

  useEffect(() => {
    fetchVoices()
  }, [fetchVoices])

  // Refresh when refreshKey changes (new voice added)
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey !== prevRefreshKey) {
      setPrevRefreshKey(refreshKey)
      fetchVoices()
    }
  }, [refreshKey, prevRefreshKey, fetchVoices])

  const ownVoices = voices.filter(v => v.userId === userId)
  const otherVoices = voices.filter(v => v.userId !== userId)
  const hasContributed = ownVoices.length > 0

  if (loading) {
    return (
      <div className="text-[11px] text-slate-500 py-3">Loading voices...</div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Voice count + context */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 tabular-nums">
          {voiceCount} voice{voiceCount !== 1 ? 's' : ''}
        </span>
        {hasContributed && (
          <button
            onClick={onStartInterview}
            className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            + Add another
          </button>
        )}
      </div>

      {/* CTA if user hasn't contributed */}
      {!hasContributed && (
        <button
          onClick={onStartInterview}
          className="w-full p-3 rounded-lg border border-dashed border-slate-700/60 hover:border-indigo-500/40 bg-slate-800/30 hover:bg-indigo-500/5 transition-colors text-left group"
        >
          <p className="text-xs text-slate-300 group-hover:text-indigo-200 transition-colors font-medium">
            Share your voice
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
            {isMovement
              ? 'Take a 2-min interview to share what you think the movement should build.'
              : 'Take a 2-min interview to share what you think this project should focus on.'}
          </p>
        </button>
      )}

      {/* Own voices */}
      {ownVoices.map((voice) => (
        <VoiceCard
          key={voice.id}
          voice={voice}
          isOwn
          isNew={refreshKey !== undefined && refreshKey > 0 && voice.updatedAt === ownVoices[0]?.updatedAt}
        />
      ))}

      {/* Other voices */}
      {otherVoices.length > 0 && ownVoices.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <div className="flex-1 h-px bg-slate-800/60" />
          <span className="text-[10px] text-slate-600">others</span>
          <div className="flex-1 h-px bg-slate-800/60" />
        </div>
      )}

      {otherVoices.map((voice) => (
        <VoiceCard key={voice.id} voice={voice} isOwn={false} />
      ))}

      {voices.length === 0 && (
        <p className="text-[11px] text-slate-600 py-2">
          No one has shared their voice yet. Be the first.
        </p>
      )}
    </div>
  )
}
