import { createClient } from '@/lib/supabase/server'
import { getSearchQuota } from '@/lib/search/search'
import DiscoverClient, { type SearchQuota } from './DiscoverClient'

export const dynamic = 'force-dynamic'

// Discover: the search allowance is looked up here on the server, so the page
// (incl. the By Name / By Description switch) arrives in one go.
export default async function DiscoverPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let quota: SearchQuota | null = null
  if (user) quota = await getSearchQuota(user.id).catch(() => null)
  return <DiscoverClient initialQuota={quota} />
}
