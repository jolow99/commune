import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { readFiles, readSpec } from '@/lib/git'

export const dynamic = 'force-dynamic'

async function resolveSnapshot(
  ref: string
): Promise<{ files: Record<string, string>; spec: string }> {
  if (ref === 'current') {
    const [files, spec] = await Promise.all([readFiles(), readSpec()])
    return { files, spec }
  }

  const { data, error } = await supabase
    .from('proposals')
    .select('files, spec')
    .eq('id', ref)
    .single()

  if (error || !data) {
    throw new Error(`Proposal ${ref} not found`)
  }

  return {
    files: (data.files as Record<string, string>) || {},
    spec: (data.spec as string) || '',
  }
}

export async function POST(req: NextRequest) {
  try {
    const { from, to } = await req.json()

    if (!from || !to) {
      return NextResponse.json({ error: '"from" and "to" are required' }, { status: 400 })
    }

    const [fromSnapshot, toSnapshot] = await Promise.all([
      resolveSnapshot(from),
      resolveSnapshot(to),
    ])

    // Compute per-file diff
    const allPaths = Array.from(new Set([
      ...Object.keys(fromSnapshot.files),
      ...Object.keys(toSnapshot.files),
    ]))

    const files: Array<{
      path: string
      status: 'added' | 'removed' | 'modified'
      before?: string
      after?: string
    }> = []

    for (const path of allPaths) {
      const before = fromSnapshot.files[path]
      const after = toSnapshot.files[path]

      if (before === undefined) {
        files.push({ path, status: 'added', after })
      } else if (after === undefined) {
        files.push({ path, status: 'removed', before })
      } else if (before !== after) {
        files.push({ path, status: 'modified', before, after })
      }
      // skip unchanged
    }

    return NextResponse.json({
      files,
      spec: {
        before: fromSnapshot.spec,
        after: toSnapshot.spec,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
