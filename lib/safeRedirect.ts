// Only same-site paths are allowed as "where to go next" after signing in
// (no other websites, no protocol-relative //host or /\host tricks).
export function safeNextPath(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  return value
}
