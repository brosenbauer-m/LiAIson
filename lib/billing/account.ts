import { createServiceClient } from '@/lib/supabase/service'
import { createCustomer, getMandate, listMandates, revokeMandate, cardLabelFromMandate, type MolliePayment } from '@/lib/billing/mollie'
import { toCountryCode } from '@/lib/billing/countries'

// Billing account helpers (server-only). The billing_accounts table is
// server-only (RLS on, no policies), so everything goes through the service role.

export type BillingAccount = {
  user_id: string
  mollie_customer_id: string | null
  mandate_id: string | null
  mandate_status: 'none' | 'pending' | 'valid' | 'invalid'
  card_label: string | null
  billing_country: string | null
  card_country: string | null
  ip_country: string | null
  updated_at: string
}

const COLUMNS =
  'user_id, mollie_customer_id, mandate_id, mandate_status, card_label, billing_country, card_country, ip_country, updated_at'

export async function getBillingAccount(userId: string): Promise<BillingAccount | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('billing_accounts')
    .select(COLUMNS)
    .eq('user_id', userId)
    .maybeSingle<BillingAccount>()
  if (error) throw new Error(error.message)
  return data ?? null
}

export async function saveBillingAccount(userId: string, fields: Partial<Omit<BillingAccount, 'user_id' | 'updated_at'>>) {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('billing_accounts')
    .upsert({ user_id: userId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) throw new Error(error.message)
}

// Stores a new valid mandate and revokes the previously saved one (card replaced).
async function storeValidMandate(account: BillingAccount, mandateId: string, cardLabel: string | null, cardCountry: string | null) {
  const previous = account.mandate_id
  await saveBillingAccount(account.user_id, {
    mandate_id: mandateId,
    mandate_status: 'valid',
    card_label: cardLabel,
    ...(cardCountry ? { card_country: cardCountry } : {}),
  })
  if (previous && previous !== mandateId && account.mollie_customer_id) {
    await revokeMandate(account.mollie_customer_id, previous).catch(() => {/* already gone */})
  }
}

// Card check result, called from the Mollie webhook (lib/billing/payments.ts)
// with a payment fetched from Mollie with our own key. The payment must belong
// to the customer stored for that user.
export async function handleCardSetupPayment(payment: MolliePayment): Promise<void> {
  const meta = payment.metadata ?? {}
  if (meta.purpose !== 'card_setup' || typeof meta.userId !== 'string') return

  const account = await getBillingAccount(meta.userId)
  if (!account || !account.mollie_customer_id || account.mollie_customer_id !== payment.customerId) return

  if (payment.status === 'paid' && payment.mandateId) {
    const mandate = await getMandate(account.mollie_customer_id, payment.mandateId)
    if (mandate.status === 'valid') {
      await storeValidMandate(
        account,
        mandate.id,
        cardLabelFromMandate(mandate),
        toCountryCode(payment.details?.cardCountryCode)
      )
      return
    }
  }

  if (['failed', 'canceled', 'expired'].includes(payment.status) && account.mandate_status === 'pending') {
    await saveBillingAccount(account.user_id, { mandate_status: 'none' })
  }
}

// Returns the user's Mollie customer id, creating the Mollie customer if needed.
export async function ensureMollieCustomer(userId: string, email: string | null | undefined): Promise<string> {
  const account = await getBillingAccount(userId)
  if (account?.mollie_customer_id) return account.mollie_customer_id
  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', userId)
    .single<{ display_name: string }>()
  const customer = await createCustomer({ name: profile?.display_name ?? '', email: email ?? '', userId })
  await saveBillingAccount(userId, { mollie_customer_id: customer.id })
  return customer.id
}

// Used when the user comes back from Mollie: if the webhook hasn't arrived yet,
// look up the customer's mandates directly so Settings shows the right state.
export async function syncPendingAccount(account: BillingAccount): Promise<BillingAccount> {
  if (account.mandate_status !== 'pending' || !account.mollie_customer_id) return account
  const mandates = await listMandates(account.mollie_customer_id)
  const newestValid = mandates
    .filter(m => m.status === 'valid' && m.method === 'creditcard')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  if (newestValid && newestValid.id !== account.mandate_id) {
    await storeValidMandate(account, newestValid.id, cardLabelFromMandate(newestValid), null)
    return (await getBillingAccount(account.user_id)) ?? account
  }
  // Give up on a card check that was started more than 2 hours ago.
  const ageMs = Date.now() - new Date(account.updated_at).getTime()
  if (ageMs > 2 * 60 * 60 * 1000) {
    await saveBillingAccount(account.user_id, { mandate_status: account.mandate_id ? 'valid' : 'none' })
    return (await getBillingAccount(account.user_id)) ?? account
  }
  return account
}
