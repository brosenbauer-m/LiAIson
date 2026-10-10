// Display currencies (owner decision 2026-10-10). Billing is always in euros;
// other currencies are only shown, at the European Central Bank's daily
// reference rate (lib/currency/rates.ts). Keep in sync with the check in
// migration 34.

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'JPY', 'CAD', 'AUD'] as const
export type Currency = (typeof CURRENCIES)[number]

export const CURRENCY_NAMES: Record<Currency, string> = {
  EUR: 'Euro', USD: 'US dollar', GBP: 'British pound', CHF: 'Swiss franc', SEK: 'Swedish krona', NOK: 'Norwegian krone',
  DKK: 'Danish krone', PLN: 'Polish złoty', CZK: 'Czech koruna', HUF: 'Hungarian forint', RON: 'Romanian leu',
  JPY: 'Japanese yen', CAD: 'Canadian dollar', AUD: 'Australian dollar',
}

export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (CURRENCIES as readonly string[]).includes(value)
}

// An amount in euros, shown in the chosen currency (rate = units per euro).
export function formatMoney(eur: number, currency: Currency = 'EUR', rate = 1): string {
  const whole = currency === 'JPY' || currency === 'HUF'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(eur * rate)
}
