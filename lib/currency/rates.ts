import { getRedis } from '@/lib/redis'
import type { Currency } from '@/lib/currency'

// Euro exchange rates for showing amounts in other currencies: the European
// Central Bank's daily reference rates (published around 16:00 CET on working
// days), cached for 12 hours. No personal data is sent. If the rates can't be
// loaded, amounts are shown in euros.

const ECB_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'
const CACHE_KEY = 'fx:ecb:v1'
const CACHE_SECONDS = 12 * 60 * 60

async function loadRates(): Promise<Record<string, number> | null> {
  try {
    const cached = await getRedis().get<Record<string, number>>(CACHE_KEY)
    if (cached && typeof cached === 'object') return cached
  } catch { /* fall through */ }
  try {
    const res = await fetch(ECB_URL, { signal: AbortSignal.timeout(4000), next: { revalidate: CACHE_SECONDS } })
    if (!res.ok) return null
    const xml = await res.text()
    const rates: Record<string, number> = { EUR: 1 }
    for (const m of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) rates[m[1]] = Number(m[2])
    if (Object.keys(rates).length < 5) return null
    try { await getRedis().set(CACHE_KEY, rates, { ex: CACHE_SECONDS }) } catch { /* not cached */ }
    return rates
  } catch {
    return null
  }
}

// Units of `currency` per euro; falls back to euros (rate 1).
export async function eurRate(currency: Currency): Promise<{ currency: Currency; rate: number }> {
  if (currency === 'EUR') return { currency, rate: 1 }
  const rates = await loadRates()
  const rate = rates?.[currency]
  return typeof rate === 'number' && rate > 0 ? { currency, rate } : { currency: 'EUR', rate: 1 }
}
