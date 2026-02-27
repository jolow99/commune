import git from 'isomorphic-git'
import * as fs from 'node:fs'
import * as path from 'node:path'

const dir = path.join(process.cwd(), '.commune-repo')
const author = { name: 'Commune', email: 'commune@localhost' }

const DEFAULT_APP_TSX = `import { motion } from 'framer-motion'

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
}`

let initialized = false

async function ensureInit() {
  if (initialized) return
  try {
    await git.resolveRef({ fs, dir, ref: 'HEAD' })
    initialized = true
    return
  } catch {
    // Need to initialize
  }

  fs.mkdirSync(dir, { recursive: true })
  await git.init({ fs, dir, defaultBranch: 'main' })

  const srcDir = path.join(dir, 'src')
  fs.mkdirSync(srcDir, { recursive: true })
  fs.writeFileSync(path.join(srcDir, 'App.tsx'), DEFAULT_APP_TSX, 'utf8')
  await git.add({ fs, dir, filepath: 'src/App.tsx' })
  await git.commit({ fs, dir, message: 'Initial commit', author })
  initialized = true
}

export async function readFiles(): Promise<Record<string, string>> {
  await ensureInit()
  const files: Record<string, string> = {}

  function walk(dirPath: string) {
    const entries = fs.readdirSync(dirPath)
    for (const entry of entries) {
      if (entry === '.git') continue
      const fullPath = path.join(dirPath, entry)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        walk(fullPath)
      } else {
        const content = fs.readFileSync(fullPath, 'utf8')
        const relativePath = path.relative(dir, fullPath)
        files[relativePath] = content
      }
    }
  }

  try {
    await git.checkout({ fs, dir, ref: 'main' })
  } catch { /* already on main */ }
  walk(dir)
  return files
}

export async function createProposalBranch(
  id: string,
  files: Record<string, string>,
  message: string
): Promise<void> {
  await ensureInit()
  await git.checkout({ fs, dir, ref: 'main' })
  const branch = `proposal/${id}`
  await git.branch({ fs, dir, ref: branch })
  await git.checkout({ fs, dir, ref: branch })

  for (const [filepath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, filepath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content, 'utf8')
    await git.add({ fs, dir, filepath })
  }

  await git.commit({ fs, dir, message, author })
  await git.checkout({ fs, dir, ref: 'main' })
}

export async function mergeBranch(branch: string): Promise<Record<string, string>> {
  await ensureInit()
  await git.checkout({ fs, dir, ref: branch })
  const branchFiles: Record<string, string> = {}

  function walk(dirPath: string) {
    const entries = fs.readdirSync(dirPath)
    for (const entry of entries) {
      if (entry === '.git') continue
      const fullPath = path.join(dirPath, entry)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        walk(fullPath)
      } else {
        const content = fs.readFileSync(fullPath, 'utf8')
        const relativePath = path.relative(dir, fullPath)
        branchFiles[relativePath] = content
      }
    }
  }
  walk(dir)

  await git.checkout({ fs, dir, ref: 'main' })
  for (const [filepath, content] of Object.entries(branchFiles)) {
    const fullPath = path.join(dir, filepath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content, 'utf8')
    await git.add({ fs, dir, filepath })
  }
  await git.commit({ fs, dir, message: `Merge ${branch}`, author })

  return branchFiles
}

export async function revertToFiles(
  files: Record<string, string>,
  message: string
): Promise<void> {
  await ensureInit()
  await git.checkout({ fs, dir, ref: 'main' })

  for (const [filepath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, filepath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content, 'utf8')
    await git.add({ fs, dir, filepath })
  }
  await git.commit({ fs, dir, message, author })
}
