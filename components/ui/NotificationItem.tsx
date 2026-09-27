'use client'

import type { Notification } from '@/types'

interface NotificationItemProps {
  notification: Notification
  onDismiss: (id: string) => void
  onAction?: (notification: Notification) => void
  actionLabel?: string
}

const typeIcons: Record<string, string> = {
  gap_detection: '💡',
  query_surfacing: '🔍',
  temporal_refresh: '🕐',
  connection_match: '🤝',
  connection_interest: '✨',
}

export default function NotificationItem({ notification, onDismiss, onAction, actionLabel = 'Take action →' }: NotificationItemProps) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-card border border-border">
      <span className="text-xl flex-shrink-0">{typeIcons[notification.type] || '📢'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary">{notification.message}</p>
        <p className="text-xs text-text-secondary mt-1">
          {new Date(notification.created_at).toLocaleDateString()}
        </p>
        {onAction && (
          <button
            onClick={() => onAction(notification)}
            className="mt-2 text-xs text-accent-light hover:text-accent transition-colors"
          >
            {actionLabel}
          </button>
        )}
      </div>
      <button
        onClick={() => onDismiss(notification.id)}
        className="text-text-secondary hover:text-error transition-colors flex-shrink-0"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
