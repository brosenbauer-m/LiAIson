import type { ContactLink } from '@/types'

interface ContactLinksProps {
  links: ContactLink[]
}

const platformIcons: Record<string, string> = {
  instagram: '📷',
  linkedin: '💼',
  whatsapp: '💬',
  twitter: '🐦',
  x: '𝕏',
  github: '🐙',
  email: '✉️',
  website: '🌐',
  other: '🔗',
}

function detectPlatform(url: string): string {
  const lower = url.toLowerCase()
  if (lower.includes('instagram.com')) return 'instagram'
  if (lower.includes('linkedin.com')) return 'linkedin'
  if (lower.includes('wa.me') || lower.includes('whatsapp')) return 'whatsapp'
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'x'
  if (lower.includes('github.com')) return 'github'
  if (lower.startsWith('mailto:') || lower.includes('@')) return 'email'
  return 'other'
}

// Only web links (http/https, or a bare address like linkedin.com/in/anna) and
// email addresses become links; anything else
// stored in contact_links is skipped.
function safeHref(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (/^https?:\/\//i.test(value)) {
    try {
      return new URL(value).toString()
    } catch {
      return null
    }
  }
  const email = value.replace(/^mailto:/i, '')
  if (/^[^\s@/:]+@[^\s@/:]+\.[^\s@/:]+$/.test(email)) return `mailto:${email}`
  // A bare address like "linkedin.com/in/anna" → https.
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(value)) return `https://${value}`
  return null
}

export default function ContactLinks({ links }: ContactLinksProps) {
  if (!links || links.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link, i) => {
        const href = safeHref(link?.url)
        if (!href) return null
        const platform = typeof link.platform === 'string' ? link.platform : ''
        const platformKey = detectPlatform(href)
        const icon = platformIcons[platform.toLowerCase()] ?? platformIcons[platformKey] ?? '🔗'

        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-card border border-border hover:border-accent/50 transition-colors text-lg"
            title={platform || undefined}
            aria-label={platform || 'Contact link'}
          >
            {icon}
          </a>
        )
      })}
    </div>
  )
}
