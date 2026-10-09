import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { resolveCircles, visibleSectionsFilter } from '@/lib/access/resolveScope'
import ProfileChatSection from './ProfileChatSection'
import PrivateProfileCard from './PrivateProfileCard'
import ContactLinks from '@/components/profile/ContactLinks'
import TagChip from '@/components/ui/TagChip'
import type { User, VaultSection } from '@/types'
import ProfileHeader from '@/components/profile/ProfileHeader'
import SimilarityCard from '@/components/similarity/SimilarityCard'
import { getPlanAt } from '@/lib/billing/plan'
import { PLANS } from '@/lib/plans'

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
      images: user.avatar_url ? [user.avatar_url] : [],
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${user.display_name}'s LiAIson`,
      description: user.short_bio ?? `Talk to ${user.display_name}'s AI representative`,
      images: user.avatar_url ? [user.avatar_url] : [],
    },
  }
}

export default async function ProfilePage(props: Props) {
  const params = await props.params;
  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url, short_bio, contact_links')
    .eq('username', params.username)
    .single<Pick<User, 'id' | 'username' | 'display_name' | 'avatar_url' | 'short_bio' | 'contact_links'>>()

  if (!user) notFound()

  // Who is looking? Access = owner's public level combined with any accepted connection.
  const visitorSupabase = await createClient()
  const { data: { user: visitor } } = await visitorSupabase.auth.getUser()
  const circles = await resolveCircles(user.id, { visitorUserId: visitor?.id })
  const scope = circles !== null

  // Similarity: score + map on Extrovert; on other plans the chat sometimes
  // points to it (ProfileChatSection). Never for the owner's own profile.
  const otherVisitor = !!visitor && visitor.id !== user.id && scope
  const canCompare = otherVisitor && PLANS[await getPlanAt(visitor!.id)].similarity === 'score_visual'

  // Only load vault sections the visitor is allowed to see (their circles).
  let publicSections: VaultSection[] = []
  if (circles) {
    const { data: sections } = await supabase
      .from('vault_sections')
      .select('*')
      .eq('user_id', user.id)
      .or(visibleSectionsFilter(circles))
      .order('domain', { ascending: true })
    publicSections = (sections as VaultSection[] | null) ?? []
  }

  // Get skills and interests for tags display
  const skillsSection = publicSections.find(s => s.section_type === 'skills')
  const hobbiesSection = publicSections.find(s => s.section_type === 'hobbies')

  const skillTags = skillsSection?.content
    ? skillsSection.content.split(',').map(s => s.trim()).filter(Boolean).slice(0, 6)
    : []

  const hobbyTags = hobbiesSection?.content
    ? hobbiesSection.content.split(',').map(s => s.trim()).filter(Boolean).slice(0, 4)
    : []

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left column: Profile info */}
          <div className="lg:col-span-2 space-y-5">
            {/* Avatar + Name - with animation */}
            <ProfileHeader
              avatarUrl={user.avatar_url}
              displayName={user.display_name}
              shortBio={user.short_bio}
            />

            {canCompare && (
              <SimilarityCard username={user.username} displayName={user.display_name} />
            )}

            {/* Contact links */}
            {scope && user.contact_links && user.contact_links.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-6 shadow-soft">
                <p className="text-xs text-text-secondary font-semibold uppercase tracking-wide mb-3">Connect</p>
                <ContactLinks links={user.contact_links} />
              </div>
            )}

            {/* Skills */}
            {skillTags.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-6 shadow-soft">
                <p className="text-xs text-text-secondary font-semibold uppercase tracking-wide mb-3">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {skillTags.map(tag => (
                    <TagChip key={tag} label={tag} variant="accent" />
                  ))}
                </div>
              </div>
            )}

            {/* Interests */}
            {hobbyTags.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-6 shadow-soft">
                <p className="text-xs text-text-secondary font-semibold uppercase tracking-wide mb-3">Interests</p>
                <div className="flex flex-wrap gap-2">
                  {hobbyTags.map(tag => (
                    <TagChip key={tag} label={tag} />
                  ))}
                </div>
              </div>
            )}

            {/* Public section summaries */}
            {publicSections
              .filter(s => !['skills', 'hobbies'].includes(s.section_type) && s.content?.trim())
              .slice(0, 3)
              .map(section => (
                <div key={section.id} className="bg-card border border-border rounded-xl p-6 shadow-soft">
                  <p className="text-xs text-text-secondary font-semibold uppercase tracking-wide mb-2">{section.label}</p>
                  <p className="text-sm text-text-primary leading-relaxed line-clamp-4">{section.content}</p>
                </div>
              ))}
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
