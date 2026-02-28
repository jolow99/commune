import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { readFiles, hashFiles } from '@/lib/git'
import { rebaseProposal } from '@/lib/agent'

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
      // Check if main has changed since proposal was created (stale base)
      const currentMainFiles = await readFiles()
      const currentHash = hashFiles(currentMainFiles)
      const proposalBaseHash = proposal.base_files_hash || ''

      let finalFiles = proposal.files as Record<string, string>

      if (proposalBaseHash && currentHash !== proposalBaseHash) {
        // Main has diverged — rebase the proposal using the LLM
        const originalPrompt = proposal.user_prompt || proposal.description
        const { files: rebasedChanges } = await rebaseProposal(
          currentMainFiles,
          finalFiles,
          originalPrompt
        )
        finalFiles = { ...currentMainFiles, ...rebasedChanges }

        // Update the proposal's files with rebased version
        await supabase.from('proposals').update({
          files: finalFiles,
          votes,
          status: 'approved',
        }).eq('id', proposalId)
      } else {
        await supabase.from('proposals').update({ votes, status: 'approved' }).eq('id', proposalId)
      }

      // Write final files to main
      await supabase.from('site_state').update({
        files: finalFiles,
        updated_at: new Date().toISOString(),
      }).eq('id', 'main')

      const fullProposal = {
        id: proposal.id,
        description: proposal.description,
        userPrompt: proposal.user_prompt || proposal.description,
        author: proposal.author,
        timestamp: proposal.timestamp,
        branch: proposal.branch,
        files: finalFiles,
        baseFilesHash: proposal.base_files_hash || '',
        status: 'approved' as const,
        votes,
        votesNeeded,
      }

      return NextResponse.json({ votes, merged: true, proposal: fullProposal, newFiles: finalFiles })
    }

    // Just save the vote
    await supabase.from('proposals').update({ votes }).eq('id', proposalId)
    return NextResponse.json({ votes, merged: false })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
