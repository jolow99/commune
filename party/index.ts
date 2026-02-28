import type { Party, Connection, Server } from 'partykit/server'
import type { Proposal, ClientMessage, ServerBroadcast } from '../src/lib/types'

const NEXT_SERVER = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')

export default class CommuneServer implements Server {
  readonly room: Party
  liveFiles: Record<string, string> = {}
  pending: Proposal[] = []
  history: Proposal[] = []

  constructor(room: Party) {
    this.room = room
  }

  async onStart() {
    // Load state from Supabase via the Next.js API
    try {
      const res = await fetch(`${NEXT_SERVER}/api/state`)
      if (res.ok) {
        const data = await res.json()
        this.liveFiles = data.liveFiles || {}
        this.pending = data.pending || []
        this.history = data.history || []
      }
    } catch (err) {
      console.error('Failed to load state from API:', err)
    }
  }

  broadcast(msg: ServerBroadcast) {
    this.room.broadcast(JSON.stringify(msg))
  }

  async onConnect(conn: Connection) {
    // If state is empty (onStart may have failed), reload from Supabase
    if (Object.keys(this.liveFiles).length === 0 && this.pending.length === 0 && this.history.length === 0) {
      try {
        const res = await fetch(`${NEXT_SERVER}/api/state`)
        if (res.ok) {
          const data = await res.json()
          this.liveFiles = data.liveFiles || {}
          this.pending = data.pending || []
          this.history = data.history || []
          console.log('[STATE] Reloaded state on connect:', Object.keys(this.liveFiles).length, 'files,', this.pending.length, 'pending,', this.history.length, 'history')
        }
      } catch (err) {
        console.error('[STATE] Failed to reload state on connect:', err)
      }
    }

    conn.send(JSON.stringify({
      type: 'state',
      liveFiles: this.liveFiles,
      pending: this.pending,
      history: this.history,
    } satisfies ServerBroadcast))
  }

  async onMessage(message: string, sender: Connection) {
    const msg: ClientMessage = JSON.parse(message)

    switch (msg.type) {
      case 'sync': {
        sender.send(JSON.stringify({
          type: 'state',
          liveFiles: this.liveFiles,
          pending: this.pending,
          history: this.history,
        } satisfies ServerBroadcast))
        break
      }

      case 'propose': {
        const proposal = msg.proposal
        this.pending.push(proposal)
        if (Object.keys(this.liveFiles).length === 0) {
          // Initialize liveFiles from proposal's base
          this.liveFiles = { ...proposal.files }
        }

        this.broadcast({ type: 'proposal_created', proposal })
        break
      }

      case 'vote': {
        const proposal = this.pending.find(p => p.id === msg.proposalId)
        if (!proposal) return

        if (proposal.votes.includes(msg.userId)) return
        proposal.votes.push(msg.userId)

        // Persist vote to Supabase
        fetch(`${NEXT_SERVER}/api/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposalId: msg.proposalId, userId: msg.userId }),
        }).catch(err => console.error('Vote persist failed:', err))

        this.broadcast({
          type: 'proposal_voted',
          proposalId: msg.proposalId,
          votes: proposal.votes,
        })

        if (proposal.votes.length >= proposal.votesNeeded) {
          // Merge!
          const mergeUrl = `${NEXT_SERVER}/api/merge`
          console.log('[MERGE] Starting merge for proposal:', msg.proposalId, 'via', mergeUrl)

          // Perform merge inline — read proposal files and update state directly
          // This avoids issues with cross-service fetch from PartyKit to Vercel
          try {
            const res = await fetch(mergeUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ proposalId: msg.proposalId }),
            })
            console.log('[MERGE] Response status:', res.status)
            if (!res.ok) {
              const text = await res.text()
              console.error('[MERGE] API error:', res.status, text)

              // Fallback: use the proposal's files directly from in-memory state
              console.log('[MERGE] Falling back to in-memory merge')
              proposal.status = 'approved'
              this.liveFiles = { ...proposal.files }
              this.pending = this.pending.filter(p => p.id !== msg.proposalId)
              this.history.unshift(proposal)
              this.broadcast({
                type: 'proposal_merged',
                proposal,
                newFiles: this.liveFiles,
              })

              // Try to persist the merge to Supabase in the background
              fetch(`${NEXT_SERVER}/api/merge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ proposalId: msg.proposalId }),
              }).catch(e => console.error('[MERGE] Background persist failed:', e))
              return
            }
            const { newFiles } = await res.json()
            console.log('[MERGE] Success, got newFiles')
            proposal.status = 'approved'
            this.liveFiles = newFiles
            this.pending = this.pending.filter(p => p.id !== msg.proposalId)
            this.history.unshift(proposal)

            this.broadcast({
              type: 'proposal_merged',
              proposal,
              newFiles,
            })
          } catch (err) {
            console.error('[MERGE] Fetch failed:', err)

            // Fallback: merge using in-memory files
            console.log('[MERGE] Falling back to in-memory merge after error')
            proposal.status = 'approved'
            this.liveFiles = { ...proposal.files }
            this.pending = this.pending.filter(p => p.id !== msg.proposalId)
            this.history.unshift(proposal)
            this.broadcast({
              type: 'proposal_merged',
              proposal,
              newFiles: this.liveFiles,
            })
          }
        } else {
  
        }
        break
      }

      case 'rollback': {
        const target = this.history.find(p => p.id === msg.proposalId)
        if (!target) return

        try {
          const rollbackUrl = `${NEXT_SERVER}/api/rollback`
          console.log('[ROLLBACK] Starting rollback for:', msg.proposalId, 'via', rollbackUrl)
          const res = await fetch(rollbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proposalId: msg.proposalId }),
          })
          console.log('[ROLLBACK] Response status:', res.status)
          if (!res.ok) {
            const text = await res.text()
            console.error('[ROLLBACK] API error:', res.status, text)
          }
          const { newFiles } = await res.json()
          target.status = 'rolled_back'
          this.liveFiles = newFiles

          this.broadcast({
            type: 'proposal_merged',
            proposal: target,
            newFiles,
          })
        } catch (err) {
          console.error('[ROLLBACK] Fetch failed:', err)

          // Fallback: find the previous approved proposal's files in history
          const targetIdx = this.history.indexOf(target)
          const previousApproved = this.history.slice(targetIdx + 1).find(p => p.status === 'approved')
          const revertFiles = previousApproved ? { ...previousApproved.files } : { ...this.liveFiles }

          target.status = 'rolled_back'
          this.liveFiles = revertFiles

          this.broadcast({
            type: 'proposal_merged',
            proposal: target,
            newFiles: revertFiles,
          })

          // Try to persist in background
          fetch(`${NEXT_SERVER}/api/rollback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proposalId: msg.proposalId }),
          }).catch(e => console.error('[ROLLBACK] Background persist failed:', e))
        }
        break
      }
    }
  }
}
