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
            // Re-fetch projects since a merged proposal may have auto-created one
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
    // For code proposals at movement level, no preview (they shouldn't exist normally)
  }, [])

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white">
      {/* Top bar */}
      <header className="h-12 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
        <h1 className="text-lg font-bold tracking-tight">Revolution Engine</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setVoicePanelOpen(true)}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
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
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Proposals */}
        <div className="w-80 bg-slate-900 border-r border-slate-700 flex flex-col h-full overflow-hidden">
          <div className="flex-1 overflow-y-auto">
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

        {/* Right: Projects */}
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Projects
          </h2>
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-slate-600">No projects yet. Submit a proposal to create one.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {projects.map(project => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-slate-900 rounded-xl border border-slate-700 hover:border-slate-600 cursor-pointer transition-colors group"
                  onClick={() => router.push(`/project/${project.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-white font-medium">{project.name}</h3>
                      <p className="text-sm text-slate-400 mt-1 line-clamp-2">{project.description}</p>
                    </div>
                    <span className="text-xs text-slate-500 shrink-0">
                      {project.pendingCount} pending
                    </span>
                  </div>
                  {project.sourceThemeId && (
                    <span className="inline-block mt-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400">
                      Born from community theme
                    </span>
                  )}
                  <div className="mt-3 flex items-center gap-2 text-xs text-indigo-400 group-hover:text-indigo-300 transition-colors">
                    Enter project
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar: Proposal input */}
      <footer className="border-t border-slate-800 px-4 py-3 shrink-0">
        {showBodyInput && (
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Describe your project idea in detail (markdown supported)..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none mb-2"
            rows={4}
          />
        )}
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !showBodyInput && handleSubmit()}
            placeholder="Describe a new project idea..."
            disabled={submitting}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
          <button
            onClick={() => setShowBodyInput(!showBodyInput)}
            className={`text-xs px-3 py-2 rounded-lg transition-colors ${
              showBodyInput ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="Toggle detailed description"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
          <button
            onClick={() => setInterviewOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Share your voice
          </button>
        </div>
      </footer>

      {/* Interview chat */}
      <InterviewChat
        userId={userId}
        scope="movement"
        externalOpen={interviewOpen}
        onExternalOpenChange={setInterviewOpen}
        hideFloatingButton
      />

      {/* Voice panel */}
      <VoicePanel
        isOpen={voicePanelOpen}
        onClose={() => setVoicePanelOpen(false)}
        userId={userId}
        onStartInterview={() => { setVoicePanelOpen(false); setInterviewOpen(true) }}
      />

      {/* Document proposal modal */}
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
