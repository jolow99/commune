import type { Party, Connection, Server } from 'partykit/server'
import type { Proposal, ClientMessage, ServerBroadcast } from '../src/lib/types'

const NEXT_SERVER = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

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
          try {
            const res = await fetch(`${NEXT_SERVER}/api/merge`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ proposalId: msg.proposalId }),
            })
            const { newFiles } = await res.json()
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
            console.error('Merge failed:', err)
          }
        } else {
  
        }
        break
      }

      case 'rollback': {
        const target = this.history.find(p => p.id === msg.proposalId)
        if (!target) return

        try {
          const res = await fetch(`${NEXT_SERVER}/api/rollback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proposalId: msg.proposalId }),
          })
          const { newFiles } = await res.json()
          target.status = 'rolled_back'
          this.liveFiles = newFiles
  
          this.broadcast({
            type: 'proposal_merged',
            proposal: target,
            newFiles,
          })
        } catch (err) {
          console.error('Rollback failed:', err)
        }
        break
      }
    }
  }
}
