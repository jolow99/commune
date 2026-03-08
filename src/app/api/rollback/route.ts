import { NextRequest, NextResponse } from 'next/server'
import { readFiles, revertToFiles, DEFAULT_FILES, DEFAULT_SPEC } from '@/lib/git'
import { supabase } from '@/lib/supabase'
import { syncToGitHub } from '@/lib/github'
import crypto from 'crypto'

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

    // Find the approved entry immediately before the target (by merged_at DESC)
    const { data: approvedHistory } = await supabase
      .from('proposals')
      .select('*')
      .eq('status', 'approved')
      .order('merged_at', { ascending: false })

    // Find the entry right before the target in chronological order
    const targetIndex = approvedHistory?.findIndex((p: { id: string }) => p.id === proposalId) ?? -1
    const previousApproved = targetIndex >= 0 && approvedHistory ? approvedHistory[targetIndex + 1] : undefined

    let revertFiles: Record<string, string>
    let revertSpec: string

    if (previousApproved) {
      revertFiles = previousApproved.files as Record<string, string>
      revertSpec = (previousApproved.spec as string) || DEFAULT_SPEC
    } else {
      // No previous approved proposal — revert to default
      revertFiles = DEFAULT_FILES
      revertSpec = DEFAULT_SPEC
    }

    await revertToFiles(revertFiles, revertSpec)

    // Insert a new rollback entry (append-only — original proposal is NOT mutated)
    const rollbackId = crypto.randomUUID()
    const now = new Date().toISOString()
    const rollbackDescription = `Rolled back: ${proposal.description}`

    const { error: insertError } = await supabase.from('proposals').insert({
      id: rollbackId,
      type: 'rollback',
      reverts_id: proposalId,
      description: rollbackDescription,
      user_prompt: rollbackDescription,
      author: 'system',
      timestamp: now,
      merged_at: now,
      branch: `rollback-${proposalId.slice(0, 8)}`,
      files: revertFiles,
      spec: revertSpec,
      base_files_hash: '',
      base_spec_hash: '',
      status: 'approved',
      votes: [],
      votes_needed: 0,
    })

    if (insertError) {
      console.error('Failed to insert rollback proposal:', insertError)
      return NextResponse.json({ error: 'Failed to save rollback' }, { status: 500 })
    }

    await syncToGitHub({
      files: revertFiles,
      spec: revertSpec,
      commitMessage: `[Rollback] Reverted proposal #${proposalId}`,
    })

    const newFiles = await readFiles()

    const rollbackProposal = {
      id: rollbackId,
      description: rollbackDescription,
      userPrompt: rollbackDescription,
      author: 'system',
      timestamp: now,
      branch: `rollback-${proposalId.slice(0, 8)}`,
      files: revertFiles,
      baseFilesHash: '',
      spec: revertSpec,
      baseSpecHash: '',
      status: 'approved' as const,
      votes: [] as string[],
      votesNeeded: 0,
      type: 'rollback' as const,
      revertsId: proposalId,
    }

    return NextResponse.json({ newFiles, newSpec: revertSpec, proposal: rollbackProposal })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Rollback error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
