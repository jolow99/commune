export interface Proposal {
  id: string
  description: string
  userPrompt: string
  author: string
  timestamp: number | string
  branch: string
  files: Record<string, string>
  baseFilesHash: string
  spec?: string
  baseSpecHash?: string
  errorMessage?: string
  status: 'generating' | 'pending' | 'approved'
  votes: string[]
  votesNeeded: number
  type: 'proposal' | 'rollback'
  revertsId?: string
  body?: string
  projectId?: string
  sourceThemeId?: string
}

export interface ProposalSuggestion {
  id: string
  proposalId: string
  author: string
  originalText: string
  suggestedText: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
}

export interface Project {
  id: string
  name: string
  description: string
  createdBy: string
  sourceThemeId?: string
  status: 'active' | 'archived'
  spec?: string
  files?: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface Theme {
  id: string
  scope: string
  projectId?: string
  label: string
  description: string
  category: 'priority' | 'idea' | 'concern' | 'vision'
  keywords: string[]
  conversationIds: string[]
  supportCount: number
  status: 'active' | 'proposal_generated' | 'archived'
  proposalId?: string
  createdAt: string
  updatedAt: string
}

export interface Tension {
  id: string
  scope: string
  themeAId: string
  themeBId: string
  themeALabel?: string
  themeBLabel?: string
  description: string
  severity: 'low' | 'medium' | 'high'
  status: 'active' | 'resolved'
  resolution?: string
  createdAt: string
}

export interface ConversationSummary {
  vision: string
  priorities: string[]
  skills: string[]
  ideas: string[]
  concerns: string[]
}

export interface Conversation {
  id: string
  userId: string
  scope: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  summary?: ConversationSummary
  createdAt: string
  updatedAt: string
}

export interface Notification {
  id: string
  userId: string
  type: string
  payload: Record<string, unknown>
  read: boolean
  createdAt: string
}

// Client sends notifications to PartyKit after API calls succeed
export type ClientMessage =
  | { type: 'notify'; event: 'proposal_created'; proposal: Proposal }
  | { type: 'notify'; event: 'voted'; proposalId: string; votes: string[] }
  | { type: 'notify'; event: 'merged'; proposal: Proposal; newFiles: Record<string, string>; newSpec?: string }
  | { type: 'notify'; event: 'rollback'; proposal: Proposal; newFiles: Record<string, string>; newSpec?: string }
  | { type: 'notify'; event: 'proposal_ready'; proposal: Proposal }
  | { type: 'notify'; event: 'proposal_failed'; proposalId: string; error: string }

// PartyKit broadcasts to all other clients
export type ServerBroadcast =
  | { type: 'proposal_created'; proposal: Proposal }
  | { type: 'proposal_voted'; proposalId: string; votes: string[] }
  | { type: 'proposal_merged'; proposal: Proposal; newFiles: Record<string, string>; newSpec?: string }
  | { type: 'rollback'; proposal: Proposal; newFiles: Record<string, string>; newSpec?: string }
  | { type: 'proposal_ready'; proposal: Proposal }
  | { type: 'proposal_failed'; proposalId: string; error: string }
