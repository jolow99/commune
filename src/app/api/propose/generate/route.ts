import { NextRequest, NextResponse } from 'next/server'
import { editSpec, renderCode } from '@/lib/agent'
import { supabase } from '@/lib/supabase'
import type { Proposal } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function broadcastToPartyKit(body: Record<string, unknown>) {
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST || '127.0.0.1:1999'
  const proto = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https'
  const url = `${proto}://${host}/parties/main/commune-main`
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function POST(req: NextRequest) {
  const { proposalId, userPrompt, currentSpec } = await req.json()

  try {
    // Step 1: Edit the spec
    const { description, spec: updatedSpec } = await editSpec(currentSpec, userPrompt)

    // Step 2: Render code from the updated spec
    const files = await renderCode(updatedSpec)

    // Step 3: Update Supabase row to pending
    await supabase
      .from('proposals')
      .update({ description, spec: updatedSpec, files, status: 'pending' })
      .eq('id', proposalId)

    // Step 4: Fetch the full row to build the Proposal object
    const { data, error: fetchError } = await supabase.from('proposals').select('*').eq('id', proposalId).single()

    if (fetchError || !data) {
      throw new Error(`Failed to fetch proposal after update: ${fetchError?.message || 'not found'}`)
    }

    const proposal: Proposal = {
      id: data.id,
      description: data.description,
      userPrompt: data.user_prompt,
      author: data.author,
      timestamp: data.timestamp,
      branch: data.branch,
      files: data.files,
      baseFilesHash: data.base_files_hash || '',
      spec: data.spec,
      baseSpecHash: data.base_spec_hash,
      status: 'pending',
      votes: data.votes || [],
      votesNeeded: data.votes_needed || 3,
      type: data.type || 'proposal',
    }

    // Step 5: Broadcast proposal_ready via PartyKit HTTP API
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
