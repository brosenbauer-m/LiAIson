import Link from 'next/link'
import TagChip from './TagChip'
import type { User } from '@/types'

interface ProfileCardProps {
  user: User
  tags?: string[]
}

export default function ProfileCard({ user, tags = [] }: ProfileCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 hover:border-accent/40 transition-colors">
      <div className="flex items-center gap-3">
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.display_name}
            className="w-12 h-12 rounded-full object-cover border-2 border-border"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-accent-subtle flex items-center justify-center text-accent-light font-bold text-lg">
            {user.display_name?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
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
