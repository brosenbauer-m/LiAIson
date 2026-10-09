// LiAIson plans (owner decisions 2026-10-08/09). One place for every plan
// limit and text, used by the server and the UI.
// - Messages are always pay-per-use for the SENDER, on every plan (price = AI cost +
//   markup, see lib/usage/spend.ts; the markup is not shown in the UI).
// - Fees are a monthly platform fee, charged at month end with usage.
// - The plan is chosen at sign-up; the free month gives that plan's features.
// Circles: Introvert 1; Ambivert and Extrovert have Inner + Outer. Custom extra
// circles belong to the future Social Butterfly plan.

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
  similarity: 'none' | 'score' | 'score_visual'
  circles: 1 | 2
  // What the plan includes, in plain sentences. `help` points to the matching
  // "Learn more" text in FEATURE_HELP.
  features: { text: string; help: string }[]
}

export const PLANS: Record<PlanId, Plan> = {
  introvert: {
    id: 'introvert',
    name: 'Introvert',
    feeEur: 0,
    tagline: 'A simple LiAIson that answers questions about you.',
    vaultChars: 3000,
    echoes: 'none',
    aiSearchesPerMonth: 0,
    similarity: 'none',
    circles: 1,
    features: [
      { text: 'Your Vault can hold up to 3,000 characters.', help: 'vault' },
      { text: 'Everyone who visits your profile sees the same information.', help: 'circles' },
      { text: 'You can find people on LiAIson by their name.', help: 'search' },
      { text: 'You pay only for the messages you send.', help: 'messages' },
    ],
  },
  ambivert: {
    id: 'ambivert',
    name: 'Ambivert',
    feeEur: 2,
    tagline: 'More room to share, and a monthly report of what people ask about you.',
    vaultChars: 15000,
    echoes: 'monthly',
    aiSearchesPerMonth: 10,
    similarity: 'score',
    circles: 2,
    features: [
      { text: 'Your Vault can hold up to 15,000 characters.', help: 'vault' },
      { text: 'You get an Echo every month.', help: 'echoes' },
      { text: 'You can share some things with everyone and other things only with people you choose.', help: 'circles' },
      { text: 'You can find people by what they share, up to 10 times a month.', help: 'search' },
      { text: 'You can see how much you have in common with someone.', help: 'similarity' },
      { text: 'You pay only for the messages you send.', help: 'messages' },
    ],
  },
  extrovert: {
    id: 'extrovert',
    name: 'Extrovert',
    feeEur: 4,
    tagline: 'Everything LiAIson offers, with weekly reports and the biggest Vault.',
    vaultChars: 30000,
    echoes: 'weekly_monthly',
    aiSearchesPerMonth: 20,
    similarity: 'score_visual',
    circles: 2,
    features: [
      { text: 'Your Vault can hold up to 30,000 characters.', help: 'vault' },
      { text: 'You get an Echo every week and every month.', help: 'echoes' },
      { text: 'You can share some things with everyone and other things only with people you choose.', help: 'circles' },
      { text: 'You can find people by what they share, up to 20 times a month.', help: 'search' },
      { text: 'You can see how much you have in common with someone, shown as a visual map of your shared interests.', help: 'similarity' },
      { text: 'You pay only for the messages you send.', help: 'messages' },
    ],
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
    text: 'Similarity shows how much you have in common with another person. With Extrovert you also see a visual map of the interests you share.',
  },
  {
    key: 'circles',
    title: 'Circles',
    text: 'Circles decide who can see what in your Vault. Your Outer Circle is for everyone who visits your profile. Your Inner Circle is only for people you choose, such as friends or close colleagues. With Introvert there is one circle, so everyone sees the same information.',
  },
]
