import Link from 'next/link'
import TagChip from './TagChip'
import type { User } from '@/types'
import Avatar from './Avatar'

interface ProfileCardProps {
  user: Pick<User, 'username' | 'display_name' | 'avatar_url' | 'short_bio'>
  tags?: string[]
}

export default function ProfileCard({ user, tags = [] }: ProfileCardProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 hover:border-accent/40 hover:shadow-card">
      <div className="flex items-center gap-3">
        <Avatar url={user.avatar_url} name={user.display_name} size="md" />
        <div>
          <h3 className="font-semibold text-text-primary">{user.display_name}</h3>
          <p className="text-xs text-text-secondary">@{user.username}</p>
        </div>
      </div>
      {user.short_bio && (
        <p className="text-sm text-text-secondary line-clamp-2">{user.short_bio}</p>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 3).map(tag => (
            <TagChip key={tag} label={tag} />
          ))}
        </div>
      )}
      <Link
        href={`/${user.username}`}
        className="mt-1 w-full text-center py-2 rounded-lg bg-accent hover:bg-accent/90 text-white text-sm font-medium transition-colors"
      >
        View LiAIson
      </Link>
    </div>
  )
}
