import { getPayment, MollieError } from '@/lib/billing/mollie'
import { handleCardSetupPayment } from '@/lib/billing/account'
import { handleTopUpPayment } from '@/lib/billing/topup'

// Entry point for the Mollie webhook. Never trusts the request body: the
// payment is always fetched from Mollie with our own API key, then handled
// according to what LiAIson created it for (metadata.purpose).
export async function handleMolliePayment(paymentId: string): Promise<void> {
  let payment
  try {
    payment = await getPayment(paymentId)
  } catch (err) {
    if (err instanceof MollieError && err.status === 404) return // not one of ours
    throw err
  }

  switch (payment.metadata?.purpose) {
    case 'card_setup':
      await handleCardSetupPayment(payment)
      return
    case 'topup':
      await handleTopUpPayment(payment)
      return
    default:
      return
  }
}
