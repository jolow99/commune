import { NextRequest, NextResponse } from 'next/server'
import { mergeBranch } from '@/lib/git'
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

    const newFiles = await mergeBranch(proposal.branch)
    await supabase.from('proposals').update({ status: 'approved' }).eq('id', proposalId)

    return NextResponse.json({ newFiles })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Merge error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
