// Scaleway Transactional Email (EU, Paris region) — server-side only.
// Docs: https://www.scaleway.com/en/developers/api/transactional-email/

const SCW_TEM_ENDPOINT =
  'https://api.scaleway.com/transactional-email/v1alpha1/regions/fr-par/emails'

export interface SendEmailInput {
  from: { email: string; name?: string }
  to: string
  subject: string
  html: string
  text: string
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SCW_SECRET_KEY && process.env.SCW_PROJECT_ID)
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const secretKey = process.env.SCW_SECRET_KEY
  const projectId = process.env.SCW_PROJECT_ID
  if (!secretKey || !projectId) {
    throw new Error('Scaleway email is not configured (SCW_SECRET_KEY / SCW_PROJECT_ID missing)')
  }

  const res = await fetch(SCW_TEM_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': secretKey,
    },
    body: JSON.stringify({
      from: input.from,
      to: [{ email: input.to }],
      subject: input.subject,
      html: input.html,
      text: input.text,
      project_id: projectId,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Scaleway email send failed (${res.status}): ${body.slice(0, 300)}`)
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
