// LiAIson plans (owner decisions 2026-10-08/09). One place for every plan
// limit and text, used by the server and the UI.
// - Messages are always pay-per-use for the SENDER (AI cost + 30%), on every plan.
// - Fees are a monthly platform fee, charged at month end with usage.
// - The plan is chosen at sign-up; the free month gives that plan's features.
// Not built yet (shown as "coming soon"): circles, Discover AI search, similarity.

export type PlanId = 'introvert' | 'ambivert' | 'extrovert'

export const PLAN_IDS: PlanId[] = ['introvert', 'ambivert', 'extrovert']

export type EchoLevel = 'none' | 'monthly' | 'weekly_monthly'

export type Plan = {
  id: PlanId
  name: string
  feeEur: number
  tagline: string
  vaultChars: number
  echoes: EchoLevel
  aiSearchesPerMonth: number
  similarity: 'none' | 'score' | 'score_overlap'
  circles: number
}

export const PLANS: Record<PlanId, Plan> = {
  introvert: {
    id: 'introvert',
    name: 'Introvert',
    feeEur: 0,
    tagline: 'A simple LiAIson that speaks for you.',
    vaultChars: 3000,
    echoes: 'none',
    aiSearchesPerMonth: 0,
    similarity: 'none',
    circles: 1,
  },
  ambivert: {
    id: 'ambivert',
    name: 'Ambivert',
    feeEur: 2,
    tagline: 'More room to share, and a monthly look at what people ask.',
    vaultChars: 15000,
    echoes: 'monthly',
    aiSearchesPerMonth: 10,
    similarity: 'score',
    circles: 2,
  },
  extrovert: {
    id: 'extrovert',
    name: 'Extrovert',
    feeEur: 4,
    tagline: 'Everything, with weekly insights and the biggest Vault.',
    vaultChars: 30000,
    echoes: 'weekly_monthly',
    aiSearchesPerMonth: 20,
    similarity: 'score_overlap',
    circles: 3,
  },
}

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && (PLAN_IDS as string[]).includes(value)
}

export function planRank(id: PlanId): number {
  return PLAN_IDS.indexOf(id)
}

export function formatChars(n: number): string {
  return n.toLocaleString('en-GB')
}

export const ECHO_LABEL: Record<EchoLevel, string> = {
  none: '—',
  monthly: 'Monthly',
  weekly_monthly: 'Weekly + monthly',
}

// "Learn more" texts for each feature (plans page and upgrade prompts).
export const FEATURE_HELP: { key: string; title: string; text: string; comingSoon?: boolean }[] = [
  {
    key: 'messages',
    title: 'Messages',
    text: 'You pay only for the messages you send: the actual AI cost of each answer plus 30%. A typical message costs about 0.5–2 cents. Nobody pays for others talking to your LiAIson. You control it with your monthly spending limit.',
  },
  {
    key: 'vault',
    title: 'Vault size',
    text: 'Your Vault is what your LiAIson knows about you. A bigger Vault lets your LiAIson answer more questions in more detail. 3,000 characters is about one page of text.',
  },
  {
    key: 'echoes',
    title: 'Echoes',
    text: 'Echoes are short reports of what visitors wanted to know about you (never their words or who they are), so you can see what interests people and improve your Vault.',
  },
  {
    key: 'search',
    title: 'Discover AI search',
    text: 'Search people by what they share, e.g. "climbers in Vienna who work in design". Only content people chose to make discoverable is searched.',
    comingSoon: true,
  },
  {
    key: 'similarity',
    title: 'Similarity',
    text: 'See how much you have in common with someone, and what you share, based only on what both of you made visible.',
    comingSoon: true,
  },
  {
    key: 'circles',
    title: 'Circles',
    text: 'Circles decide who sees what: e.g. an Outer Circle for anyone, an Inner Circle for people you connect with, and a Middle Circle in between.',
    comingSoon: true,
  },
]
