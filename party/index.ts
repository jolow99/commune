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
    // Load state from PartyKit's built-in storage (persists across restarts)
    const stored = await this.room.storage.get<{
      liveFiles: Record<string, string>
      pending: Proposal[]
      history: Proposal[]
    }>('state')

    if (stored) {
      this.liveFiles = stored.liveFiles || {}
      this.pending = stored.pending || []
      this.history = stored.history || []
      console.log('[STATE] Loaded from storage:', Object.keys(this.liveFiles).length, 'files,', this.pending.length, 'pending,', this.history.length, 'history')
    }
  }

  private async saveState() {
    await this.room.storage.put('state', {
      liveFiles: this.liveFiles,
      pending: this.pending,
      history: this.history,
    })
  }

  broadcast(msg: ServerBroadcast) {
    this.room.broadcast(JSON.stringify(msg))
  }

  onConnect(conn: Connection) {
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
      case 'init_state': {
        // Client pushes authoritative state from Supabase when PartyKit has no data
        if (Object.keys(this.liveFiles).length === 0 && this.pending.length === 0 && this.history.length === 0) {
          this.liveFiles = msg.liveFiles || {}
          this.pending = msg.pending || []
          this.history = msg.history || []
          await this.saveState()
          console.log('[STATE] Initialized from client:', Object.keys(this.liveFiles).length, 'files,', this.pending.length, 'pending,', this.history.length, 'history')

          // Broadcast to all connected clients so they get the data too
          this.broadcast({
            type: 'state',
            liveFiles: this.liveFiles,
            pending: this.pending,
            history: this.history,
          })
        }
        break
      }

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
          this.liveFiles = { ...proposal.files }
        }
        await this.saveState()

        this.broadcast({ type: 'proposal_created', proposal })
        break
      }

      case 'vote': {
        const proposal = this.pending.find(p => p.id === msg.proposalId)
        if (!proposal) return

        if (proposal.votes.includes(msg.userId)) return
        proposal.votes.push(msg.userId)

        // Persist vote to Supabase (fire-and-forget)
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
          // Merge using in-memory state
          console.log('[MERGE] Merging proposal:', msg.proposalId)
          proposal.status = 'approved'
          this.liveFiles = { ...proposal.files }
          this.pending = this.pending.filter(p => p.id !== msg.proposalId)
          this.history.unshift(proposal)
          await this.saveState()

          this.broadcast({
            type: 'proposal_merged',
            proposal,
            newFiles: this.liveFiles,
          })

          // Persist merge to Supabase (fire-and-forget)
          fetch(`${NEXT_SERVER}/api/merge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proposalId: msg.proposalId }),
          }).catch(e => console.error('[MERGE] Supabase persist failed:', e))
        } else {
          await this.saveState()
        }
        break
      }

      case 'rollback': {
        const target = this.history.find(p => p.id === msg.proposalId)
        if (!target) return

        const targetIdx = this.history.indexOf(target)
        const previousApproved = this.history.slice(targetIdx + 1).find(p => p.status === 'approved')
        const revertFiles = previousApproved ? { ...previousApproved.files } : { ...this.liveFiles }

        target.status = 'rolled_back'
        this.liveFiles = revertFiles
        await this.saveState()

        console.log('[ROLLBACK] Rolling back proposal:', msg.proposalId)

        this.broadcast({
          type: 'proposal_merged',
          proposal: target,
          newFiles: revertFiles,
        })

        // Persist rollback to Supabase (fire-and-forget)
        fetch(`${NEXT_SERVER}/api/rollback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposalId: msg.proposalId }),
        }).catch(e => console.error('[ROLLBACK] Supabase persist failed:', e))
        break
      }
    }
  }
}
