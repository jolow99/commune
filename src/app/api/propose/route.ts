import { NextRequest, NextResponse } from 'next/server'
import { readSpec, hashSpec } from '@/lib/git'
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

    // Read current state
    const currentSpec = await readSpec()
    const baseSpecHash = hashSpec(currentSpec)

    const id = uuid()
    const branch = `proposal/${id}`
    const timestamp = Date.now()

    // Insert skeleton row with generating status
    await supabase.from('proposals').insert({
      id,
      description: '',
      user_prompt: userPrompt,
      author: userId,
      timestamp,
      branch,
      files: {},
      base_files_hash: '',
      spec: '',
      base_spec_hash: baseSpecHash,
      status: 'generating',
      votes: [],
      votes_needed: 3,
    })

    const proposal: Proposal = {
      id,
      description: '',
      userPrompt,
      author: userId,
      timestamp,
      branch,
      files: {},
      baseFilesHash: '',
      spec: '',
      baseSpecHash,
      status: 'generating',
      votes: [],
      votesNeeded: 3,
      type: 'proposal',
    }

    // Build origin URL for the generate endpoint
    const proto = req.headers.get('x-forwarded-proto') || 'http'
    const host = req.headers.get('host') || 'localhost:3000'
    const origin = `${proto}://${host}`

    // Fire-and-forget: kick off generation in a separate serverless invocation
    fetch(`${origin}/api/propose/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId: id, userPrompt, currentSpec, baseSpecHash }),
    }).catch(console.error)

    return NextResponse.json({ proposal })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Propose error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
