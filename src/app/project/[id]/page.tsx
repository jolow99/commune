'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import usePartySocket from 'partysocket/react'
import ProposalFeed from '@/components/ProposalFeed'
import LivePage from '@/components/LivePage'
import PreviewModal from '@/components/PreviewModal'
import Cursors from '@/components/Cursors'
import InterviewChat from '@/components/InterviewChat'
import VoicePanel from '@/components/VoicePanel'
import NotificationBell from '@/components/NotificationBell'
import ThemeList from '@/components/ThemeList'
import { authClient } from '@/lib/auth-client'
import type { Proposal, ServerBroadcast } from '@/lib/types'
import Link from 'next/link'

function getOrCreateUserId() {
  let id = localStorage.getItem('re-user-id')
  if (!id) {
    id = 'user-' + Math.random().toString(36).slice(2, 10)
    localStorage.setItem('re-user-id', id)
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

export default function ProjectPage({ params }: { params: { id: string } }) {
  const projectId = params.id
  const [userId, setUserId] = useState('')
  const { data: session } = authClient.useSession()

  useEffect(() => {
    if (session?.user?.id) {
      setUserId(session.user.id)
    } else {
      setUserId(getOrCreateUserId())
    }
  }, [session])

  const [projectName, setProjectName] = useState('Project')
  const [liveFiles, setLiveFiles] = useState<Record<string, string>>(DEFAULT_FILES)
  const [liveSpec, setLiveSpec] = useState('')
  const [pending, setPending] = useState<Proposal[]>([])
  const [history, setHistory] = useState<Proposal[]>([])
  const [previewProposal, setPreviewProposal] = useState<Proposal | null>(null)
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [mergingProposalId, setMergingProposalId] = useState<string | null>(null)
  const [voicePanelOpen, setVoicePanelOpen] = useState(false)
  const [interviewOpen, setInterviewOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load initial state
  useEffect(() => {
    fetch(`/api/state?projectId=${projectId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.liveFiles && Object.keys(data.liveFiles).length > 0) setLiveFiles(data.liveFiles)
        if (data.liveSpec) setLiveSpec(data.liveSpec)
        if (data.pending) setPending(data.pending)
        if (data.history) setHistory(data.history)
      })
      .catch((err) => console.error('Failed to load initial state:', err))
  }, [])

  // Load project name
  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => {
        const project = (data.projects || []).find((p: { id: string }) => p.id === projectId)
        if (project) setProjectName(project.name)
      })
      .catch(console.error)
  }, [projectId])

  // PartyKit real-time
  const ws = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST || '127.0.0.1:1999',
    room: 're-main',
    onMessage(evt) {
      const msg: ServerBroadcast = JSON.parse(evt.data)
      switch (msg.type) {
        case 'proposal_created':
          if (msg.proposal.projectId === projectId) {
            setPending((prev) => {
              if (prev.some(p => p.id === msg.proposal.id)) return prev
              return [...prev, msg.proposal]
            })
          }
          break
        case 'proposal_voted':
          setPending((prev) =>
            prev.map((p) =>
              p.id === msg.proposalId ? { ...p, votes: msg.votes } : p
            )
          )
          break
        case 'proposal_merged':
          if (msg.proposal.projectId === projectId) {
            setPending((prev) => prev.filter((p) => p.id !== msg.proposal.id))
            setHistory((prev) => [msg.proposal, ...prev.filter(h => h.id !== msg.proposal.id)])
            setLiveFiles(msg.newFiles)
            if (msg.newSpec) setLiveSpec(msg.newSpec)
          }
          break
        case 'rollback':
          if (msg.proposal.projectId === projectId) {
            setHistory((prev) => {
              if (prev.some(h => h.id === msg.proposal.id)) return prev
              return [msg.proposal, ...prev]
            })
            setLiveFiles(msg.newFiles)
            if (msg.newSpec) setLiveSpec(msg.newSpec)
          }
          break
        case 'proposal_ready':
          if (msg.proposal.projectId === projectId) {
            setPending((prev) => {
              const exists = prev.some(p => p.id === msg.proposal.id)
              if (exists) {
                return prev.map(p => p.id === msg.proposal.id ? msg.proposal : p)
              }
              return [...prev, msg.proposal]
            })
          }
          break
        case 'proposal_failed':
          setPending((prev) => prev.filter(p => p.id !== msg.proposalId))
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
        body: JSON.stringify({ userPrompt: input, userId, projectId }),
      })
      const { proposal } = await res.json()
      if (proposal) {
        setPending((prev) => [...prev, proposal])
        setInput('')
        ws.send(JSON.stringify({ type: 'notify', event: 'proposal_created', proposal }))
      }
    } catch (err) {
      console.error('Submit error:', err)
    } finally {
      setSubmitting(false)
    }
  }, [input, submitting, userId, projectId, ws])

  const handleVote = useCallback(
    async (proposalId: string) => {
      const proposal = pending.find((p) => p.id === proposalId)
      if (!proposal) return
      const optimisticVotes = [...proposal.votes, userId]
      setPending((prev) =>
        prev.map((p) =>
          p.id === proposalId ? { ...p, votes: optimisticVotes } : p
        )
      )

      if (optimisticVotes.length >= proposal.votesNeeded) {
        setMergingProposalId(proposalId)
      }

      try {
        const res = await fetch('/api/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposalId, userId }),
        })
        const data = await res.json()
        if (data.error) return

        if (data.merged) {
          setPending((prev) => prev.filter((p) => p.id !== proposalId))
          setHistory((prev) => [data.proposal, ...prev])
          setLiveFiles(data.newFiles)
          if (data.newSpec) setLiveSpec(data.newSpec)
          setMergingProposalId(null)
          ws.send(JSON.stringify({
            type: 'notify', event: 'merged',
            proposal: data.proposal, newFiles: data.newFiles, newSpec: data.newSpec,
          }))
        } else {
          setPending((prev) =>
            prev.map((p) =>
              p.id === proposalId ? { ...p, votes: data.votes } : p
            )
          )
          ws.send(JSON.stringify({
            type: 'notify', event: 'voted',
            proposalId, votes: data.votes,
          }))
        }
      } catch (err) {
        console.error('Vote error:', err)
        setMergingProposalId(null)
        setPending((prev) =>
          prev.map((p) =>
            p.id === proposalId ? { ...p, votes: proposal.votes } : p
          )
        )
      }
    },
    [userId, ws, pending]
  )

  const handleRollback = useCallback(
    async (proposalId: string) => {
      try {
        const res = await fetch('/api/rollback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposalId }),
        })
        const data = await res.json()
        if (data.error) return

        setHistory((prev) => [data.proposal, ...prev])
        setLiveFiles(data.newFiles)
        if (data.newSpec) setLiveSpec(data.newSpec)
        ws.send(JSON.stringify({
          type: 'notify', event: 'rollback',
          proposal: data.proposal, newFiles: data.newFiles, newSpec: data.newSpec,
        }))
      } catch (err) {
        console.error('Rollback error:', err)
      }
    },
    [ws]
  )

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white">
      <Cursors />
      {/* Top bar */}
      <header className="h-12 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Movement
          </Link>
          <h1 className="text-lg font-bold tracking-tight">{projectName}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setVoicePanelOpen(true)}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            Your Voice
          </button>
          {userId && <NotificationBell userId={userId} onOpenInterview={() => setInterviewOpen(true)} />}
          <span className="text-xs text-slate-500">
            {pending.filter(p => p.projectId === projectId || (!p.projectId && projectId === '00000000-0000-0000-0000-000000000001')).length} pending
          </span>
          {session?.user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{session.user.name}</span>
              <button
                onClick={() => authClient.signOut()}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => authClient.signIn.social({ provider: 'google' })}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: Themes + Proposals */}
        <div className="w-80 bg-slate-900 border-r border-slate-700 flex flex-col h-full overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {/* Project themes */}
            <div className="px-3 pt-4 pb-2">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Themes
              </h2>
              <ThemeList
                scope={projectId}
                projectId={projectId}
                userId={userId}
                compact
              />
            </div>

            {/* Divider */}
            <div className="border-t border-slate-700 mx-3" />

            {/* Proposals */}
            <ProposalFeed
              pending={pending}
              history={history}
              userId={userId}
              mergingProposalId={mergingProposalId}
              projectId={projectId}
              embedded
              onVote={handleVote}
              onRollback={handleRollback}
              onPreview={setPreviewProposal}
            />
          </div>
        </div>

        {/* Right: Live preview */}
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
        <span className="text-xs text-slate-600">{userId.slice(0, 12)}</span>
      </footer>

      {/* Interview chat */}
      <InterviewChat
        userId={userId}
        scope={projectId}
        externalOpen={interviewOpen}
        onExternalOpenChange={setInterviewOpen}
      />

      {/* Voice panel */}
      <VoicePanel
        isOpen={voicePanelOpen}
        onClose={() => setVoicePanelOpen(false)}
        userId={userId}
        onStartInterview={() => { setVoicePanelOpen(false); setInterviewOpen(true) }}
      />

      {/* Preview modal */}
      <AnimatePresence>
        {previewProposal && (
          <PreviewModal
            proposal={previewProposal}
            currentSpec={liveSpec}
            onClose={() => setPreviewProposal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
