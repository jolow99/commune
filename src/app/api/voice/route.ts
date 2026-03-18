import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('conversations')
      .select('id, scope, summary, created_at, updated_at')
      .eq('user_id', userId)
      .not('summary', 'is', null)
      .order('updated_at', { ascending: false })

    if (error) throw error

    const conversations = (data || []).map(c => ({
      id: c.id,
      scope: c.scope,
      summary: c.summary,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }))

    return NextResponse.json({ conversations })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { conversationId, summary, userId } = await req.json()

    if (!conversationId || !summary || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify ownership
    const { data: conv } = await supabase
      .from('conversations')
      .select('user_id, scope')
      .eq('id', conversationId)
      .single()

    if (!conv || conv.user_id !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    await supabase
      .from('conversations')
      .update({ summary, updated_at: new Date().toISOString() })
      .eq('id', conversationId)

    // Trigger synthesis in background
    const proto = req.headers.get('x-forwarded-proto') || 'http'
    const host = req.headers.get('host') || 'localhost:3000'
    const origin = `${proto}://${host}`

    waitUntil(
      fetch(`${origin}/api/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: conv.scope }),
      }).catch(console.error)
    )

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
