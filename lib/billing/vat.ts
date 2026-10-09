// VAT for consumer sales of electronic services in the EU (owner decisions 2026-10-09):
// - Prices are cost + 30%, and VAT is added ON TOP, shown to the user as one final price.
// - While the owner is a small business (Kleinunternehmer), no VAT is charged.
//   BILLING_VAT_ENABLED stays unset/false until the accountant says otherwise.
// - Once enabled, the rate of the customer's billing country applies (EU OSS rules).
//
// Standard rates as known in 2026. CHECK THESE WITH THE ACCOUNTANT BEFORE ENABLING VAT.

export const EU_VAT_RATES: Record<string, number> = {
  AT: 20, BE: 21, BG: 20, HR: 25, CY: 19, CZ: 21, DK: 25, EE: 24, FI: 25.5,
  FR: 20, DE: 19, GR: 24, HU: 27, IE: 23, IT: 22, LV: 21, LT: 21, LU: 17,
  MT: 18, NL: 21, PL: 23, PT: 23, RO: 21, SK: 23, SI: 22, ES: 21, SE: 25,
}

export function isVatEnabled(): boolean {
  return process.env.BILLING_VAT_ENABLED === 'true'
}

export type VatBreakdown = {
  netEur: number
  vatRate: number
  vatEur: number
  totalEur: number
  vatExempt: boolean
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// netEur = what LiAIson charges for the service; VAT is added on top.
export function vatBreakdown(netEur: number, country: string | null): VatBreakdown {
  if (!isVatEnabled() || !country || EU_VAT_RATES[country] === undefined) {
    const total = round2(netEur)
    return { netEur: total, vatRate: 0, vatEur: 0, totalEur: total, vatExempt: true }
  }
  const rate = EU_VAT_RATES[country]
  const vat = round2((netEur * rate) / 100)
  return { netEur: round2(netEur), vatRate: rate, vatEur: vat, totalEur: round2(netEur + vat), vatExempt: false }
}

export function formatEur(n: number): string {
  return n.toFixed(2)
}
