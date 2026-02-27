'use client'

import { SandpackProvider, SandpackLayout, SandpackPreview } from '@codesandbox/sandpack-react'

interface LivePageProps {
  files: Record<string, string>
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

export default function LivePage({ files }: LivePageProps) {
  const sandpackFiles = toSandpackFiles(files)

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
      <SandpackProvider
        key="live-page"
        template="react-ts"
        files={sandpackFiles}
        customSetup={{
          dependencies: {
            'framer-motion': '10.16.4',
          },
        }}
        options={{
          externalResources: [
            'https://cdn.tailwindcss.com',
          ],
        }}
      >
        <SandpackLayout style={{ height: '100%', border: 'none', borderRadius: 0 }}>
          <SandpackPreview
            style={{ height: '100%', border: 'none' }}
            showNavigator={false}
            showRefreshButton={false}
            showOpenInCodeSandbox={true}
          />
        </SandpackLayout>
      </SandpackProvider>
      </div>
    </div>
  )
}
