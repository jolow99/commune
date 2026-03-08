import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { readSpec, hashSpec } from '@/lib/git'
import { rebaseSpec, renderCode } from '@/lib/agent'
import { syncToGitHub } from '@/lib/github'

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
      const currentMainSpec = await readSpec()
      const currentSpecHash = hashSpec(currentMainSpec)
      const proposalBaseSpecHash = proposal.base_spec_hash || ''

      let finalFiles = proposal.files as Record<string, string>
      let finalSpec = (proposal.spec as string) || ''

      // Check staleness by spec hash
      if (proposalBaseSpecHash && currentSpecHash !== proposalBaseSpecHash && finalSpec) {
        // Spec has diverged — rebase
        const originalPrompt = proposal.user_prompt || proposal.description
        const { spec: rebasedSpec } = await rebaseSpec(
          currentMainSpec,
          finalSpec,
          originalPrompt
        )
        finalSpec = rebasedSpec
        finalFiles = await renderCode(finalSpec)

        await supabase.from('proposals').update({
          files: finalFiles,
          spec: finalSpec,
          votes,
          status: 'approved',
          merged_at: new Date().toISOString(),
        }).eq('id', proposalId)
      } else {
        await supabase.from('proposals').update({ votes, status: 'approved', merged_at: new Date().toISOString() }).eq('id', proposalId)
      }

      // Write final files and spec to main
      const update: Record<string, unknown> = {
        files: finalFiles,
        updated_at: new Date().toISOString(),
      }
      if (finalSpec) {
        update.spec = finalSpec
      }
      await supabase.from('site_state').update(update).eq('id', 'main')

      await syncToGitHub({
        files: finalFiles,
        spec: finalSpec,
        commitMessage: `[Proposal #${proposalId}] ${proposal.user_prompt || proposal.description}\n\nVoters: ${votes.join(', ')}`,
      })

      const fullProposal = {
        id: proposal.id,
        description: proposal.description,
        userPrompt: proposal.user_prompt || proposal.description,
        author: proposal.author,
        timestamp: proposal.timestamp,
        branch: proposal.branch,
        files: finalFiles,
        baseFilesHash: proposal.base_files_hash || '',
        spec: finalSpec,
        baseSpecHash: proposalBaseSpecHash,
        status: 'approved' as const,
        votes,
        votesNeeded,
      }

      return NextResponse.json({
        votes,
        merged: true,
        proposal: fullProposal,
        newFiles: finalFiles,
        newSpec: finalSpec,
      })
    }

    // Just save the vote
    await supabase.from('proposals').update({ votes }).eq('id', proposalId)
    return NextResponse.json({ votes, merged: false })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
