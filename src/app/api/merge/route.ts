import { NextRequest, NextResponse } from 'next/server'
import { mergeBranch } from '@/lib/git'
import { getProposal, updateProposalStatus } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { proposalId } = await req.json()

    const { data: proposal, error } = await getProposal(proposalId)
    if (error || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    const newFiles = await mergeBranch(proposal.branch as string)
    await updateProposalStatus(proposalId, 'approved')

    return NextResponse.json({ newFiles })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Merge error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
