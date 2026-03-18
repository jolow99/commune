import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('proposal_suggestions')
    .select('*')
    .eq('proposal_id', params.id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const suggestions = (data || []).map(s => ({
    id: s.id,
    proposalId: s.proposal_id,
    author: s.author,
    originalText: s.original_text,
    suggestedText: s.suggested_text,
    status: s.status,
    createdAt: s.created_at,
  }))

  return NextResponse.json({ suggestions })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { originalText, suggestedText, author } = await req.json()

  if (!originalText || !suggestedText || !author) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('proposal_suggestions')
    .insert({
      proposal_id: params.id,
      author,
      original_text: originalText,
      suggested_text: suggestedText,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    suggestion: {
      id: data.id,
      proposalId: data.proposal_id,
      author: data.author,
      originalText: data.original_text,
      suggestedText: data.suggested_text,
      status: data.status,
      createdAt: data.created_at,
    },
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { suggestionId, status, userId } = await req.json()

  if (!suggestionId || !status || !['accepted', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Verify the caller is the proposal author
  const { data: proposal } = await supabase
    .from('proposals')
    .select('author')
    .eq('id', params.id)
    .single()

  if (!proposal || proposal.author !== userId) {
    return NextResponse.json({ error: 'Only the proposal author can accept/reject suggestions' }, { status: 403 })
  }

  // Update suggestion status
  const { error: updateError } = await supabase
    .from('proposal_suggestions')
    .update({ status })
    .eq('id', suggestionId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // If accepted, apply the text change to the proposal body
  if (status === 'accepted') {
    const { data: suggestion } = await supabase
      .from('proposal_suggestions')
      .select('original_text, suggested_text')
      .eq('id', suggestionId)
      .single()

    if (suggestion) {
      const { data: prop } = await supabase
        .from('proposals')
        .select('body')
        .eq('id', params.id)
        .single()

      if (prop?.body) {
        const newBody = prop.body.replace(suggestion.original_text, suggestion.suggested_text)
        await supabase
          .from('proposals')
          .update({ body: newBody })
          .eq('id', params.id)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
