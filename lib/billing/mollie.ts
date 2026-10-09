// Minimal Mollie API client (EU payment provider, Netherlands).
// Uses MOLLIE_API_KEY (test_… in test mode, live_… once the business is live).
// Server-only: never import this from client components.

const MOLLIE_API = 'https://api.mollie.com/v2'

export class MollieError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function mollie<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const key = process.env.MOLLIE_API_KEY
  if (!key) throw new MollieError(500, 'MOLLIE_API_KEY is not set')

  const res = await fetch(`${MOLLIE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })

  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = (data && typeof data.detail === 'string') ? data.detail : res.statusText
    throw new MollieError(res.status, detail)
  }
  return data as T
}

export type MollieCustomer = { id: string }

export type MolliePayment = {
  id: string
  status: 'open' | 'canceled' | 'pending' | 'authorized' | 'expired' | 'failed' | 'paid'
  customerId?: string
  mandateId?: string
  sequenceType?: string
  metadata?: Record<string, unknown> | null
  details?: { cardCountryCode?: string; cardLabel?: string; cardNumber?: string } | null
  _links?: { checkout?: { href: string } }
}

export type MollieMandate = {
  id: string
  status: 'valid' | 'pending' | 'invalid'
  method: string
  createdAt: string
  details?: { cardLabel?: string; cardNumber?: string; cardHolder?: string; cardExpiryDate?: string } | null
}

export function createCustomer(input: { name: string; email: string; userId: string }) {
  return mollie<MollieCustomer>('POST', '/customers', {
    name: input.name,
    email: input.email,
    metadata: { userId: input.userId },
  })
}

// €0 card check that creates a mandate (saved card) for later automatic charges.
export function createCardSetupPayment(input: {
  customerId: string
  userId: string
  redirectUrl: string
  webhookUrl: string
}) {
  return mollie<MolliePayment>('POST', '/payments', {
    amount: { currency: 'EUR', value: '0.00' },
    description: 'LiAIson – save your card (no charge)',
    sequenceType: 'first',
    method: 'creditcard',
    customerId: input.customerId,
    redirectUrl: input.redirectUrl,
    webhookUrl: input.webhookUrl,
    metadata: { userId: input.userId, purpose: 'card_setup' },
  })
}

// One-off payment (e.g. a prepaid top-up) on Mollie's checkout page.
export function createOneOffPayment(input: {
  customerId: string
  amountEur: string
  description: string
  redirectUrl: string
  webhookUrl: string
  metadata: Record<string, string>
}) {
  return mollie<MolliePayment>('POST', '/payments', {
    amount: { currency: 'EUR', value: input.amountEur },
    description: input.description,
    sequenceType: 'oneoff',
    customerId: input.customerId,
    redirectUrl: input.redirectUrl,
    webhookUrl: input.webhookUrl,
    metadata: input.metadata,
  })
}

// Payment with the customer's saved card (mandate), without a checkout page.
// Only started by the user themselves (e.g. "Pay €10 with Mastercard •••• 1129").
export function createSavedCardPayment(input: {
  customerId: string
  mandateId: string
  amountEur: string
  description: string
  webhookUrl: string
  metadata: Record<string, string>
}) {
  return mollie<MolliePayment>('POST', '/payments', {
    amount: { currency: 'EUR', value: input.amountEur },
    description: input.description,
    sequenceType: 'recurring',
    customerId: input.customerId,
    mandateId: input.mandateId,
    webhookUrl: input.webhookUrl,
    metadata: input.metadata,
  })
}

export function getPayment(paymentId: string) {
  return mollie<MolliePayment>('GET', `/payments/${encodeURIComponent(paymentId)}`)
}

export function getMandate(customerId: string, mandateId: string) {
  return mollie<MollieMandate>(
    'GET',
    `/customers/${encodeURIComponent(customerId)}/mandates/${encodeURIComponent(mandateId)}`
  )
}

export async function listMandates(customerId: string): Promise<MollieMandate[]> {
  const data = await mollie<{ _embedded?: { mandates?: MollieMandate[] } }>(
    'GET',
    `/customers/${encodeURIComponent(customerId)}/mandates?limit=50`
  )
  return data?._embedded?.mandates ?? []
}

export function revokeMandate(customerId: string, mandateId: string) {
  return mollie<void>(
    'DELETE',
    `/customers/${encodeURIComponent(customerId)}/mandates/${encodeURIComponent(mandateId)}`
  )
}

export function cardLabelFromMandate(m: MollieMandate): string | null {
  const brand = m.details?.cardLabel?.trim()
  const last4 = m.details?.cardNumber?.trim()
  if (!brand && !last4) return null
  return [brand || 'Card', last4 ? `•••• ${last4}` : ''].filter(Boolean).join(' ')
}
