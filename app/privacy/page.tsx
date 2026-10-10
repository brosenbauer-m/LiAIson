import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="font-bold text-xl text-accent-light block mb-10">
          ← LiAIson
        </Link>

        <h1 className="text-4xl font-display font-medium tracking-tight text-text-primary mb-2">Privacy Policy</h1>
        <p className="text-text-secondary mb-10">Last updated: September 2026</p>

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
              <li>Your profile photo, if you upload one (stored in cloud storage). Files you import into your Vault (PDF, Word) are only read to extract their text and are not stored</li>
              <li>Anonymous visitor interest statements — e.g. &quot;People want to know more about your climbing&quot; — never the visitor&apos;s words or identity, deleted after about 35 days</li>
              <li>AI usage counts — how much AI processing the messages you send use (feature, AI model and number of tokens), never message content and never which LiAIson you chatted with. We use this for your spending limit and, in future, to bill you for what you send. Others chatting with your LiAIson are never counted against you</li>
              <li>A search index for Discover, only if your profile is Public and Discoverable — the text of your Outer Circle sections split into short passages, each with a numeric fingerprint made by Mistral AI (EU) so people can find you by what you share. Inner Circle sections and drafts are never indexed. The index is updated when you change your Vault and removed when you turn off Discoverable, make your profile Private, or delete your account. People who search see your name, photo and a one-sentence reason written by the AI, never your Vault text</li>
              <li>Billing details, if you save a card — the country you live in (and the country of your card and of your connection, as required for VAT), a label like &quot;Visa •••• 4242&quot; and your payment records. Your card number is handled only by Mollie and never reaches LiAIson. Receipts are kept for 7 years as required by tax law, even after you delete your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">How we use your data</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To power your LiAIson — vault content is fed into your AI agent&apos;s system prompt</li>
              <li>To surface useful notifications about your profile (gaps, visitor queries, stale content)</li>
              <li>To match you with relevant connections when both parties express interest</li>
              <li>To email you your weekly and monthly Echo (what visitors wanted to know) — you can switch this off in Settings</li>
              <li>We never sell your data to third parties</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">Visitor interactions</h2>
            <p>When someone chats with your LiAIson, their messages are sent to Mistral AI, a French AI provider, and processed only in its data centres in the EU and EFTA countries (Mistral&apos;s EU regional service), to generate responses. We do not store visitor messages. For each question we keep only a short anonymous statement of what was asked about (e.g. &quot;People want to know more about your climbing&quot;) with a category, so owners can see what visitors are interested in. These statements never contain the visitor&apos;s words, identity or contact details and are deleted after about 35 days. Visitor IPs are used solely for rate limiting (15 messages per profile per day) and are not stored long-term.</p>
            <p>If you are signed in and chat with someone else&apos;s LiAIson, the non-draft content of your own Vault is also sent to Mistral AI with your message, so answers can relate to you (for example &quot;what do we have in common?&quot;). It is used only to answer you, is never shown to the other person and is not stored.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">Your controls</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Each Vault section is in your Outer Circle (everyone who can see your profile), your Inner Circle (only people you put there, from Ambivert up), one of your own circles (Social Butterfly) or kept as a draft that no one sees. Your Profile Bio is always in your Outer Circle</li>
              <li>You choose who can talk to your LiAIson: Public (everyone) or Private (only people whose connection request you accepted), and who is in your Inner Circle</li>
              <li>You can turn Discoverable on or off at any time. When it is off, or your profile is Private, no one can find you by what you share</li>
              <li>You can set a monthly spending limit for the messages you send; when it is reached, you can&apos;t send more until the next month or until you raise it</li>
              <li>Files you import (PDF or Word) are only read to extract their text and are not stored; only the text you review and approve is saved to your Vault</li>
              <li>You can delete your account and all associated data at any time from Settings</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">Where your data is stored</h2>
            <p>LiAIson is built with European privacy in mind. Your account, vault and profile data are stored in the EU (Ireland), our application servers run in Frankfurt, Germany, and all AI responses are generated by Mistral AI in its EU/EFTA data centres. Your vault content is never used to train AI models.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">Third-party services</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Supabase – database and authentication (EU, Ireland)</li>
              <li>Vercel – application hosting (servers in Frankfurt, Germany)</li>
              <li>Mistral AI – AI responses (EU/EFTA data centres, regional EU service)</li>
              <li>Mollie – payments and saved cards (Netherlands, EU)</li>
              <li>Upstash – rate limiting (Frankfurt, Germany)</li>
              <li>Scaleway – email notifications (EU-based, hosted in Paris, France)</li>
            </ul>
            <p>Each service has its own privacy policy.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">Your rights under the GDPR</h2>
            <p>If you are in the EU or EEA, you have the right to access, correct, export or delete your personal data, to restrict or object to its processing, and to withdraw consent at any time. You can delete your account and all vault data yourself in Settings. For any other request, email us and we will respond within 30 days. You also have the right to lodge a complaint with your local data protection authority (in Austria: the Datenschutzbehörde, dsb.gv.at).</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">Contact</h2>
            <p>Questions? Email us at contact@my-liaison.app</p>
          </section>
        </div>
      </div>
    </div>
  )
}
