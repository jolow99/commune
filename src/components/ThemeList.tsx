'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Theme, Tension } from '@/lib/types'

interface ThemeListProps {
  scope: string
  projectId?: string
  userId?: string
  onCreateProject?: (theme: Theme) => void
  compact?: boolean
}

const CATEGORY_COLORS: Record<string, string> = {
  priority: 'bg-amber-500/20 text-amber-400',
  idea: 'bg-emerald-500/20 text-emerald-400',
  concern: 'bg-red-500/20 text-red-400',
  vision: 'bg-indigo-500/20 text-indigo-400',
}

const AUTO_PROPOSE_THRESHOLD = 5

function ThemeCard({ theme, userId, onCreateProject, compact }: {
  theme: Theme
  userId?: string
  onCreateProject?: (theme: Theme) => void
  compact?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState<{ conversations: { id: string; userId: string; summary: Record<string, unknown> }[] } | null>(null)

  const loadDetail = useCallback(async () => {
    if (detail) return
    const res = await fetch(`/api/themes/${theme.id}`)
    const data = await res.json()
    setDetail(data)
  }, [theme.id, detail])

  const handleExpand = () => {
    setExpanded(!expanded)
    if (!expanded && !detail) loadDetail()
  }

  const handleFlag = async (conversationId: string) => {
    if (!userId) return
    await fetch(`/api/themes/${theme.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, conversationId, reason: "That's not what I meant" }),
    })
  }

  const progress = Math.min(theme.supportCount / AUTO_PROPOSE_THRESHOLD, 1)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${compact ? 'p-2' : 'p-3'} bg-slate-800 rounded-lg border border-slate-700 cursor-pointer hover:border-slate-600 transition-colors`}
      onClick={handleExpand}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_COLORS[theme.category] || 'bg-slate-700 text-slate-400'}`}>
              {theme.category}
            </span>
            {theme.status === 'proposal_generated' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                Proposal generated
              </span>
            )}
          </div>
          <p className={`text-white font-medium ${compact ? 'text-xs' : 'text-sm'} line-clamp-2`}>{theme.label}</p>
          {!compact && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{theme.description}</p>}
        </div>
        <div className="text-right shrink-0">
          <span className="text-xs text-slate-400">{theme.supportCount} voice{theme.supportCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Progress toward auto-propose */}
      {theme.status === 'active' && theme.supportCount < AUTO_PROPOSE_THRESHOLD && (
        <div className="mt-2">
          <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {AUTO_PROPOSE_THRESHOLD - theme.supportCount} more voice{AUTO_PROPOSE_THRESHOLD - theme.supportCount !== 1 ? 's' : ''} to auto-propose
          </p>
        </div>
      )}

      {/* Create project button for high-support idea themes */}
      {onCreateProject && theme.category === 'idea' && theme.supportCount >= 10 && theme.status === 'active' && (
        <button
          onClick={(e) => { e.stopPropagation(); onCreateProject(theme) }}
          className="mt-2 text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-white transition-colors"
        >
          Create project
        </button>
      )}

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mt-3 pt-3 border-t border-slate-700">
              {theme.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {theme.keywords.map((kw, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 bg-slate-700 rounded text-slate-400">{kw}</span>
                  ))}
                </div>
              )}
              {theme.proposalId && (
                <p className="text-xs text-indigo-400 mb-2">
                  Linked proposal: {theme.proposalId.slice(0, 8)}...
                </p>
              )}
              {detail?.conversations && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 font-medium">Contributing voices:</p>
                  {detail.conversations.map((c) => (
                    <div key={c.id} className="text-xs text-slate-400 flex items-start justify-between gap-2">
                      <span className="truncate">{c.userId.slice(0, 8)}...</span>
                      {userId && c.userId === userId && (
                        <button
                          onClick={() => handleFlag(c.id)}
                          className="text-[10px] text-red-400 hover:text-red-300 shrink-0"
                        >
                          Not what I meant
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function TensionCard({ tension, themes }: { tension: Tension; themes: Theme[] }) {
  const themeA = themes.find(t => t.id === tension.themeAId)
  const themeB = themes.find(t => t.id === tension.themeBId)

  return (
    <div className="p-2 bg-amber-900/20 rounded-lg border border-amber-800/30">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-amber-400 text-xs">&#x26A0;</span>
        <span className={`text-[10px] px-1 py-0.5 rounded ${
          tension.severity === 'high' ? 'bg-red-500/20 text-red-400' :
          tension.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
          'bg-slate-700 text-slate-400'
        }`}>{tension.severity}</span>
      </div>
      <p className="text-xs text-slate-300">
        <span className="text-amber-400">{themeA?.label || 'Theme'}</span>
        {' vs '}
        <span className="text-amber-400">{themeB?.label || 'Theme'}</span>
      </p>
      <p className="text-xs text-slate-400 mt-1">{tension.description}</p>
    </div>
  )
}

export default function ThemeList({ scope, projectId, userId, onCreateProject, compact }: ThemeListProps) {
  const [themes, setThemes] = useState<Theme[]>([])
  const [tensions, setTensions] = useState<Tension[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams({ scope })
    if (projectId) params.set('projectId', projectId)

    fetch(`/api/themes?${params}`)
      .then(res => res.json())
      .then(data => {
        setThemes(data.themes || [])
        setTensions(data.tensions || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [scope, projectId])

  if (loading) {
    return (
      <div className="text-sm text-slate-500 px-2 py-4">Loading themes...</div>
    )
  }

  if (themes.length === 0 && tensions.length === 0) {
    return (
      <div className="text-sm text-slate-600 px-2 py-4">
        No themes yet. Share your voice to help shape the direction.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {themes.map(theme => (
        <ThemeCard
          key={theme.id}
          theme={theme}
          userId={userId}
          onCreateProject={onCreateProject}
          compact={compact}
        />
      ))}
      {tensions.length > 0 && (
        <>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-2">
            Tensions
          </h3>
          {tensions.map(tension => (
            <TensionCard key={tension.id} tension={tension} themes={themes} />
          ))}
        </>
      )}
    </div>
  )
}
