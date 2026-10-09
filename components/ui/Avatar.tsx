// Profile picture, or the first letter of the name. Only pictures from our own
// storage bucket are shown: a stored link to another site could track
// visitors (their browser would load it on every profile view).

function originOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).origin : null
  } catch {
    return null
  }
}

const STORAGE_ORIGIN = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL)

export function isOwnAvatarUrl(url: string | null | undefined): url is string {
  if (!url || !STORAGE_ORIGIN) return false
  try {
    const parsed = new URL(url)
    return parsed.origin === STORAGE_ORIGIN && parsed.pathname.startsWith('/storage/v1/object/public/avatars/')
  } catch {
    return false
  }
}

const SIZES = {
  sm: 'w-10 h-10 text-base',
  md: 'w-12 h-12 text-lg',
  lg: 'w-24 h-24 text-4xl',
  xl: 'w-28 h-28 text-5xl',
} as const

export default function Avatar({
  url,
  name,
  size = 'sm',
  className = '',
}: {
  url: string | null | undefined
  name: string | null | undefined
  size?: keyof typeof SIZES
  className?: string
}) {
  const base = `${SIZES[size]} flex-shrink-0 rounded-full overflow-hidden ${className}`
  if (isOwnAvatarUrl(url)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`${base} object-cover border border-border`} />
  }
  return (
    <span aria-hidden="true" className={`${base} inline-flex items-center justify-center bg-accent-subtle text-accent font-display`}>
      {name?.trim()?.[0]?.toUpperCase() ?? '?'}
    </span>
  )
}
