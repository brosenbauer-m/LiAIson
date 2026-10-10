// LiAIson plans (owner decisions 2026-10-08/09). One place for every plan
// limit and text, used by the server and the UI.
// - Messages are always pay-per-use for the SENDER, on every plan (price = AI cost +
//   markup, see lib/usage/spend.ts; the markup is not shown in the UI).
// - Fees are a monthly platform fee, charged at month end with usage.
// - The plan is chosen at sign-up; the free month gives that plan's features.
// Circles: Introvert 1; Ambivert and Extrovert have Inner + Outer; Social
// Butterfly adds its own named circles.
// Similarity: on every plan the LiAIson points out what the reader has in
// common with the person in chat. Score + bubble map on Extrovert and Social
// Butterfly; Social Butterfly also compares several people at once.
// Social Butterfly: the fee follows sliders (Vault size, own circles, AI
// searches, Similarity comparisons); see BUTTERFLY_SLIDERS. A plan with
// `available: false` is shown as "Coming soon" and can't be chosen.

export type PlanId = 'introvert' | 'ambivert' | 'extrovert' | 'butterfly'

export const PLAN_IDS: PlanId[] = ['introvert', 'ambivert', 'extrovert', 'butterfly']

export type EchoLevel = 'none' | 'monthly' | 'weekly_monthly'

export type Plan = {
  id: PlanId
  name: string
  feeEur: number
  tagline: string
  vaultChars: number
  echoes: EchoLevel
  aiSearchesPerMonth: number
  similarity: 'none' | 'score_visual'
  similaritiesPerMonth: number
  circles: 1 | 2
  // Own named circles on top of Inner + Outer (Social Butterfly: slider).
  extraCircles: number
  // How many other people can be compared at once (Similarity).
  groupCompare: number
  // false: shown as "Coming soon" and can't be chosen.
  available: boolean
  // What the plan includes, in plain sentences. `help` points to the matching
  // "Learn more" text in FEATURE_HELP; `highlight` shows it in bold.
  features: { text: string; help: string; highlight?: boolean }[]
}

export const PLANS: Record<PlanId, Plan> = {
  introvert: {
    id: 'introvert',
    name: 'Introvert',
    feeEur: 0,
    tagline: 'A simple LiAIson that answers questions about you.',
    vaultChars: 1000,
    echoes: 'none',
    aiSearchesPerMonth: 0,
    similarity: 'none',
    similaritiesPerMonth: 0,
    circles: 1,
    extraCircles: 0,
    groupCompare: 0,
    available: true,
    features: [
      { text: 'Your Vault can hold up to 1,000 characters.', help: 'vault' },
      { text: 'Everyone who visits your profile sees the same information.', help: 'circles' },
      { text: 'You can find people on LiAIson by their name.', help: 'search' },
      { text: 'When you chat, the LiAIson tells you what you have in common.', help: 'similarity' },
      { text: 'You pay only for the messages you send.', help: 'messages' },
    ],
  },
  ambivert: {
    id: 'ambivert',
    name: 'Ambivert',
    feeEur: 3,
    tagline: 'More room to share, and a monthly report of what people ask about you.',
    vaultChars: 15000,
    echoes: 'monthly',
    aiSearchesPerMonth: 10,
    similarity: 'none',
    similaritiesPerMonth: 0,
    circles: 2,
    extraCircles: 0,
    groupCompare: 0,
    available: true,
    features: [
      { text: 'Your Vault can hold up to 15,000 characters.', help: 'vault' },
      { text: 'You get an Echo every month.', help: 'echoes' },
      { text: 'You can share some things with everyone and other things only with people you choose.', help: 'circles' },
      { text: 'You can find people by what they share, up to 10 times a month.', help: 'search' },
      { text: 'When you chat, the LiAIson tells you what you have in common.', help: 'similarity' },
      { text: 'You pay only for the messages you send.', help: 'messages' },
    ],
  },
  extrovert: {
    id: 'extrovert',
    name: 'Extrovert',
    feeEur: 6,
    tagline: 'See how much you have in common with someone, plus weekly reports and the biggest Vault.',
    vaultChars: 30000,
    echoes: 'weekly_monthly',
    aiSearchesPerMonth: 20,
    similarity: 'score_visual',
    similaritiesPerMonth: 100,
    circles: 2,
    extraCircles: 0,
    groupCompare: 1,
    available: true,
    features: [
      { text: 'See how much you have in common with someone, with a map of your shared interests.', help: 'similarity', highlight: true },
      { text: 'Your Vault can hold up to 30,000 characters.', help: 'vault' },
      { text: 'You get an Echo every week and every month.', help: 'echoes' },
      { text: 'You can share some things with everyone and other things only with people you choose.', help: 'circles' },
      { text: 'You can find people by what they share, up to 20 times a month.', help: 'search' },
      { text: 'You pay only for the messages you send.', help: 'messages' },
    ],
  },
  butterfly: {
    id: 'butterfly',
    name: 'Social Butterfly',
    feeEur: 9,
    tagline: 'Your own circles, compare several people at once, and choose how much you need.',
    vaultChars: 30000,
    echoes: 'weekly_monthly',
    aiSearchesPerMonth: 20,
    similarity: 'score_visual',
    similaritiesPerMonth: 100,
    circles: 2,
    extraCircles: 2,
    groupCompare: 4,
    available: true,
    features: [
      { text: 'Make your own circles, such as Family or Climbing club, and choose what each one sees.', help: 'circles', highlight: true },
      { text: 'Compare yourself with up to 4 people at once on one map.', help: 'similarity', highlight: true },
      { text: 'Choose your Vault size (30,000 to 60,000 characters), circles, searches and comparisons. The price follows.', help: 'butterfly' },
      { text: 'Everything in Extrovert, including weekly and monthly Echoes.', help: 'echoes' },
      { text: 'You pay only for the messages you send.', help: 'messages' },
    ],
  },
}

// Social Butterfly sliders (Claude's proposal 2026-10-09, owner to confirm).
// Price = base fee + eurPerStep for every step above the minimum. The
// minimums are what the base fee includes. The Vault slider stops at 60,000
// characters: a bigger Vault makes every message to it cost more for the sender.
// Keep vaultChars in sync with normalize_plan_options in the database.
export type PlanOptions = { vaultChars: number; extraCircles: number; aiSearches: number; similarities: number }
export type SliderKey = keyof PlanOptions

export const BUTTERFLY_SLIDERS: Record<SliderKey, { label: string; min: number; max: number; step: number; eurPerStep: number }> = {
  vaultChars: { label: 'Vault size (characters)', min: 30000, max: 60000, step: 10000, eurPerStep: 1 },
  extraCircles: { label: 'Your own circles', min: 2, max: 10, step: 1, eurPerStep: 0.5 },
  aiSearches: { label: 'AI searches per month', min: 20, max: 100, step: 20, eurPerStep: 1 },
  similarities: { label: 'Similarity comparisons per month', min: 100, max: 500, step: 100, eurPerStep: 1 },
}

export const SLIDER_KEYS: SliderKey[] = ['vaultChars', 'extraCircles', 'aiSearches', 'similarities']

export const DEFAULT_PLAN_OPTIONS: PlanOptions = { vaultChars: 30000, extraCircles: 2, aiSearches: 20, similarities: 100 }
export const MAX_PLAN_OPTIONS: PlanOptions = { vaultChars: 60000, extraCircles: 10, aiSearches: 100, similarities: 500 }

// Any input → valid slider positions (clamped, on a step).
export function normalizePlanOptions(raw: unknown, fallback: PlanOptions = DEFAULT_PLAN_OPTIONS): PlanOptions {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out = { ...fallback }
  for (const key of SLIDER_KEYS) {
    const s = BUTTERFLY_SLIDERS[key]
    const n = Number(source[key] ?? fallback[key])
    if (!Number.isFinite(n)) continue
    const stepped = s.min + Math.round((n - s.min) / s.step) * s.step
    out[key] = Math.min(s.max, Math.max(s.min, stepped))
  }
  return out
}

export function samePlanOptions(a: PlanOptions | null, b: PlanOptions | null): boolean {
  if (!a || !b) return a === b
  return SLIDER_KEYS.every(k => a[k] === b[k])
}

export function butterflyFeeEur(options: PlanOptions): number {
  let fee = PLANS.butterfly.feeEur
  for (const key of SLIDER_KEYS) {
    const s = BUTTERFLY_SLIDERS[key]
    fee += ((options[key] - s.min) / s.step) * s.eurPerStep
  }
  return Math.round(fee * 100) / 100
}

// A plan's limits and fee, with the slider choices for Social Butterfly.
export type PlanLimits = Omit<Plan, 'features' | 'tagline'> & { options: PlanOptions | null }

export function planLimits(plan: PlanId, rawOptions?: unknown): PlanLimits {
  const p = PLANS[plan]
  const base = {
    id: p.id, name: p.name, feeEur: p.feeEur, vaultChars: p.vaultChars, echoes: p.echoes,
    aiSearchesPerMonth: p.aiSearchesPerMonth, similarity: p.similarity, similaritiesPerMonth: p.similaritiesPerMonth,
    circles: p.circles, extraCircles: p.extraCircles, groupCompare: p.groupCompare, available: p.available,
  }
  if (plan !== 'butterfly') return { ...base, options: null }
  const options = normalizePlanOptions(rawOptions)
  return {
    ...base,
    feeEur: butterflyFeeEur(options),
    vaultChars: options.vaultChars,
    extraCircles: options.extraCircles,
    aiSearchesPerMonth: options.aiSearches,
    similaritiesPerMonth: options.similarities,
    options,
  }
}

export function formatEur(n: number): string {
  return Number.isInteger(n) ? `€${n}` : `€${n.toFixed(2)}`
}

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && (PLAN_IDS as string[]).includes(value)
}

export function planRank(id: PlanId): number {
  return PLAN_IDS.indexOf(id)
}

// Echoes by plan: Introvert none, Ambivert monthly, Extrovert and Social Butterfly weekly + monthly.
export function echoAllowed(plan: PlanId, period: 'week' | 'month'): boolean {
  const level = PLANS[plan].echoes
  if (level === 'none') return false
  return period === 'month' || level === 'weekly_monthly'
}

export function formatChars(n: number): string {
  return n.toLocaleString('en-GB')
}

// "Learn more" texts (plans page and upgrade prompts). Written for people who
// have never used LiAIson: simple, full sentences, no pricing formulas.
export const FEATURE_HELP: { key: string; title: string; text: string }[] = [
  {
    key: 'liaison',
    title: 'What is a LiAIson?',
    text: 'A LiAIson is your personal AI. It answers questions about you when people visit your profile, using only what you have written in your Vault. It never makes things up from other sources.',
  },
  {
    key: 'messages',
    title: 'What do messages cost?',
    text: 'When you send a message to someone’s LiAIson, you pay a small amount for the answer, usually between half a cent and two cents. You never pay when other people talk to your LiAIson. You can set a monthly spending limit, so you never pay more than you want to.',
  },
  {
    key: 'vault',
    title: 'Vault',
    text: 'Your Vault is where you write what your LiAIson should know about you, for example your work, your hobbies or what you are looking for. A bigger Vault lets your LiAIson answer more questions in more detail.',
  },
  {
    key: 'echoes',
    title: 'Echoes',
    text: 'An Echo is a short report about what people asked your LiAIson. It never shows who asked or their exact words. It helps you understand what people want to know about you, so you can improve your Vault.',
  },
  {
    key: 'search',
    title: 'Discover',
    text: 'Discover helps you find people on LiAIson. On every plan you can search by name. With Ambivert or Extrovert you can also search by what people share, for example people who climb and live in Vienna. Only information that people chose to make findable is searched.',
  },
  {
    key: 'similarity',
    title: 'Similarity',
    text: 'When you chat with someone’s LiAIson, it tells you when you have something in common, for example the same hobby or city. It uses only what you both chose to share, and nothing from your drafts. With Extrovert you can also see how much you have in common with someone, from “Little in common” to “Very much in common”, and a map of the interests you share and the ones that are only yours or only theirs. You can compare yourself with up to 100 people a month. With Social Butterfly you can compare yourself with up to 4 people at once on one map. The other person is not told.',
  },
  {
    key: 'circles',
    title: 'Circles',
    text: 'Circles decide who can see what in your Vault. Your Outer Circle is for everyone who visits your profile. Your Inner Circle is only for people you choose, such as friends or close colleagues. With Introvert there is one circle, so everyone sees the same information. With Social Butterfly you can also make your own circles, such as Family or Climbing club, and put each part of your Vault in the circle that should see it.',
  },
  {
    key: 'butterfly',
    title: 'Social Butterfly',
    text: 'Social Butterfly lets you choose how much you need. Move the sliders to pick your Vault size and how many of your own circles, AI searches and Similarity comparisons you want each month, and the monthly price changes with them. You can change them at any time: more takes effect right away, less from the start of next month.',
  },
]
