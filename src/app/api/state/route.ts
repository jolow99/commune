import { NextResponse } from 'next/server'
import { readFiles, readSpec } from '@/lib/git'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [liveFiles, liveSpec] = await Promise.all([readFiles(), readSpec()])

    const { data: proposals } = await supabase
      .from('proposals')
      .select('*')
      .order('timestamp', { ascending: false })

    const all = (proposals || []).map((p) => ({
      id: p.id,
      description: p.description,
      userPrompt: p.user_prompt || p.description,
      author: p.author,
      timestamp: p.timestamp,
      branch: p.branch,
      files: p.files,
      baseFilesHash: p.base_files_hash || '',
      spec: p.spec || undefined,
      baseSpecHash: p.base_spec_hash || undefined,
      status: p.status,
      votes: p.votes || [],
      votesNeeded: p.votes_needed || 3,
    }))

    const pending = all.filter((p) => p.status === 'pending')
    const history = all.filter((p) => p.status !== 'pending')

    return NextResponse.json({ liveFiles, liveSpec, pending, history })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('State error:', message)
    return NextResponse.json({ liveFiles: {}, liveSpec: '', pending: [], history: [] })
  }
}
