import { NextResponse } from 'next/server'
import { readFiles } from '@/lib/git'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const liveFiles = await readFiles()

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
      status: p.status,
      votes: p.votes || [],
      votesNeeded: p.votes_needed || 3,
    }))

    const pending = all.filter((p) => p.status === 'pending')
    const history = all.filter((p) => p.status !== 'pending')

    return NextResponse.json({ liveFiles, pending, history })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('State error:', message)
    return NextResponse.json({ liveFiles: {}, pending: [], history: [] })
  }
}
