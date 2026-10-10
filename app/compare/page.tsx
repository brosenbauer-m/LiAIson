import { redirect } from 'next/navigation'

// Old address of the Similarities page (renamed 2026-10-10).
export default async function OldComparePage(props: { searchParams: Promise<{ u?: string }> }) {
  const { u } = await props.searchParams
  redirect(u ? `/similarities?u=${encodeURIComponent(u)}` : '/similarities')
}
