import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { readSpec, hashSpec } from '@/lib/git'
import { supabase } from '@/lib/supabase'
import { v4 as uuid } from 'uuid'
import type { Proposal } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userPrompt, userId, projectId, body } = await req.json()

    if (!userPrompt || !userId) {
      return NextResponse.json({ error: 'Missing userPrompt or userId' }, { status: 400 })
    }

    const MOVEMENT_ID = '00000000-0000-0000-0000-000000000001'
    const resolvedProjectId = projectId || MOVEMENT_ID
    const isMovementLevel = resolvedProjectId === MOVEMENT_ID

    // Document-type proposals (movement-level with body) skip code generation
    if (isMovementLevel && body) {
      const id = uuid()
      const branch = `proposal/${id}`
      const timestamp = new Date().toISOString()

      await supabase.from('proposals').insert({
        id,
        description: userPrompt,
        user_prompt: userPrompt,
        author: userId,
        timestamp,
        branch,
        files: {},
        base_files_hash: '',
        spec: '',
        base_spec_hash: '',
        body,
        status: 'pending',
        votes: [],
        votes_needed: 3,
        project_id: MOVEMENT_ID,
      })

      const proposal: Proposal = {
        id,
        description: userPrompt,
        userPrompt,
        author: userId,
        timestamp,
        branch,
        files: {},
        baseFilesHash: '',
        status: 'pending',
        votes: [],
        votesNeeded: 3,
        type: 'proposal',
        body,
        projectId: MOVEMENT_ID,
      }

      return NextResponse.json({ proposal })
    }

    // Code-type proposals: generate via LLM
    const currentSpec = await readSpec()
    const baseSpecHash = hashSpec(currentSpec)

    const id = uuid()
    const branch = `proposal/${id}`
    const timestamp = new Date().toISOString()

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
      project_id: resolvedProjectId,
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
      projectId: resolvedProjectId,
    }

    // Build origin URL for the generate endpoint
    const proto = req.headers.get('x-forwarded-proto') || 'http'
    const host = req.headers.get('host') || 'localhost:3000'
    const origin = `${proto}://${host}`

    // Kick off generation in a separate serverless invocation
    waitUntil(
      fetch(`${origin}/api/propose/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: id, userPrompt, currentSpec, baseSpecHash }),
      }).catch(console.error)
    )

    return NextResponse.json({ proposal })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Propose error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
