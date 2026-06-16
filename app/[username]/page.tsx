import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import ProfileChatSection from './ProfileChatSection'
import ContactLinks from '@/components/profile/ContactLinks'
import TagChip from '@/components/ui/TagChip'
import Link from 'next/link'
import type { User, VaultSection } from '@/types'
import ProfileHeader from '@/components/profile/ProfileHeader'

interface Props {
  params: { username: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
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

export default async function ProfilePage({ params }: Props) {
  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('username', params.username)
    .single<User>()

  if (!user) notFound()

  const { data: sections } = await supabase
    .from('vault_sections')
    .select('*')
    .eq('user_id', user.id)
    .eq('visibility', 'public')
    .order('domain', { ascending: true })

  const publicSections = (sections as VaultSection[] | null) ?? []

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
      {/* Header */}
      <nav className="border-b border-border bg-surface shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl text-accent">LiAIson</Link>
          <Link
            href="/signup"
            className="px-5 py-2 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg transition-all shadow-soft hover:shadow-card"
          >
            Create yours →
          </Link>
        </div>
      </nav>

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

            {/* Contact links */}
            {user.contact_links && user.contact_links.length > 0 && (
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
            <ProfileChatSection
              username={params.username}
              displayName={user.display_name}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
