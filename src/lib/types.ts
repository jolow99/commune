export interface Proposal {
  id: string
  description: string
  author: string
  timestamp: number
  branch: string
  files: Record<string, string>
  status: 'pending' | 'approved' | 'rolled_back'
  votes: string[]
  votesNeeded: number
}

// Client sends notifications to PartyKit after API calls succeed
export type ClientMessage =
  | { type: 'notify'; event: 'proposal_created'; proposal: Proposal }
  | { type: 'notify'; event: 'voted'; proposalId: string; votes: string[] }
  | { type: 'notify'; event: 'merged'; proposal: Proposal; newFiles: Record<string, string> }
  | { type: 'notify'; event: 'rollback'; proposal: Proposal; newFiles: Record<string, string> }

// PartyKit broadcasts to all other clients
export type ServerBroadcast =
  | { type: 'proposal_created'; proposal: Proposal }
  | { type: 'proposal_voted'; proposalId: string; votes: string[] }
  | { type: 'proposal_merged'; proposal: Proposal; newFiles: Record<string, string> }
