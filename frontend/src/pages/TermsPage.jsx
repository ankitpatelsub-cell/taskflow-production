export function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-10">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms of Service</h1>
        <p className="text-slate-500 text-sm mb-8">Last updated: June 2026</p>

        <Section title="1. Acceptance">
          <p>By using TaskFlow you agree to these Terms. If you do not agree, do not use the service.</p>
        </Section>

        <Section title="2. Description of service">
          <p>TaskFlow is a project management platform. We provide Free, Pro, and Team subscription plans. Features vary by plan as described on the Billing page.</p>
        </Section>

        <Section title="3. Account responsibilities">
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>You are responsible for maintaining the security of your account credentials.</li>
            <li>You must be at least 16 years old to use TaskFlow.</li>
            <li>You may not use TaskFlow for illegal activities or to harm others.</li>
            <li>One person may not share a single account across multiple users.</li>
          </ul>
        </Section>

        <Section title="4. Payments and refunds">
          <p>Paid plans are billed monthly or annually. Payments are processed by Stripe. Subscriptions renew automatically until cancelled. You may cancel at any time from the Billing Portal — access continues until the end of the billing period. We do not offer refunds for partial periods.</p>
        </Section>

        <Section title="5. Your content">
          <p>You own all content you create in TaskFlow. You grant us a limited license to store and display it solely to provide the service. We will not share, sell, or use your content for training AI models.</p>
        </Section>

        <Section title="6. Availability and SLA">
          <p>We aim for 99.5% monthly uptime. We do not guarantee uninterrupted service. Scheduled maintenance will be announced in advance where possible.</p>
        </Section>

        <Section title="7. Termination">
          <p>You may delete your account at any time. We may suspend accounts that violate these Terms. Upon termination, your data is deleted within 30 days.</p>
        </Section>

        <Section title="8. Limitation of liability">
          <p>TaskFlow is provided "as is". To the extent permitted by law, our liability is limited to the amount you paid in the 3 months preceding the claim.</p>
        </Section>

        <Section title="9. Changes to terms">
          <p>We may update these Terms with 30 days notice by email. Continued use after the effective date constitutes acceptance.</p>
        </Section>

        <Section title="10. Contact">
          <p>Legal questions: <strong>legal@taskflow.app</strong></p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-slate-800 mb-3">{title}</h2>
      <div className="text-slate-600 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}
