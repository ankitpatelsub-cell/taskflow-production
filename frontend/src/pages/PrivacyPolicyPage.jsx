export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-10">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-slate-500 text-sm mb-8">Last updated: June 2026</p>

        <Section title="1. What we collect">
          <p>We collect information you provide directly: your name, email address, and any content you create in TaskFlow (projects, tasks, comments). We also collect standard server logs (IP address, browser type, pages visited) for security and performance.</p>
        </Section>

        <Section title="2. How we use your data">
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>To provide and improve the TaskFlow service</li>
            <li>To send transactional emails (invitations, password resets, notifications)</li>
            <li>To process payments via Stripe (we never see your card number)</li>
            <li>To comply with legal obligations</li>
          </ul>
        </Section>

        <Section title="3. Data sharing">
          <p>We do not sell your data. We share data only with sub-processors required to run the service (PostgreSQL hosting, Stripe for payments, email delivery provider). All sub-processors are bound by Data Processing Agreements.</p>
        </Section>

        <Section title="4. Data retention">
          <p>We retain your data for as long as your account is active. You may delete your account at any time from Settings → Account → Delete Account. Deletion is permanent and removes all personal data within 30 days.</p>
        </Section>

        <Section title="5. Your rights (GDPR / CCPA)">
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>Access</strong> — download all your data from Settings → Export Data</li>
            <li><strong>Correction</strong> — update your profile at any time</li>
            <li><strong>Deletion</strong> — delete your account from Settings</li>
            <li><strong>Portability</strong> — export your data as JSON</li>
            <li><strong>Opt-out</strong> — unsubscribe from marketing emails at any time</li>
          </ul>
          <p className="mt-3">To exercise any right, email <strong>privacy@taskflow.app</strong>.</p>
        </Section>

        <Section title="6. Cookies">
          <p>We use one essential session cookie (HttpOnly, Secure) for authentication. We do not use advertising or tracking cookies.</p>
        </Section>

        <Section title="7. Security">
          <p>All data is encrypted in transit (TLS 1.3) and at rest. Passwords are hashed with bcrypt. We conduct regular backups and vulnerability assessments.</p>
        </Section>

        <Section title="8. Contact">
          <p>Questions? Email <strong>privacy@taskflow.app</strong></p>
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
