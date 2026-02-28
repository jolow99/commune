'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { Proposal } from '@/lib/types'

interface ProposalFeedProps {
  pending: Proposal[]
  history: Proposal[]
  userId: string
  onVote: (proposalId: string) => void
  onRollback: (proposalId: string) => void
  onPreview: (proposal: Proposal) => void
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

export default function ProposalFeed({
  pending,
  history,
  userId,
  onVote,
  onRollback,
  onPreview,
}: ProposalFeedProps) {
  return (
    <div className="w-80 bg-slate-900 border-r border-slate-700 flex flex-col h-full overflow-hidden">
      {/* Pending */}
      <div className="flex-1 overflow-y-auto">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider px-4 pt-4 pb-2">
          Pending ({pending.length})
        </h2>
        <AnimatePresence>
          {pending.map((p) => (
            <motion.div
              key={p.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ backgroundColor: '#22c55e33', opacity: 0, x: -20 }}
              className="mx-3 mb-2 p-3 bg-slate-800 rounded-lg border border-slate-700"
            >
              <p className="text-xs text-indigo-400 mb-1 line-clamp-2 italic">&ldquo;{p.userPrompt}&rdquo;</p>
              <p className="text-sm text-white mb-2 line-clamp-2">{p.description}</p>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs text-slate-500">by {p.author.slice(0, 8)}</p>
                <span className="text-xs text-amber-500/70">&middot; Preview may change on merge</span>
              </div>
              <VoteBar votes={p.votes.length} needed={p.votesNeeded} />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => onPreview(p)}
                  className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
                >
                  Preview
                </button>
                <button
                  onClick={() => onVote(p.id)}
                  disabled={p.votes.includes(userId)}
                  className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 rounded text-white transition-colors"
                >
                  {p.votes.includes(userId) ? 'Voted' : 'Vote'}
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {pending.length === 0 && (
          <p className="text-sm text-slate-600 px-4">No pending proposals</p>
        )}

        {/* History */}
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider px-4 pt-4 pb-2">
          History ({history.length})
        </h2>
        {history.map((p) => (
          <div
            key={p.id}
            className="mx-3 mb-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50"
          >
            <p className="text-sm text-slate-300 mb-1 line-clamp-2">{p.description}</p>
            <div className="flex items-center justify-between">
              <span className={`text-xs ${p.status === 'approved' ? 'text-green-400' : 'text-orange-400'}`}>
                {p.status === 'approved' ? 'Merged' : 'Rolled back'}
              </span>
              {p.status === 'approved' && (
                <button
                  onClick={() => onRollback(p.id)}
                  className="text-xs px-2 py-1 bg-red-900/30 hover:bg-red-900/50 rounded text-red-400 transition-colors"
                >
                  Rollback
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
