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
}

export default function ProfileHeader({ avatarUrl, displayName, shortBio, plan, children }: ProfileHeaderProps) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="bg-card border border-border rounded-2xl p-8 shadow-card text-center lg:text-left"
    >
      <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6">
        <Avatar url={avatarUrl} name={displayName} size="xl" className="shadow-soft" />
        <div className="flex-1">
          <h1 className="text-3xl font-display font-medium tracking-tight text-text-primary mb-2">{displayName} <TierMark plan={plan} className="ml-1 scale-125" /></h1>
          {shortBio && (
            <p className="text-text-secondary text-base leading-relaxed whitespace-pre-line">{shortBio}</p>
          )}
          {children && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </motion.div>
  )
}
