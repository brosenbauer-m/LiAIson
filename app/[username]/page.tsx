import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { resolveCircles } from '@/lib/access/resolveScope'
import ProfileChatSection from './ProfileChatSection'
import PrivateProfileCard from './PrivateProfileCard'
import ContactLinks from '@/components/profile/ContactLinks'
import type { User } from '@/types'
import ProfileHeader from '@/components/profile/ProfileHeader'
import { isOwnAvatarUrl } from '@/components/ui/Avatar'
import SimilarityCard from '@/components/similarity/SimilarityCard'
import { getPlanLimits } from '@/lib/billing/plan'

interface Props {
  params: Promise<{ username: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const supabase = createServiceClient()
  const { data: user } = await supabase
    .from('users')
    .select('display_name, short_bio, avatar_url')
    .eq('username', params.username)
    .single<Pick<User, 'display_name' | 'short_bio' | 'avatar_url'>>()

  if (!user) return { title: 'Profile Not Found' }

  return {
    title: `${user.display_name}'s LiAIson`,
    description: user.short_bio ?? `Talk to ${user.display_name}'s AI representative`,
    openGraph: {
      title: `${user.display_name}'s LiAIson`,
      description: user.short_bio ?? `Talk to ${user.display_name}'s AI representative`,
      images: isOwnAvatarUrl(user.avatar_url) ? [user.avatar_url] : [],
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${user.display_name}'s LiAIson`,
      description: user.short_bio ?? `Talk to ${user.display_name}'s AI representative`,
      images: isOwnAvatarUrl(user.avatar_url) ? [user.avatar_url] : [],
    },
  }
}

export default async function ProfilePage(props: Props) {
  const params = await props.params;
  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url, short_bio, contact_links, plan')
    .eq('username', params.username)
    .single<Pick<User, 'id' | 'username' | 'display_name' | 'avatar_url' | 'short_bio' | 'contact_links'> & { plan: string | null }>()

  if (!user) notFound()

  // Who is looking? Access = owner's public level combined with any accepted connection.
  const visitorSupabase = await createClient()
  const { data: { user: visitor } } = await visitorSupabase.auth.getUser()
  const circles = await resolveCircles(user.id, { visitorUserId: visitor?.id })
  const scope = circles !== null

  // Similarity: score + map on Extrovert; on other plans the chat sometimes
  // points to it (ProfileChatSection). Never for the owner's own profile.
  const otherVisitor = !!visitor && visitor.id !== user.id && scope
  const visitorLimits = otherVisitor ? await getPlanLimits(visitor!.id) : null
  const canCompare = visitorLimits?.similarity === 'score_visual'
  // Social Butterfly: compare with several people at once (/compare).
  const canGroup = (visitorLimits?.groupCompare ?? 0) >= 2

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left column: Profile info */}
          <div className="lg:col-span-2 space-y-5">
            {/* Picture, name and bio (owner decision 2026-10-11: no Vault boxes here) */}
            <ProfileHeader
              avatarUrl={user.avatar_url}
              displayName={user.display_name}
              shortBio={user.short_bio}
              plan={user.plan}
            >
              {scope && user.contact_links && user.contact_links.length > 0 && <ContactLinks links={user.contact_links} />}
            </ProfileHeader>

            {canCompare && (
              <SimilarityCard username={user.username} displayName={user.display_name} groupCompare={canGroup} />
            )}
          </div>

          {/* Right column: Chat interface */}
          <div className="lg:col-span-3">
            {scope ? (
              <ProfileChatSection
                ownerId={user.id}
                username={params.username}
                displayName={user.display_name}
                similarityNote={otherVisitor ? (canCompare ? 'map' : 'upgrade') : null}
              />
            ) : (
              <PrivateProfileCard
                ownerId={user.id}
                username={user.username}
                displayName={user.display_name}
                signedIn={!!visitor}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
