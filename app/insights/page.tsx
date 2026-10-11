import { redirect } from 'next/navigation'

// Old address of the Echoes page (renamed 2026-10-11).
export default function OldInsightsPage() {
  redirect('/echoes')
}
