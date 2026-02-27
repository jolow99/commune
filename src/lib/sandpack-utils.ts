/**
 * Transform files for Sandpack preview:
 * - Strip framer-motion imports and replace motion.X with plain HTML elements
 * - Remove motion-specific props (initial, animate, whileHover, etc.)
 * - Map src/App.tsx to /App.tsx for the react-ts template
 */
export function prepareSandpackFiles(files: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {}

  for (const [path, content] of Object.entries(files)) {
    const key = path.startsWith('/') ? path : `/${path}`
    result[key] = stripFramerMotion(content)
  }

  if (result['/src/App.tsx'] && !result['/App.tsx']) {
    result['/App.tsx'] = result['/src/App.tsx']
  }

  if (!result['/App.tsx'] && !result['/src/App.tsx']) {
    result['/App.tsx'] = 'export default function App() { return <div>Loading...</div> }'
  }

  return result
}

const MOTION_PROPS = new Set([
  'initial', 'animate', 'exit', 'transition', 'variants',
  'whileHover', 'whileTap', 'whileInView', 'whileFocus', 'whileDrag',
  'drag', 'dragConstraints', 'dragElastic', 'dragMomentum',
  'layout', 'layoutId', 'onAnimationStart', 'onAnimationComplete',
])

function stripFramerMotion(code: string): string {
  // Remove import lines for framer-motion
  let result = code.replace(/^import\s+.*from\s+['"]framer-motion['"].*$/gm, '')

  // Replace <motion.tag with <tag and </motion.tag with </tag
  result = result.replace(/<motion\.(\w+)/g, '<$1')
  result = result.replace(/<\/motion\.(\w+)/g, '</$1')

  // Remove motion-specific props by counting braces properly
  // Process character by character to handle nested objects
  result = removeMotionProps(result)

  return result
}

function removeMotionProps(code: string): string {
  const output: string[] = []
  let i = 0

  while (i < code.length) {
    // Check if we're at a motion prop: whitespace + propName + ={
    let matched = false
    if (/\s/.test(code[i])) {
      // Look ahead for a prop name followed by ={
      const rest = code.slice(i)
      const propMatch = rest.match(/^(\s+)(\w+)=\{/)
      if (propMatch && MOTION_PROPS.has(propMatch[2])) {
        // Skip the whitespace and prop name and ={
        const start = i + propMatch[0].length
        // Now count braces to find the matching }
        let depth = 1
        let j = start
        while (j < code.length && depth > 0) {
          if (code[j] === '{') depth++
          else if (code[j] === '}') depth--
          if (depth > 0) j++
        }
        // j is now at the closing }, skip past it
        i = j + 1
        matched = true
      }
    }

    if (!matched) {
      output.push(code[i])
      i++
    }
  }

  return output.join('')
}
