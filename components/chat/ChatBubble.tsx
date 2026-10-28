interface ChatBubbleProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  // Small buttons under the bubble (e.g. Read Aloud on LiAIson answers).
  actions?: React.ReactNode
}

export default function ChatBubble({ role, content, isStreaming, actions }: ChatBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3 animate-message-in`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center mr-2 flex-shrink-0 mt-1">
          <span className="text-white text-xs font-display">L</span>
        </div>
      )}
      <div className={`max-w-[80%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-accent text-white rounded-br-none'
            : 'bg-card border border-border text-text-primary rounded-bl-none'
        }`}
      >
        {content}
        {isStreaming && (
          <span className="inline-block ml-1 animate-pulse">▋</span>
        )}
      </div>
      {actions && <div className="mt-1 -ml-1">{actions}</div>}
      </div>
    </div>
  )
}
