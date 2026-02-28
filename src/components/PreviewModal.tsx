'use client'

import { motion } from 'framer-motion'
import { SandpackProvider, SandpackLayout, SandpackPreview } from '@codesandbox/sandpack-react'
import type { Proposal } from '@/lib/types'

interface PreviewModalProps {
  proposal: Proposal
  onClose: () => void
}

function toSandpackFiles(files: Record<string, string>) {
  const result: Record<string, string> = {}
  for (const [path, content] of Object.entries(files)) {
    const key = path.startsWith('/') ? path : `/${path}`
    result[key] = content
  }
  if (result['/src/App.tsx'] && !result['/App.tsx']) {
    result['/App.tsx'] = result['/src/App.tsx']
  }
  if (!result['/App.tsx']) {
    result['/App.tsx'] = 'export default function App() { return <div>Loading...</div> }'
  }
  return result
}

export default function PreviewModal({ proposal, onClose }: PreviewModalProps) {
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
          <p className="text-xs text-amber-500/70 mt-2">This preview is approximate. The final result may differ if other proposals merge first.</p>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
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
        </div>
      </motion.div>
    </motion.div>
  )
}
