import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { proposalId, userId } = await req.json()

    const { data: proposal } = await supabase
      .from('proposals')
      .select('votes')
      .eq('id', proposalId)
      .single()

    if (!proposal) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const votes: string[] = proposal.votes || []
    if (votes.includes(userId)) {
      return NextResponse.json({ votes })
    }

    votes.push(userId)
    await supabase.from('proposals').update({ votes }).eq('id', proposalId)

    return NextResponse.json({ votes })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
