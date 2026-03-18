import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { readSpec, hashSpec } from '@/lib/git'
import { rebaseSpec, renderCode } from '@/lib/agent'
import { syncToGitHub } from '@/lib/github'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { proposalId, userId } = await req.json()

    const { data: proposal } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single()

    if (!proposal) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (proposal.status !== 'pending') {
      return NextResponse.json({ error: 'Proposal is not pending' }, { status: 400 })
    }

    const votes: string[] = proposal.votes || []
    if (votes.includes(userId)) {
      return NextResponse.json({ votes, merged: false })
    }

    votes.push(userId)
    const votesNeeded = proposal.votes_needed || 3

    if (votes.length >= votesNeeded) {
      const isDocumentProposal = !!proposal.body
      let finalFiles = proposal.files as Record<string, string>
      let finalSpec = (proposal.spec as string) || ''

      if (isDocumentProposal) {
        // Document proposals: just mark as approved, no code rebase
        await supabase.from('proposals').update({ votes, status: 'approved', merged_at: new Date().toISOString() }).eq('id', proposalId)
      } else {
        // Code proposals: rebase if needed, sync files
        const currentMainSpec = await readSpec()
        const currentSpecHash = hashSpec(currentMainSpec)
        const proposalBaseSpecHash = proposal.base_spec_hash || ''

        // Check staleness by spec hash
        if (proposalBaseSpecHash && currentSpecHash !== proposalBaseSpecHash && finalSpec) {
          const originalPrompt = proposal.user_prompt || proposal.description
          const { spec: rebasedSpec } = await rebaseSpec(
            currentMainSpec,
            finalSpec,
            originalPrompt
          )
          finalSpec = rebasedSpec
          finalFiles = await renderCode(finalSpec)

          await supabase.from('proposals').update({
            files: finalFiles,
            spec: finalSpec,
            votes,
            status: 'approved',
            merged_at: new Date().toISOString(),
          }).eq('id', proposalId)
        } else {
          await supabase.from('proposals').update({ votes, status: 'approved', merged_at: new Date().toISOString() }).eq('id', proposalId)
        }

        // Write final files and spec to main
        const update: Record<string, unknown> = {
          files: finalFiles,
          updated_at: new Date().toISOString(),
        }
        if (finalSpec) {
          update.spec = finalSpec
        }
        await supabase.from('site_state').update(update).eq('id', 'main')

        await syncToGitHub({
          files: finalFiles,
          spec: finalSpec,
          commitMessage: `[Proposal #${proposalId}] ${proposal.user_prompt || proposal.description}\n\nVoters: ${votes.join(', ')}`,
        })
      }

      const fullProposal = {
        id: proposal.id,
        description: proposal.description,
        userPrompt: proposal.user_prompt || proposal.description,
        author: proposal.author,
        timestamp: proposal.timestamp,
        branch: proposal.branch,
        files: finalFiles,
        baseFilesHash: proposal.base_files_hash || '',
        spec: finalSpec,
        baseSpecHash: proposal.base_spec_hash || '',
        status: 'approved' as const,
        votes,
        votesNeeded,
        body: proposal.body || undefined,
        sourceThemeId: proposal.source_theme_id || undefined,
        projectId: proposal.project_id || undefined,
      }

      // If movement-level proposal merged, auto-create a project
      const MOVEMENT_ID = '00000000-0000-0000-0000-000000000001'
      if (proposal.project_id === MOVEMENT_ID) {
        await supabase.from('projects').insert({
          name: proposal.description || proposal.user_prompt,
          description: proposal.body || proposal.user_prompt,
          created_by: proposal.author,
          source_theme_id: proposal.source_theme_id || null,
        })
      }

      // If this was a synthesis-driven proposal, notify contributing users
      if (proposal.source_theme_id) {
        const { data: theme } = await supabase
          .from('themes')
          .select('label, conversation_ids')
          .eq('id', proposal.source_theme_id)
          .single()

        if (theme && theme.conversation_ids?.length) {
          const { data: convos } = await supabase
            .from('conversations')
            .select('user_id')
            .in('id', theme.conversation_ids)

          const userIds = Array.from(new Set((convos || []).map((c: { user_id: string }) => c.user_id)))
          const notifications = userIds.map(uid => ({
            user_id: uid,
            type: 'merge_feedback',
            payload: {
              proposalId: proposal.id,
              themeLabel: theme.label,
              themeId: proposal.source_theme_id,
              message: `The community merged a change about "${theme.label}". Does it match what you had in mind?`,
            },
          }))

          if (notifications.length > 0) {
            try {
              await supabase.from('notifications').insert(notifications)
            } catch (e) {
              console.error('Failed to insert notifications:', e)
            }
          }
        }
      }

      return NextResponse.json({
        votes,
        merged: true,
        proposal: fullProposal,
        newFiles: finalFiles,
        newSpec: finalSpec,
      })
    }

    // Just save the vote
    await supabase.from('proposals').update({ votes }).eq('id', proposalId)
    return NextResponse.json({ votes, merged: false })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
