import { NextRequest, NextResponse } from 'next/server'
import { readFiles, revertToFiles } from '@/lib/git'
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

    // Find the previous approved proposal to revert to
    const { data: history } = await supabase
      .from('proposals')
      .select('*')
      .eq('status', 'approved')
      .order('timestamp', { ascending: true })

    const idx = history?.findIndex((p: { id: string }) => p.id === proposalId) ?? -1
    let revertFiles: Record<string, string>

    if (idx > 0 && history) {
      revertFiles = history[idx - 1].files as Record<string, string>
    } else {
      revertFiles = await readFiles()
    }

    await revertToFiles(revertFiles)
    await supabase.from('proposals').update({ status: 'rolled_back' }).eq('id', proposalId)

    const newFiles = await readFiles()
    return NextResponse.json({ newFiles })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Rollback error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
