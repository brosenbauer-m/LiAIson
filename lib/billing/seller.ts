// Seller details printed on every receipt (Austrian invoice rules).
// TODO(owner): fill in once the sole proprietorship (Einzelunternehmen) is registered:
// legal name, business address and — if registered for VAT — the UID number.
// While these are empty, receipts show "Business details will be added".

export const SELLER = {
  tradeName: 'LiAIson',
  legalName: '', // e.g. "Mathias Brosenbauer"
  address: '', // e.g. "Musterstraße 1, 1010 Wien, Austria"
  vatId: '', // UID, only once registered for VAT
  email: 'contact@my-liaison.app',
  website: 'www.my-liaison.app',
}

// Wording to confirm with the accountant before going live.
export const SMALL_BUSINESS_VAT_NOTE =
  'No VAT charged — small business exemption (Kleinunternehmerregelung, § 6 Abs. 1 Z 27 UStG).'

export function isTestMode(): boolean {
  return !process.env.MOLLIE_API_KEY?.startsWith('live_')
}
