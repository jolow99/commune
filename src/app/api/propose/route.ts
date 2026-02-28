import { NextRequest, NextResponse } from 'next/server'
import { readFiles, hashFiles } from '@/lib/git'
import { generateProposal } from '@/lib/agent'
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

    const currentFiles = await readFiles()
    const baseFilesHash = hashFiles(currentFiles)
    const { description, files } = await generateProposal(currentFiles, userPrompt)
    const proposalFiles = { ...currentFiles, ...files }

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
      baseFilesHash,
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
      base_files_hash: baseFilesHash,
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
