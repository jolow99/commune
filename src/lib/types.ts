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

export type ClientMessage =
  | { type: 'propose'; proposal: Proposal }
  | { type: 'vote'; proposalId: string; userId: string }
  | { type: 'rollback'; proposalId: string; userId: string }
  | { type: 'sync' }

export type ServerBroadcast =
  | { type: 'state'; liveFiles: Record<string, string>; pending: Proposal[]; history: Proposal[] }
  | { type: 'proposal_created'; proposal: Proposal }
  | { type: 'proposal_voted'; proposalId: string; votes: string[] }
  | { type: 'proposal_merged'; proposal: Proposal; newFiles: Record<string, string> }
