import { NextRequest, NextResponse } from 'next/server'
import { readFiles, revertToFiles, DEFAULT_FILES } from '@/lib/git'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { proposalId } = await req.json()

    const { data: proposal, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single()

    if (error || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    // Find the previous approved proposal to revert to
    const { data: approvedHistory } = await supabase
      .from('proposals')
      .select('*')
      .eq('status', 'approved')
      .order('timestamp', { ascending: false })

    // Filter out the proposal being rolled back, then take the most recent remaining
    const previousApproved = approvedHistory?.filter((p: { id: string }) => p.id !== proposalId)[0]
    let revertFiles: Record<string, string>

    if (previousApproved) {
      revertFiles = previousApproved.files as Record<string, string>
    } else {
      // No previous approved proposal — revert to default
      revertFiles = DEFAULT_FILES
    }

    await revertToFiles(revertFiles)
    await supabase.from('proposals').update({ status: 'rolled_back' }).eq('id', proposalId)

    const newFiles = await readFiles()

    const fullProposal = {
      id: proposal.id,
      description: proposal.description,
      author: proposal.author,
      timestamp: proposal.timestamp,
      branch: proposal.branch,
      files: proposal.files,
      status: 'rolled_back' as const,
      votes: proposal.votes || [],
      votesNeeded: proposal.votes_needed || 3,
    }

    return NextResponse.json({ newFiles, proposal: fullProposal })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Rollback error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
