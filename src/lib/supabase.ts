import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Create a real client or a no-op proxy if credentials are missing
function createSupabaseClient(): SupabaseClient {
  if (supabaseUrl && supabaseKey) {
    return createClient(supabaseUrl, supabaseKey)
  }

  // Return a no-op client that doesn't crash - stores proposals in memory
  console.warn('Supabase credentials not configured. Using in-memory storage.')
  return createClient('https://placeholder.supabase.co', 'placeholder-key')
}

export const supabase = createSupabaseClient()

// In-memory fallback store for when Supabase is not configured
const memoryStore: Map<string, Record<string, unknown>> = new Map()

export async function saveProposal(data: Record<string, unknown>) {
  if (supabaseUrl && supabaseKey) {
    return supabase.from('proposals').insert(data)
  }
  memoryStore.set(data.id as string, data)
  return { error: null }
}

export async function getProposal(id: string) {
  if (supabaseUrl && supabaseKey) {
    return supabase.from('proposals').select('*').eq('id', id).single()
  }
  const data = memoryStore.get(id) || null
  return { data, error: data ? null : { message: 'Not found' } }
}

export async function updateProposalStatus(id: string, status: string) {
  if (supabaseUrl && supabaseKey) {
    return supabase.from('proposals').update({ status }).eq('id', id)
  }
  const item = memoryStore.get(id)
  if (item) item.status = status
  return { error: null }
}

export async function getApprovedProposals() {
  if (supabaseUrl && supabaseKey) {
    return supabase.from('proposals').select('*').eq('status', 'approved').order('timestamp', { ascending: true })
  }
  const data = Array.from(memoryStore.values()).filter(p => p.status === 'approved')
  return { data, error: null }
}
