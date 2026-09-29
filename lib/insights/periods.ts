// Calendar periods in the owner's timezone (Europe/Vienna), so weeks run
// Monday–Sunday and months follow the calendar exactly.

export const INSIGHTS_TIMEZONE = 'Europe/Vienna'

type Parts = { year: number; month: number; day: number; weekday: number }

function viennaParts(date: Date): Parts {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: INSIGHTS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]))
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: weekdays.indexOf(parts.weekday), // 0 = Monday
  }
}

// Offset (ms) of Vienna local time vs UTC at a given instant.
function viennaOffsetMs(date: Date): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: INSIGHTS_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  })
  const p = Object.fromEntries(fmt.formatToParts(date).map(x => [x.type, x.value]))
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second))
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

// UTC instant of 00:00 Vienna time on the given Vienna calendar date.
export function viennaMidnight(year: number, month: number, day: number): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))
  const first = new Date(guess.getTime() - viennaOffsetMs(guess))
  // Re-check once in case the offset differs at the corrected instant (DST edges).
  return new Date(guess.getTime() - viennaOffsetMs(first))
}

export type Period = { type: 'week' | 'month'; start: Date; end: Date; label: string }

// The period that contains `now` (current week or current month so far).
export function currentPeriod(type: 'week' | 'month', now = new Date()): Period {
  const p = viennaParts(now)
  if (type === 'week') {
    const startDay = new Date(Date.UTC(p.year, p.month - 1, p.day - p.weekday))
    const start = viennaMidnight(startDay.getUTCFullYear(), startDay.getUTCMonth() + 1, startDay.getUTCDate())
    const endDay = new Date(Date.UTC(p.year, p.month - 1, p.day - p.weekday + 7))
    const end = viennaMidnight(endDay.getUTCFullYear(), endDay.getUTCMonth() + 1, endDay.getUTCDate())
    return { type, start, end, label: 'This week' }
  }
  const start = viennaMidnight(p.year, p.month, 1)
  const next = p.month === 12 ? { y: p.year + 1, m: 1 } : { y: p.year, m: p.month + 1 }
  const end = viennaMidnight(next.y, next.m, 1)
  return { type, start, end, label: 'This month' }
}

// The most recently COMPLETED period before `now` (last full week Mon–Sun,
// or last full calendar month). Used by the scheduled reports.
export function previousPeriod(type: 'week' | 'month', now = new Date()): Period {
  const current = currentPeriod(type, now)
  const justBefore = new Date(current.start.getTime() - 60 * 1000)
  const prev = currentPeriod(type, justBefore)
  return { ...prev, label: type === 'week' ? 'Last week' : 'Last month' }
}

export function viennaDateParts(now = new Date()): Parts {
  return viennaParts(now)
}
