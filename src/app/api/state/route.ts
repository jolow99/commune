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
      type: p.type || 'proposal',
      revertsId: p.reverts_id || undefined,
      errorMessage: p.error_message || undefined,
    }))

    // Clean up stuck generating proposals (older than 2 minutes)
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000
    for (const p of all) {
      const ts = typeof p.timestamp === 'string' ? new Date(p.timestamp).getTime() : p.timestamp
      if (p.status === 'generating' && ts < twoMinutesAgo) {
        p.errorMessage = 'Generation timed out'
        await supabase
          .from('proposals')
          .update({ error_message: 'Generation timed out' })
          .eq('id', p.id)
      }
    }

    const pending = all.filter((p) => p.status === 'pending' || p.status === 'generating')
    const history = all.filter((p) => p.status !== 'pending' && p.status !== 'generating')

    return NextResponse.json({ liveFiles, liveSpec, pending, history })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('State error:', message)
    return NextResponse.json({ liveFiles: {}, liveSpec: '', pending: [], history: [] })
  }
}
