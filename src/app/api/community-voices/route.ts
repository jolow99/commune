import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const scope = req.nextUrl.searchParams.get('scope') || 'movement'

    const { data, error } = await supabase
      .from('conversations')
      .select('id, user_id, summary, created_at, updated_at')
      .eq('scope', scope)
      .not('summary', 'is', null)
      .order('updated_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      voiceCount: data?.length || 0,
      voices: (data || []).map(c => ({
        id: c.id,
        userId: c.user_id,
        summary: c.summary,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
