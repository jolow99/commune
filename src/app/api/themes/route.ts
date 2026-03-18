import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { Theme } from '@/lib/types'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTheme(row: any): Theme {
  return {
    id: row.id,
    scope: row.scope,
    projectId: row.project_id || undefined,
    label: row.label,
    description: row.description,
    category: row.category,
    keywords: row.keywords || [],
    conversationIds: row.conversation_ids || [],
    supportCount: row.support_count || 0,
    status: row.status,
    proposalId: row.proposal_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function GET(req: NextRequest) {
  try {
    const scope = req.nextUrl.searchParams.get('scope') || 'movement'

    let query = supabase
      .from('themes')
      .select('*')
      .eq('scope', scope)
      .neq('status', 'archived')
      .order('support_count', { ascending: false })

    const projectId = req.nextUrl.searchParams.get('projectId')
    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query

    if (error) throw error

    const themes: Theme[] = (data || []).map(mapTheme)

    // Also fetch tensions for this scope
    const { data: tensionRows } = await supabase
      .from('tensions')
      .select('*')
      .eq('scope', scope)
      .eq('status', 'active')

    const tensions = (tensionRows || []).map(t => ({
      id: t.id,
      scope: t.scope,
      themeAId: t.theme_a_id,
      themeBId: t.theme_b_id,
      description: t.description,
      severity: t.severity,
      status: t.status,
      createdAt: t.created_at,
    }))

    return NextResponse.json({ themes, tensions })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
