'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import usePartySocket from 'partysocket/react'
import ProposalFeed from '@/components/ProposalFeed'
import ProposalDocumentModal from '@/components/ProposalDocumentModal'
import InterviewChat from '@/components/InterviewChat'
import VoicePanel from '@/components/VoicePanel'
import NotificationBell from '@/components/NotificationBell'
import { authClient } from '@/lib/auth-client'
import type { Proposal, Project, ServerBroadcast } from '@/lib/types'
import { useRouter } from 'next/navigation'

const MOVEMENT_ID = '00000000-0000-0000-0000-000000000001'

function getOrCreateUserId() {
  let id = localStorage.getItem('re-user-id')
  if (!id) {
    id = 'user-' + Math.random().toString(36).slice(2, 10)
    localStorage.setItem('re-user-id', id)
  }
  return id
}

interface ProjectWithCount extends Project {
  pendingCount: number
}

const STEPS = [
  {
    num: '01',
    label: 'Propose',
    desc: 'Pitch a project idea for the community',
  },
  {
    num: '02',
    label: 'Vote',
    desc: 'The community votes on what to build',
  },
  {
    num: '03',
    label: 'Build',
    desc: 'Approved projects become collaborative workspaces',
  },
]

export default function MovementDashboard() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const { data: session } = authClient.useSession()
  const [projects, setProjects] = useState<ProjectWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [voicePanelOpen, setVoicePanelOpen] = useState(false)
  const [interviewOpen, setInterviewOpen] = useState(false)

  // Proposal state (mirroring project page)
  const [pending, setPending] = useState<Proposal[]>([])
  const [history, setHistory] = useState<Proposal[]>([])
  const [previewProposal, setPreviewProposal] = useState<Proposal | null>(null)
  const [mergingProposalId, setMergingProposalId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showBodyInput, setShowBodyInput] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (session?.user?.id) {
      setUserId(session.user.id)
    } else {
      setUserId(getOrCreateUserId())
    }
  }, [session])

  // Load projects
  const fetchProjects = useCallback(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => setProjects(data.projects || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  // Load proposals
  useEffect(() => {
    fetch(`/api/state?projectId=${MOVEMENT_ID}`)
      .then(res => res.json())
      .then(data => {
        if (data.pending) setPending(data.pending)
        if (data.history) setHistory(data.history)
      })
      .catch(console.error)
  }, [])

  // PartyKit real-time
  const ws = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST || '127.0.0.1:1999',
    room: 're-main',
    onMessage(evt) {
      const msg: ServerBroadcast = JSON.parse(evt.data)
      switch (msg.type) {
        case 'proposal_created':
          if (msg.proposal.projectId === MOVEMENT_ID) {
            setPending(prev => {
              if (prev.some(p => p.id === msg.proposal.id)) return prev
              return [...prev, msg.proposal]
            })
          }
          break
        case 'proposal_voted':
          setPending(prev =>
            prev.map(p => p.id === msg.proposalId ? { ...p, votes: msg.votes } : p)
          )
          break
        case 'proposal_merged':
          if (msg.proposal.projectId === MOVEMENT_ID) {
            setPending(prev => prev.filter(p => p.id !== msg.proposal.id))
            setHistory(prev => [msg.proposal, ...prev.filter(h => h.id !== msg.proposal.id)])
            fetchProjects()
          }
          break
        case 'proposal_ready':
          if (msg.proposal.projectId === MOVEMENT_ID) {
            setPending(prev => {
              const exists = prev.some(p => p.id === msg.proposal.id)
              if (exists) return prev.map(p => p.id === msg.proposal.id ? msg.proposal : p)
              return [...prev, msg.proposal]
            })
          }
          break
        case 'proposal_failed':
          setPending(prev => prev.filter(p => p.id !== msg.proposalId))
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
        body: JSON.stringify({
          userPrompt: input,
          userId,
          projectId: MOVEMENT_ID,
          body: body.trim() || input,
        }),
      })
      const { proposal } = await res.json()
      if (proposal) {
        setPending(prev => [...prev, proposal])
        setInput('')
        setBody('')
        setShowBodyInput(false)
        ws.send(JSON.stringify({ type: 'notify', event: 'proposal_created', proposal }))
      }
    } catch (err) {
      console.error('Submit error:', err)
    } finally {
      setSubmitting(false)
    }
  }, [input, body, submitting, userId, ws])

  const handleVote = useCallback(async (proposalId: string) => {
    const proposal = pending.find(p => p.id === proposalId)
    if (!proposal) return
    const optimisticVotes = [...proposal.votes, userId]
    setPending(prev =>
      prev.map(p => p.id === proposalId ? { ...p, votes: optimisticVotes } : p)
    )
    if (previewProposal?.id === proposalId) {
      setPreviewProposal(prev => prev ? { ...prev, votes: optimisticVotes } : null)
    }

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
        setPending(prev => prev.filter(p => p.id !== proposalId))
        setHistory(prev => [data.proposal, ...prev])
        setMergingProposalId(null)
        setPreviewProposal(null)
        fetchProjects()
        ws.send(JSON.stringify({
          type: 'notify', event: 'merged',
          proposal: data.proposal, newFiles: data.newFiles || {}, newSpec: data.newSpec,
        }))
      } else {
        setPending(prev =>
          prev.map(p => p.id === proposalId ? { ...p, votes: data.votes } : p)
        )
        if (previewProposal?.id === proposalId) {
          setPreviewProposal(prev => prev ? { ...prev, votes: data.votes } : null)
        }
        ws.send(JSON.stringify({
          type: 'notify', event: 'voted',
          proposalId, votes: data.votes,
        }))
      }
    } catch (err) {
      console.error('Vote error:', err)
      setMergingProposalId(null)
      setPending(prev =>
        prev.map(p => p.id === proposalId ? { ...p, votes: proposal.votes } : p)
      )
    }
  }, [userId, ws, pending, previewProposal, fetchProjects])

  const handlePreview = useCallback((proposal: Proposal) => {
    if (proposal.body) {
      setPreviewProposal(proposal)
    }
  }, [])

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white">
      {/* ── Header ── */}
      <header className="h-14 border-b border-slate-800/80 flex items-center justify-between px-5 shrink-0 backdrop-blur-sm bg-slate-950/80">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12h8" />
              <path d="M12 8v8" />
            </svg>
          </div>
          <h1 className="text-lg font-display font-bold tracking-tight">Commune</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setVoicePanelOpen(true)}
            className="text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors border border-slate-700/50"
          >
            Your Voice
          </button>
          {userId && <NotificationBell userId={userId} onOpenInterview={() => setInterviewOpen(true)} />}
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
        {/* Left sidebar: Proposals */}
        <div className="w-80 bg-slate-900/50 border-r border-slate-800/60 flex flex-col h-full overflow-hidden">
          {/* Sidebar header */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse-dot" />
              <h2 className="text-xs font-display font-semibold text-slate-300 uppercase tracking-wider">
                Project Proposals
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Ideas from the community. Vote to bring them to life — {pending.filter(p => p.status === 'pending').length > 0
                ? `${pending.filter(p => p.status === 'pending').length} awaiting votes`
                : 'none pending right now'}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto sidebar-scroll">
            <ProposalFeed
              pending={pending}
              history={history}
              userId={userId}
              mergingProposalId={mergingProposalId}
              projectId={MOVEMENT_ID}
              embedded
              onVote={handleVote}
              onRollback={() => {}}
              onPreview={handlePreview}
            />
          </div>
        </div>

        {/* Right: Projects area */}
        <div className="flex-1 overflow-y-auto sidebar-scroll">
          {/* Hero section */}
          <div className="relative hero-gradient">
            <div className="px-8 pt-10 pb-8 max-w-4xl">
              <motion.h2
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-3xl font-display font-bold tracking-tight text-white mb-3"
              >
                Shape the future, together
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-sm text-slate-400 leading-relaxed max-w-lg mb-8"
              >
                Commune is where movements decide what to build. Propose a project,
                rally votes from the community, and collaborate on bringing it to life.
                Every project here was chosen collectively.
              </motion.p>

              {/* How it works steps */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex gap-6 mb-2"
              >
                {STEPS.map((step, i) => (
                  <div key={step.num} className="flex items-start gap-3">
                    <span className="text-[10px] font-display font-bold text-indigo-400/60 mt-0.5">
                      {step.num}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-200">{step.label}</p>
                      <p className="text-[11px] text-slate-500 leading-snug">{step.desc}</p>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="hidden sm:block w-8 h-px bg-slate-800 self-center ml-2" />
                    )}
                  </div>
                ))}
              </motion.div>
            </div>
          </div>

          {/* Projects grid */}
          <div className="px-8 pb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-display font-semibold text-slate-300 uppercase tracking-wider">
                  Active Projects
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Born from community proposals — click to enter a project workspace
                </p>
              </div>
              {projects.length > 0 && (
                <span className="text-xs text-slate-600 tabular-nums">
                  {projects.length} project{projects.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex items-center gap-3 py-12">
                <div className="w-4 h-4 border-2 border-indigo-400/40 border-t-indigo-400 rounded-full animate-spin" />
                <span className="text-sm text-slate-500">Loading projects...</span>
              </div>
            ) : projects.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-16 text-center"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </div>
                <p className="text-sm text-slate-400 font-medium mb-1">No projects yet</p>
                <p className="text-xs text-slate-600 max-w-xs mx-auto">
                  Be the first to propose one. Use the input below to describe your idea —
                  once it gets enough votes, it becomes a collaborative project.
                </p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {projects.map((project, i) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    className="p-5 bg-slate-900/60 rounded-xl border border-slate-800/80 hover:border-slate-600/80 cursor-pointer transition-all group card-glow"
                    onClick={() => router.push(`/project/${project.id}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-display font-semibold text-base truncate group-hover:text-indigo-200 transition-colors">
                          {project.name}
                        </h3>
                        <p className="text-sm text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                          {project.description}
                        </p>
                      </div>
                    </div>

                    {project.sourceThemeId && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        Born from community theme
                      </span>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60">
                      {project.pendingCount > 0 ? (
                        <span className="text-[11px] text-amber-400/80 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                          {project.pendingCount} pending proposal{project.pendingCount !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-600">No pending proposals</span>
                      )}
                      <span className="text-xs text-indigo-400/70 group-hover:text-indigo-300 transition-colors flex items-center gap-1">
                        Enter
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom: Proposal input ── */}
      <footer className="border-t border-slate-800/80 px-5 py-3 shrink-0 bg-slate-950/90 backdrop-blur-sm">
        {showBodyInput && (
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Describe your project idea in detail — what problem does it solve? Who benefits? (Markdown supported)"
            className="w-full bg-slate-900/80 border border-slate-700/60 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 input-focus resize-none mb-2 leading-relaxed"
            rows={4}
          />
        )}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !showBodyInput && handleSubmit()}
              placeholder="What should the community build next?"
              disabled={submitting}
              className="w-full bg-slate-900/80 border border-slate-700/60 rounded-lg pl-4 pr-20 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 input-focus disabled:opacity-50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 pointer-events-none">
              Propose a project
            </span>
          </div>
          <button
            onClick={() => setShowBodyInput(!showBodyInput)}
            className={`p-2.5 rounded-lg transition-colors border ${
              showBodyInput
                ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                : 'bg-slate-800/60 border-slate-700/40 hover:bg-slate-700/60 text-slate-400'
            }`}
            title="Add detailed description"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-700/40 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors border border-indigo-500/50 disabled:border-slate-700/40"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
          <button
            onClick={() => setInterviewOpen(true)}
            className="bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 text-sm px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 border border-slate-700/40"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Share your voice
          </button>
        </div>
      </footer>

      {/* ── Overlays ── */}
      <InterviewChat
        userId={userId}
        scope="movement"
        externalOpen={interviewOpen}
        onExternalOpenChange={setInterviewOpen}
        hideFloatingButton
      />

      <VoicePanel
        isOpen={voicePanelOpen}
        onClose={() => setVoicePanelOpen(false)}
        userId={userId}
        onStartInterview={() => { setVoicePanelOpen(false); setInterviewOpen(true) }}
      />

      <AnimatePresence>
        {previewProposal && (
          <ProposalDocumentModal
            proposal={previewProposal}
            userId={userId}
            onClose={() => setPreviewProposal(null)}
            onVote={handleVote}
            mergingProposalId={mergingProposalId}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
