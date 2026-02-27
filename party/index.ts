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
    // Load state from storage
    this.liveFiles = (await this.room.storage.get('liveFiles')) || {}
    this.pending = (await this.room.storage.get('pending')) || []
    this.history = (await this.room.storage.get('history')) || []
  }

  async saveState() {
    await this.room.storage.put('liveFiles', this.liveFiles)
    await this.room.storage.put('pending', this.pending)
    await this.room.storage.put('history', this.history)
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
        await this.saveState()
        this.broadcast({ type: 'proposal_created', proposal })
        break
      }

      case 'vote': {
        const proposal = this.pending.find(p => p.id === msg.proposalId)
        if (!proposal) return

        if (proposal.votes.includes(msg.userId)) return
        proposal.votes.push(msg.userId)

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
            await this.saveState()
            this.broadcast({
              type: 'proposal_merged',
              proposal,
              newFiles,
            })
          } catch (err) {
            console.error('Merge failed:', err)
          }
        } else {
          await this.saveState()
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
          await this.saveState()
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
