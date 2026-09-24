import { Mistral } from '@mistralai/mistralai'

export const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY!,
})

export const CHAT_MODEL = 'mistral-medium-latest'
export const FAST_MODEL = 'mistral-small-latest'