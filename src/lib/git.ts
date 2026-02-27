import { supabase } from './supabase'

const DEFAULT_FILES: Record<string, string> = {
  'src/App.tsx': `import { motion } from 'framer-motion'

export default function App() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 text-white flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center max-w-2xl"
      >
        <h1 className="text-6xl font-bold tracking-tight mb-6">
          Build together.<br />Govern together.
        </h1>
        <p className="text-xl text-indigo-300 mb-10">
          A living platform owned by the movement. Every line of this page was voted in by the community.
        </p>
        <motion.a
          href="#join"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          className="inline-block bg-indigo-500 hover:bg-indigo-400 text-white font-semibold px-8 py-4 rounded-2xl text-lg transition-colors"
        >
          Join the experiment
        </motion.a>
      </motion.div>
    </main>
  )
}`,
}

export async function readFiles(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('site_state')
    .select('files')
    .eq('id', 'main')
    .single()

  if (error || !data) {
    // First run — seed the default files
    await supabase.from('site_state').upsert({
      id: 'main',
      files: DEFAULT_FILES,
      updated_at: new Date().toISOString(),
    })
    return DEFAULT_FILES
  }

  const files = data.files as Record<string, string>
  if (!files || Object.keys(files).length === 0) {
    await supabase.from('site_state').update({
      files: DEFAULT_FILES,
      updated_at: new Date().toISOString(),
    }).eq('id', 'main')
    return DEFAULT_FILES
  }

  return files
}

export async function createProposalBranch(
  ...[]: [string, Record<string, string>, string]
): Promise<void> {
  // No-op: proposal files are stored in the proposals table
}

export async function mergeBranch(branch: string): Promise<Record<string, string>> {
  // branch is "proposal/<id>", extract the proposal's files from proposals table
  const proposalId = branch.replace('proposal/', '')

  const { data: proposal } = await supabase
    .from('proposals')
    .select('files')
    .eq('id', proposalId)
    .single()

  if (!proposal) {
    throw new Error(`Proposal ${proposalId} not found`)
  }

  const newFiles = proposal.files as Record<string, string>

  // Update main state
  await supabase.from('site_state').update({
    files: newFiles,
    updated_at: new Date().toISOString(),
  }).eq('id', 'main')

  return newFiles
}

export async function revertToFiles(
  files: Record<string, string>,
): Promise<void> {
  await supabase.from('site_state').update({
    files,
    updated_at: new Date().toISOString(),
  }).eq('id', 'main')
}
