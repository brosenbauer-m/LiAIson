import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="font-bold text-xl text-accent-light block mb-10">
          ← LiAIson
        </Link>

        <h1 className="text-4xl font-bold text-text-primary mb-2">Privacy Policy</h1>
        <p className="text-text-secondary mb-10">Last updated: January 2025</p>

        <div className="space-y-8 text-text-secondary leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">What is LiAIson?</h2>
            <p>LiAIson is a personal AI agent platform that lets you create an AI representative — your LiAIson — which speaks on your behalf to anyone who visits your public profile. This policy explains how we handle your data, in plain English.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">What data we collect</h2>
            <p className="mb-3">We collect:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Your email address and password (for authentication)</li>
              <li>Your display name, username, and profile information</li>
              <li>Content you add to your Vault (professional and personal information)</li>
              <li>Files you upload (PDFs, Word documents), stored in encrypted cloud storage</li>
              <li>Anonymous conversation logs — we record topic clusters of visitor questions (e.g. &quot;professional background&quot;), never the raw text</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">How we use your data</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To power your LiAIson — vault content is fed into your AI agent&apos;s system prompt</li>
              <li>To surface useful notifications about your profile (gaps, visitor queries, stale content)</li>
              <li>To match you with relevant connections when both parties express interest</li>
              <li>To send you a weekly email digest when you have new notifications</li>
              <li>We never sell your data to third parties</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">Visitor interactions</h2>
            <p>When someone chats with your LiAIson, their messages are sent to Anthropic&apos;s API to generate responses. We do not store raw visitor messages — only anonymised topic clusters (e.g. &quot;career goals&quot;). Visitor IPs are used solely for rate limiting (15 messages per profile per day) and are not stored long-term.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">Your controls</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Each vault section can be set to Public, Discoverable Only, or Private</li>
              <li>You can toggle discoverability on/off at any time</li>
              <li>You can delete your account and all associated data at any time from Settings</li>
              <li>File uploads can be deleted; extracted text is removed from your vault</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">Third-party services</h2>
            <p>We use: Supabase (database and authentication), Anthropic (AI responses), Upstash Redis (rate limiting), Postmark (email notifications), and Vercel (hosting). Each service has its own privacy policy.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">Contact</h2>
            <p>Questions? Email us at privacy@my-liaison.app</p>
          </section>
        </div>
      </div>
    </div>
  )
}
