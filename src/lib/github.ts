export async function syncToGitHub(opts: {
  files: Record<string, string>
  spec: string
  commitMessage: string
}): Promise<void> {
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO // e.g. "owner/repo"
  const branch = process.env.GITHUB_BRANCH || 'main'

  if (!token || !repo) {
    console.warn('GitHub sync skipped: GITHUB_TOKEN or GITHUB_REPO not set')
    return
  }

  const baseUrl = `https://api.github.com/repos/${repo}`

  async function githubFetch(path: string, method: string, body?: unknown) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`GitHub API ${method} ${path} failed (${res.status}): ${text}`)
    }
    return res.json()
  }

  try {
    // 1. Get current branch ref
    const ref = await githubFetch(`/git/ref/heads/${branch}`, 'GET')
    const parentCommitSha: string = ref.object.sha

    // 2. Create blobs for all files + SPEC.md
    const allFiles: Record<string, string> = { ...opts.files, 'SPEC.md': opts.spec }
    const blobEntries = await Promise.all(
      Object.entries(allFiles).map(async ([path, content]) => {
        const blob = await githubFetch('/git/blobs', 'POST', {
          content,
          encoding: 'utf-8',
        })
        return {
          path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.sha as string,
        }
      })
    )

    // 4. Create tree (no base_tree — exact snapshot of current state)
    const tree = await githubFetch('/git/trees', 'POST', {
      tree: blobEntries,
    })

    // 5. Create commit
    const commit = await githubFetch('/git/commits', 'POST', {
      message: opts.commitMessage,
      tree: tree.sha,
      parents: [parentCommitSha],
    })

    // 6. Update branch ref
    await githubFetch(`/git/refs/heads/${branch}`, 'PATCH', {
      sha: commit.sha,
    })

    console.log(`GitHub sync: committed ${commit.sha} to ${repo}@${branch}`)
  } catch (err) {
    console.error('GitHub sync error:', err)
  }
}
