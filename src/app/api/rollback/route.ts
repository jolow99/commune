import { NextRequest, NextResponse } from 'next/server'
import { readFiles, revertToFiles } from '@/lib/git'
import { getProposal, updateProposalStatus, getApprovedProposals } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { proposalId } = await req.json()

    const { data: proposal, error } = await getProposal(proposalId)
    if (error || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    const { data: history } = await getApprovedProposals()
    const idx = history?.findIndex((p: Record<string, unknown>) => p.id === proposalId) ?? -1
    let revertFiles: Record<string, string>

    if (idx > 0 && history) {
      revertFiles = history[idx - 1].files as Record<string, string>
    } else {
      revertFiles = await readFiles()
    }

    await revertToFiles(revertFiles, `Revert: ${(proposal as Record<string, unknown>).description}`)
    await updateProposalStatus(proposalId, 'rolled_back')

    const newFiles = await readFiles()
    return NextResponse.json({ newFiles })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Rollback error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
