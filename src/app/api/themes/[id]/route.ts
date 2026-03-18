import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const { data: theme, error } = await supabase
      .from('themes')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !theme) {
      return NextResponse.json({ error: 'Theme not found' }, { status: 404 })
    }

    // Fetch contributing conversation summaries
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, user_id, summary, created_at')
      .in('id', theme.conversation_ids || [])

    return NextResponse.json({
      theme: {
        id: theme.id,
        scope: theme.scope,
        label: theme.label,
        description: theme.description,
        category: theme.category,
        keywords: theme.keywords,
        conversationIds: theme.conversation_ids,
        supportCount: theme.support_count,
        status: theme.status,
        proposalId: theme.proposal_id,
        createdAt: theme.created_at,
        updatedAt: theme.updated_at,
      },
      conversations: (conversations || []).map(c => ({
        id: c.id,
        userId: c.user_id,
        summary: c.summary,
        createdAt: c.created_at,
      })),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const { userId, conversationId, reason } = await req.json()

    if (!userId || !conversationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await supabase.from('theme_flags').insert({
      theme_id: id,
      user_id: userId,
      conversation_id: conversationId,
      reason: reason || null,
    })

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
