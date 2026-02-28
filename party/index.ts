import type { Party, Connection, Server } from 'partykit/server'
import type { ClientMessage, ServerBroadcast } from '../src/lib/types'

export default class CommuneServer implements Server {
  readonly room: Party

  constructor(room: Party) {
    this.room = room
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
        broadcast = { type: 'proposal_merged', proposal: msg.proposal, newFiles: msg.newFiles }
        break
      case 'rollback':
        broadcast = { type: 'proposal_merged', proposal: msg.proposal, newFiles: msg.newFiles }
        break
      default:
        return
    }

    // Broadcast to all clients except the sender
    const msg_str = JSON.stringify(broadcast)
    this.room.broadcast(msg_str, [sender.id])
  }
}
