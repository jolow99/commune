'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
  const [projectDesc, setProjectDesc] = useState('')
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

  // Load project info
  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => {
        const project = (data.projects || []).find((p: { id: string; description?: string }) => p.id === projectId)
        if (project) {
          setProjectName(project.name)
          if (project.description) setProjectDesc(project.description)
        }
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

  const pendingCount = pending.filter(p =>
    p.projectId === projectId || (!p.projectId && projectId === '00000000-0000-0000-0000-000000000001')
  ).length

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white">
      <Cursors />

      {/* ── Header ── */}
      <header className="h-14 border-b border-slate-800/80 flex items-center justify-between px-5 shrink-0 backdrop-blur-sm bg-slate-950/80">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-slate-200 transition-colors flex items-center gap-1 pr-3 border-r border-slate-800"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            All Projects
          </Link>
          <div>
            <h1 className="text-base font-display font-bold tracking-tight leading-none">
              {projectName}
            </h1>
            {projectDesc && (
              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 max-w-md">{projectDesc}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setVoicePanelOpen(true)}
            className="text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors border border-slate-700/50"
          >
            Your Voice
          </button>
          {userId && <NotificationBell userId={userId} onOpenInterview={() => setInterviewOpen(true)} />}
          {pendingCount > 0 && (
            <span className="text-[11px] text-amber-400/80 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
              {pendingCount} pending
            </span>
          )}
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
              className="text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors border border-slate-700/50"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: Themes + Proposals */}
        <div className="w-80 bg-slate-900/50 border-r border-slate-800/60 flex flex-col h-full overflow-hidden">
          <div className="flex-1 overflow-y-auto sidebar-scroll">
            {/* Themes section */}
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <h2 className="text-xs font-display font-semibold text-slate-300 uppercase tracking-wider">
                  Community Themes
                </h2>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                What people are saying about this project. Themes with enough support auto-generate proposals.
              </p>
              <ThemeList
                scope={projectId}
                projectId={projectId}
                userId={userId}
                compact
              />
            </div>

            {/* Divider */}
            <div className="border-t border-slate-800/60 mx-4" />

            {/* Proposals section */}
            <div className="px-4 pt-3 pb-1">
              <div className="flex items-center gap-2 mb-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <h2 className="text-xs font-display font-semibold text-slate-300 uppercase tracking-wider">
                  Proposed Changes
                </h2>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Vote on changes to this project&apos;s deliverable. The live preview on the right shows the current state.
              </p>
            </div>

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
        <div className="flex-1 relative">
          <LivePage files={liveFiles} />
          {/* Preview label */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="absolute top-3 right-4 text-[10px] text-slate-500 bg-slate-900/80 backdrop-blur-sm px-2 py-1 rounded border border-slate-800/60 pointer-events-none"
          >
            Live preview — changes apply when proposals are merged
          </motion.div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <footer className="border-t border-slate-800/80 flex items-center gap-3 px-5 py-3 shrink-0 bg-slate-950/90 backdrop-blur-sm">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Describe a change you'd like to see..."
            disabled={submitting}
            className="w-full bg-slate-900/80 border border-slate-700/60 rounded-lg pl-4 pr-28 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 input-focus disabled:opacity-50"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 pointer-events-none">
            Propose a change
          </span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting || !input.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors border border-indigo-500/50 disabled:border-slate-700/40"
        >
          {submitting ? 'Generating...' : 'Submit'}
        </button>
        <button
          onClick={() => setInterviewOpen(true)}
          className="bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 text-sm px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 border border-slate-700/40"
          title="Share your thoughts about this project through a guided interview"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Share your voice
        </button>
      </footer>

      {/* ── Overlays ── */}
      <InterviewChat
        userId={userId}
        scope={projectId}
        externalOpen={interviewOpen}
        onExternalOpenChange={setInterviewOpen}
      />

      <VoicePanel
        isOpen={voicePanelOpen}
        onClose={() => setVoicePanelOpen(false)}
        userId={userId}
        onStartInterview={() => { setVoicePanelOpen(false); setInterviewOpen(true) }}
      />

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
