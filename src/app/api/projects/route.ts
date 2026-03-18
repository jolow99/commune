import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/lib/types'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProject(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    sourceThemeId: row.source_theme_id || undefined,
    status: row.status,
    spec: row.spec || undefined,
    files: row.files || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: true })

    if (error) throw error

    // Get pending proposal counts per project
    const { data: pendingCounts } = await supabase
      .from('proposals')
      .select('project_id')
      .in('status', ['pending', 'generating'])

    const countMap: Record<string, number> = {}
    for (const p of pendingCounts || []) {
      const pid = p.project_id || '00000000-0000-0000-0000-000000000001'
      countMap[pid] = (countMap[pid] || 0) + 1
    }

    const projects = (data || []).map(row => ({
      ...mapProject(row),
      pendingCount: countMap[row.id] || 0,
    }))

    return NextResponse.json({ projects })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, description, sourceThemeId, createdBy } = await req.json()

    if (!name || !description || !createdBy) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        name,
        description,
        created_by: createdBy,
        source_theme_id: sourceThemeId || null,
      })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ project: mapProject(data) })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
