'use client'

import { motion } from 'framer-motion'
import { fadeInUp } from '@/lib/animations'

interface ProfileHeaderProps {
  avatarUrl: string | null
  displayName: string
  shortBio: string | null
}

export default function ProfileHeader({ avatarUrl, displayName, shortBio }: ProfileHeaderProps) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="bg-card border border-border rounded-xl p-8 shadow-card text-center lg:text-left"
    >
      <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-28 h-28 rounded-full object-cover border-2 border-border shadow-soft"
          />
        ) : (
          <div className="w-28 h-28 rounded-full bg-accent-tint flex items-center justify-center text-5xl font-bold text-accent border-2 border-border shadow-soft">
            {displayName?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-3xl font-display font-medium tracking-tight text-text-primary mb-2">{displayName}</h1>
          {shortBio && (
            <p className="text-text-secondary text-base leading-relaxed">{shortBio}</p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
