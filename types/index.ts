export type VaultDomain = 'professional' | 'personal' | 'custom'
export type VaultSource = 'manual' | 'file_extracted' | 'chat_extracted'
export type DiscoverMode = 'all' | 'professional' | 'personal' | 'unlisted'
export type ConnectionStatus = 'pending' | 'owner_opened' | 'matched' | 'declined'
export type NotificationType = 'gap_detection' | 'query_surfacing' | 'temporal_refresh' | 'connection_match' | 'connection_interest'
export type ChatAccessScope = 'none' | 'professional' | 'personal' | 'both'

export interface ContactLink {
  platform: string
  url: string
}

export interface User {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  short_bio: string | null
  is_discoverable: boolean
  discover_mode: DiscoverMode
  public_scope: ChatAccessScope
  contact_links: ContactLink[]
  created_at: string
}

export interface VaultFolder {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface VaultSection {
  id: string
  user_id: string
  domain: VaultDomain
  is_professional: boolean
  is_personal: boolean
  section_type: string
  label: string
  content: string
  folder_id: string | null
  last_confirmed_at: string | null
  source: VaultSource
  updated_at: string
}

export interface UploadedFile {
  id: string
  user_id: string
  file_name: string
  file_url: string
  extracted_text: string
  extraction_confirmed: boolean
  created_at: string
}

export interface VisitorQueryLog {
  id: string
  profile_user_id: string
  topic_cluster: string
  count: number
  surfaced_to_owner: boolean
  created_at: string
}

export interface ConnectionInterest {
  id: string
  from_user_id: string
  to_user_id: string
  status: ConnectionStatus
  allowed_scope: ChatAccessScope
  compatibility_summary: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  message: string
  metadata: Record<string, unknown> | null
  read: boolean
  created_at: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
