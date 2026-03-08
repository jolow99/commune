'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { SandpackProvider, SandpackLayout, SandpackPreview } from '@codesandbox/sandpack-react'
import type { Proposal } from '@/lib/types'

interface PreviewModalProps {
  proposal: Proposal
  currentSpec?: string
  onClose: () => void
}

function toSandpackFiles(files: Record<string, string>) {
  const result: Record<string, string> = {}
  for (const [path, content] of Object.entries(files)) {
    // Strip src/ prefix so Sandpack resolves imports consistently from /App.tsx
    const normalized = path.replace(/^\/?(src\/)/, '')
    const key = normalized.startsWith('/') ? normalized : `/${normalized}`
    result[key] = content
  }
  if (!result['/App.tsx']) {
    result['/App.tsx'] = 'export default function App() { return <div>Loading...</div> }'
  }
  return result
}

function computeLineDiff(oldText: string, newText: string) {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  // Simple LCS-based diff
  const m = oldLines.length
  const n = newLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to build diff
  const diff: { type: 'same' | 'added' | 'removed'; text: string }[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diff.unshift({ type: 'same', text: oldLines[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: 'added', text: newLines[j - 1] })
      j--
    } else {
      diff.unshift({ type: 'removed', text: oldLines[i - 1] })
      i--
    }
  }

  return diff
}

function SpecDiff({ currentSpec, proposalSpec }: { currentSpec: string; proposalSpec: string }) {
  const diff = computeLineDiff(currentSpec, proposalSpec)

  return (
    <div className="p-4 overflow-auto h-full font-mono text-sm">
      {diff.map((line, i) => (
        <div
          key={i}
          className={
            line.type === 'added'
              ? 'bg-green-900/40 text-green-300'
              : line.type === 'removed'
              ? 'bg-red-900/40 text-red-300'
              : 'text-slate-400'
          }
        >
          <span className="select-none inline-block w-6 text-right mr-2 text-slate-600">
            {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
          </span>
          {line.text || '\u00A0'}
        </div>
      ))}
    </div>
  )
}

export default function PreviewModal({ proposal, currentSpec, onClose }: PreviewModalProps) {
  const hasSpec = !!proposal.spec && !!currentSpec
  const [activeTab, setActiveTab] = useState<'spec' | 'preview'>(hasSpec ? 'spec' : 'preview')
  const sandpackFiles = toSandpackFiles(proposal.files)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-indigo-400 italic mb-1">&ldquo;{proposal.userPrompt}&rdquo;</p>
              <h3 className="text-white font-medium">{proposal.description}</h3>
              <p className="text-xs text-slate-400">by {proposal.author.slice(0, 8)}</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xl px-2"
            >
              &times;
            </button>
          </div>
          {hasSpec && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setActiveTab('spec')}
                className={`text-xs px-3 py-1 rounded-md transition-colors ${
                  activeTab === 'spec'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Spec Changes
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`text-xs px-3 py-1 rounded-md transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Preview
              </button>
            </div>
          )}
          <p className="text-xs text-amber-500/70 mt-2">This preview is approximate. The final result may differ if other proposals merge first.</p>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {activeTab === 'spec' && hasSpec ? (
            <SpecDiff currentSpec={currentSpec!} proposalSpec={proposal.spec!} />
          ) : (
            <SandpackProvider
              key={`preview-${proposal.id}`}
              template="react-ts"
              files={sandpackFiles}
              customSetup={{
                dependencies: {
                  'framer-motion': '10.16.4',
                },
              }}
              options={{
                externalResources: ['https://cdn.tailwindcss.com'],
              }}
            >
              <SandpackLayout style={{ height: '100%', border: 'none', borderRadius: 0 }}>
                <SandpackPreview
                  style={{ height: '100%', border: 'none' }}
                  showNavigator={false}
                  showRefreshButton={false}
                  showOpenInCodeSandbox={false}
                />
              </SandpackLayout>
            </SandpackProvider>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
