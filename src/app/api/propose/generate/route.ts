import { NextRequest, NextResponse } from 'next/server'
import { editSpec, renderCode } from '@/lib/agent'
import { supabase } from '@/lib/supabase'
import type { Proposal } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function broadcastToPartyKit(body: Record<string, unknown>) {
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST || '127.0.0.1:1999'
  const proto = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https'
  const url = `${proto}://${host}/parties/main/re-main`
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function POST(req: NextRequest) {
  const { proposalId, userPrompt, currentSpec, baseSpecHash } = await req.json()

  try {
    // Step 1: Edit the spec
    const { description, spec: updatedSpec } = await editSpec(currentSpec, userPrompt)

    // Step 2: Render code from the updated spec
    const files = await renderCode(updatedSpec)

    // Step 3: Update Supabase row to pending and get the updated row back
    const { error: updateError } = await supabase
      .from('proposals')
      .update({ description, spec: updatedSpec, files, status: 'pending' })
      .eq('id', proposalId)

    if (updateError) {
      throw new Error(`Failed to update proposal: ${updateError.message}`)
    }

    // Step 4: Broadcast proposal_ready via PartyKit HTTP API
    // Re-fetch to get project_id and author
    const { data: updatedRow } = await supabase
      .from('proposals')
      .select('author, project_id')
      .eq('id', proposalId)
      .single()

    const proposal: Proposal = {
      id: proposalId,
      description,
      userPrompt,
      author: updatedRow?.author || '',
      timestamp: new Date().toISOString(),
      branch: `proposal/${proposalId}`,
      files,
      baseFilesHash: '',
      spec: updatedSpec,
      baseSpecHash: baseSpecHash || '',
      status: 'pending',
      votes: [],
      votesNeeded: 3,
      type: 'proposal',
      projectId: updatedRow?.project_id || undefined,
    }

    await broadcastToPartyKit({ type: 'proposal_ready', proposal })

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Generate error:', message)

    // Update row with error
    await supabase
      .from('proposals')
      .update({ error_message: message })
      .eq('id', proposalId)

    // Broadcast failure
    await broadcastToPartyKit({
      type: 'proposal_failed',
      proposalId,
      error: message,
    }).catch(console.error)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
