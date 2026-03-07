import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { hashFiles } from '@/lib/git'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 100)
    const cursor = searchParams.get('cursor') // ISO timestamp string

    let query = supabase
      .from('proposals')
      .select('id, user_prompt, spec, merged_at, timestamp, files')
      .eq('status', 'approved')
      .order('merged_at', { ascending: false, nullsFirst: false })
      .limit(limit + 1)

    if (cursor) {
      query = query.lt('merged_at', cursor)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const hasMore = (data?.length || 0) > limit
    const proposals = (data || []).slice(0, limit).map((p) => ({
      id: p.id,
      user_prompt: p.user_prompt,
      spec: p.spec,
      merged_at: p.merged_at || (p.timestamp ? new Date(p.timestamp).toISOString() : null),
      files_hash: p.files ? hashFiles(p.files as Record<string, string>) : null,
    }))

    const nextCursor = hasMore ? proposals[proposals.length - 1]?.merged_at : null

    return NextResponse.json({ proposals, nextCursor })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
