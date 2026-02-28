import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { mergeBranch } from '@/lib/git'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { proposalId, userId } = await req.json()

    const { data: proposal } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single()

    if (!proposal) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (proposal.status !== 'pending') {
      return NextResponse.json({ error: 'Proposal is not pending' }, { status: 400 })
    }

    const votes: string[] = proposal.votes || []
    if (votes.includes(userId)) {
      return NextResponse.json({ votes, merged: false })
    }

    votes.push(userId)
    const votesNeeded = proposal.votes_needed || 3

    if (votes.length >= votesNeeded) {
      // Atomic merge: update votes + status + site_state in one flow
      const newFiles = await mergeBranch(proposal.branch)
      await supabase.from('proposals').update({ votes, status: 'approved' }).eq('id', proposalId)

      const fullProposal = {
        id: proposal.id,
        description: proposal.description,
        author: proposal.author,
        timestamp: proposal.timestamp,
        branch: proposal.branch,
        files: proposal.files,
        status: 'approved' as const,
        votes,
        votesNeeded,
      }

      return NextResponse.json({ votes, merged: true, proposal: fullProposal, newFiles })
    }

    // Just save the vote
    await supabase.from('proposals').update({ votes }).eq('id', proposalId)
    return NextResponse.json({ votes, merged: false })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
