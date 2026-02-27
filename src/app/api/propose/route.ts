import { NextRequest, NextResponse } from 'next/server'
import { readFiles, createProposalBranch } from '@/lib/git'
import { generateProposal } from '@/lib/agent'
import { saveProposal } from '@/lib/supabase'
import { v4 as uuid } from 'uuid'
import type { Proposal } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userPrompt, userId } = await req.json()

    if (!userPrompt || !userId) {
      return NextResponse.json({ error: 'Missing userPrompt or userId' }, { status: 400 })
    }

    const currentFiles = await readFiles()
    const { description, files } = await generateProposal(currentFiles, userPrompt)
    const proposalFiles = { ...currentFiles, ...files }

    const id = uuid()
    const branch = `proposal/${id}`

    await createProposalBranch(id, proposalFiles, description)

    const proposal: Proposal = {
      id,
      description,
      author: userId,
      timestamp: Date.now(),
      branch,
      files: proposalFiles,
      status: 'pending',
      votes: [],
      votesNeeded: 3,
    }

    await saveProposal({
      id,
      description,
      author: userId,
      timestamp: proposal.timestamp,
      branch,
      files: proposalFiles,
      status: 'pending',
      votes: [],
      votes_needed: 3,
    })

    return NextResponse.json({ proposal })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Propose error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
