'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import usePartySocket from 'partysocket/react'
import ProposalFeed from '@/components/ProposalFeed'
import LivePage from '@/components/LivePage'
import PreviewModal from '@/components/PreviewModal'
import Cursors from '@/components/Cursors'
import type { Proposal, ServerBroadcast } from '@/lib/types'

function getOrCreateUserId() {
  let id = localStorage.getItem('commune-user-id')
  if (!id) {
    id = 'user-' + Math.random().toString(36).slice(2, 10)
    localStorage.setItem('commune-user-id', id)
  }
  return id
}

const DEFAULT_FILES: Record<string, string> = {
  'src/App.tsx': `import { motion } from 'framer-motion'

export default function App() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 text-white flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center max-w-2xl"
      >
        <h1 className="text-6xl font-bold tracking-tight mb-6">
          Build together.<br />Govern together.
        </h1>
        <p className="text-xl text-indigo-300 mb-10">
          A living platform owned by the movement. Every line of this page was voted in by the community.
        </p>
        <motion.a
          href="#join"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          className="inline-block bg-indigo-500 hover:bg-indigo-400 text-white font-semibold px-8 py-4 rounded-2xl text-lg transition-colors"
        >
          Join the experiment
        </motion.a>
      </motion.div>
    </main>
  )
}`,
}

export default function Home() {
  const [userId, setUserId] = useState('')

  useEffect(() => {
    setUserId(getOrCreateUserId())
  }, [])
  const [liveFiles, setLiveFiles] = useState<Record<string, string>>(DEFAULT_FILES)
  const [pending, setPending] = useState<Proposal[]>([])
  const [history, setHistory] = useState<Proposal[]>([])
  const [previewProposal, setPreviewProposal] = useState<Proposal | null>(null)
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const ws = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST || '127.0.0.1:1999',
    room: 'commune-main',
    onMessage(evt) {
      const msg: ServerBroadcast = JSON.parse(evt.data)
      switch (msg.type) {
        case 'state':
          if (Object.keys(msg.liveFiles).length > 0) setLiveFiles(msg.liveFiles)
          setPending(msg.pending)
          setHistory(msg.history)
          break
        case 'proposal_created':
          setPending((prev) => [...prev, msg.proposal])
          break
        case 'proposal_voted':
          setPending((prev) =>
            prev.map((p) =>
              p.id === msg.proposalId ? { ...p, votes: msg.votes } : p
            )
          )
          break
        case 'proposal_merged':
          setPending((prev) => prev.filter((p) => p.id !== msg.proposal.id))
          setHistory((prev) => [msg.proposal, ...prev.filter(h => h.id !== msg.proposal.id)])
          setLiveFiles(msg.newFiles)
          break
      }
    },
  })

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt: input, userId }),
      })
      const { proposal } = await res.json()
      if (proposal) {
        ws.send(JSON.stringify({ type: 'propose', proposal }))
        setInput('')
      }
    } catch (err) {
      console.error('Submit error:', err)
    } finally {
      setSubmitting(false)
    }
  }, [input, submitting, userId, ws])

  const handleVote = useCallback(
    (proposalId: string) => {
      ws.send(JSON.stringify({ type: 'vote', proposalId, userId }))
    },
    [userId, ws]
  )

  const handleRollback = useCallback(
    (proposalId: string) => {
      ws.send(JSON.stringify({ type: 'rollback', proposalId, userId }))
    },
    [userId, ws]
  )

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white">
      <Cursors />
      {/* Top bar */}
      <header className="h-12 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
        <h1 className="text-lg font-bold tracking-tight">Commune</h1>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {[0].map((i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-indigo-400"
              />
            ))}
          </div>
          <span className="text-xs text-slate-500">
            {pending.length} pending
          </span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <ProposalFeed
          pending={pending}
          history={history}
          userId={userId}
          onVote={handleVote}
          onRollback={handleRollback}
          onPreview={setPreviewProposal}
        />
        <LivePage files={liveFiles} />
      </div>

      {/* Bottom bar */}
      <footer className="h-14 border-t border-slate-800 flex items-center gap-3 px-4 shrink-0">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Describe a change to the page..."
          disabled={submitting}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={submitting || !input.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {submitting ? 'Generating...' : 'Submit'}
        </button>
        <span className="text-xs text-slate-600">{userId}</span>
      </footer>

      {/* Preview modal */}
      <AnimatePresence>
        {previewProposal && (
          <PreviewModal
            proposal={previewProposal}
            onClose={() => setPreviewProposal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
