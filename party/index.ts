import type { Party, Connection, Server, Request as PartyRequest } from 'partykit/server'
import type { ClientMessage, ServerBroadcast } from '../src/lib/types'

export default class CommuneServer implements Server {
  readonly room: Party

  constructor(room: Party) {
    this.room = room
  }

  async onRequest(req: PartyRequest) {
    if (req.method === 'POST') {
      const body = await req.json() as ServerBroadcast
      this.room.broadcast(JSON.stringify(body))
      return new Response('OK')
    }
    return new Response('Method not allowed', { status: 405 })
  }

  onMessage(message: string, sender: Connection) {
    const msg: ClientMessage = JSON.parse(message)
    if (msg.type !== 'notify') return

    let broadcast: ServerBroadcast
    switch (msg.event) {
      case 'proposal_created':
        broadcast = { type: 'proposal_created', proposal: msg.proposal }
        break
      case 'voted':
        broadcast = { type: 'proposal_voted', proposalId: msg.proposalId, votes: msg.votes }
        break
      case 'merged':
        broadcast = { type: 'proposal_merged', proposal: msg.proposal, newFiles: msg.newFiles, newSpec: msg.newSpec }
        break
      case 'rollback':
        broadcast = { type: 'rollback', proposal: msg.proposal, newFiles: msg.newFiles, newSpec: msg.newSpec }
        break
      case 'proposal_ready':
        broadcast = { type: 'proposal_ready', proposal: msg.proposal }
        break
      case 'proposal_failed':
        broadcast = { type: 'proposal_failed', proposalId: msg.proposalId, error: msg.error }
        break
      default:
        return
    }

    // Broadcast to all clients except the sender
    const msg_str = JSON.stringify(broadcast)
    this.room.broadcast(msg_str, [sender.id])
  }
}
