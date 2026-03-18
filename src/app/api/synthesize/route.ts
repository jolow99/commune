import { NextRequest, NextResponse } from 'next/server'
import { synthesizeThemes } from '@/lib/synthesis'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const { scope } = await req.json()

    if (!scope) {
      return NextResponse.json({ error: 'scope required' }, { status: 400 })
    }

    await synthesizeThemes(scope)

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Synthesis error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
