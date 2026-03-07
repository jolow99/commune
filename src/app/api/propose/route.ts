import { NextRequest, NextResponse } from 'next/server'
import { readFiles, readSpec, hashSpec } from '@/lib/git'
import { editSpec, renderCode } from '@/lib/agent'
import { supabase } from '@/lib/supabase'
import { v4 as uuid } from 'uuid'
import type { Proposal } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userPrompt, userId } = await req.json()

    if (!userPrompt || !userId) {
      return NextResponse.json({ error: 'Missing userPrompt or userId' }, { status: 400 })
    }

    // Step 1: Read current state (parallel)
    const [currentFiles, currentSpec] = await Promise.all([readFiles(), readSpec()])
    const baseSpecHash = hashSpec(currentSpec)

    // Step 2: Edit the spec
    const { description, spec: updatedSpec } = await editSpec(currentSpec, userPrompt)

    // Step 3: Render code from the updated spec
    const proposalFiles = await renderCode(updatedSpec)

    const id = uuid()
    const branch = `proposal/${id}`

    const proposal: Proposal = {
      id,
      description,
      userPrompt,
      author: userId,
      timestamp: Date.now(),
      branch,
      files: proposalFiles,
      baseFilesHash: '', // no longer primary; kept for compat
      spec: updatedSpec,
      baseSpecHash,
      status: 'pending',
      votes: [],
      votesNeeded: 3,
    }

    await supabase.from('proposals').insert({
      id,
      description,
      user_prompt: userPrompt,
      author: userId,
      timestamp: proposal.timestamp,
      branch,
      files: proposalFiles,
      base_files_hash: '',
      spec: updatedSpec,
      base_spec_hash: baseSpecHash,
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
