'use client'

import { motion } from 'framer-motion'
import { fadeInUp } from '@/lib/animations'
import Avatar from '@/components/ui/Avatar'
import TierMark from '@/components/ui/TierMark'

interface ProfileHeaderProps {
  avatarUrl: string | null
  displayName: string
  shortBio: string | null
  plan?: string | null
  children?: React.ReactNode
  className?: string
  // Shown at the bottom of the card (the interest map).
  footer?: React.ReactNode
}

export default function ProfileHeader({ avatarUrl, displayName, shortBio, plan, children, className = '', footer }: ProfileHeaderProps) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className={`bg-card border border-border rounded-2xl p-8 shadow-card text-center flex flex-col ${className}`}
    >
      <div className="flex flex-col items-center gap-5">
        <Avatar url={avatarUrl} name={displayName} size="xl" className="shadow-soft" />
        <div className="w-full">
          <h1 className="text-3xl font-display font-medium tracking-tight text-text-primary mb-2">{displayName} <TierMark plan={plan} className="ml-1 scale-125" /></h1>
          {shortBio && (
            <p className="text-text-secondary text-base leading-relaxed whitespace-pre-line">{shortBio}</p>
          )}
          {children && <div className="mt-4">{children}</div>}
        </div>
      </div>
      {footer && <div className="mt-auto pt-8 w-full">{footer}</div>}
    </motion.div>
  )
}
