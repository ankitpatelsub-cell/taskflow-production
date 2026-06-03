import { Link } from '@tanstack/react-router';
import { Kanban, Zap, Users, BarChart2, CheckCircle2, ArrowRight } from 'lucide-react';

const features = [
  { icon: Kanban,      title: 'Kanban Boards',       desc: 'Drag-and-drop tasks across todo, in progress, review, and done columns.' },
  { icon: Zap,         title: 'Real-time Updates',   desc: 'Every change appears instantly for everyone in the project — no refresh needed.' },
  { icon: Users,       title: 'Team Collaboration',  desc: "Invite teammates by email, assign tasks, and see who's working on what." },
  { icon: BarChart2,   title: 'Standup Reports',     desc: 'Auto-generated daily standups show what was done, what is next, and blockers.' },
];

const plans = [
  {
    name: 'Free',
    price: '$0',
    desc: 'Perfect for individuals and small teams.',
    features: ['Up to 3 projects', '5 team members', 'Kanban & list views', 'Email notifications'],
    cta: 'Get started free',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$9',
    desc: 'For growing teams that need more power.',
    features: ['Unlimited projects', '20 team members', 'File attachments', 'Priority support'],
    cta: 'Start Pro trial',
    highlight: true,
  },
  {
    name: 'Team',
    price: '$29',
    desc: 'For organisations that need full control.',
    features: ['Unlimited everything', 'SSO / Google OAuth', 'Audit logs & backups', 'Dedicated support'],
    cta: 'Contact us',
    highlight: false,
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white">

      {/* Nav */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-black text-lg tracking-tight text-indigo-600">TaskFlow</span>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-indigo-600 transition-colors">
              Sign in
            </Link>
            <Link
              to="/register"
              className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-20 pb-16 text-center">
        <span className="inline-block mb-4 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 text-xs font-semibold tracking-wide uppercase">
          Project Management
        </span>
        <h1 className="text-5xl font-black tracking-tight leading-tight max-w-3xl mx-auto">
          Ship faster.<br />
          <span className="text-indigo-600">Together.</span>
        </h1>
        <p className="mt-5 text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
          TaskFlow keeps your team aligned with real-time kanban boards, smart task tracking,
          and automated standups — all in one place.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30"
          >
            Start for free <ArrowRight size={17} />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:border-indigo-300 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-10">Everything your team needs</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-gray-100 dark:border-gray-800 p-6 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center mb-4">
                <Icon size={20} className="text-indigo-600" />
              </div>
              <h3 className="font-bold mb-1.5">{title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-2">Simple, transparent pricing</h2>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-10 text-sm">No hidden fees. Cancel anytime.</p>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map(({ name, price, desc, features: fs, cta, highlight }) => (
            <div
              key={name}
              className={`rounded-2xl p-6 border ${
                highlight
                  ? 'border-indigo-500 bg-indigo-600 text-white shadow-xl shadow-indigo-200 dark:shadow-indigo-900/30'
                  : 'border-gray-200 dark:border-gray-800'
              }`}
            >
              <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${highlight ? 'text-indigo-200' : 'text-indigo-500'}`}>{name}</p>
              <p className="text-4xl font-black mb-1">{price}<span className="text-base font-normal opacity-70">/mo</span></p>
              <p className={`text-sm mb-5 ${highlight ? 'text-indigo-100' : 'text-gray-500 dark:text-gray-400'}`}>{desc}</p>
              <ul className="space-y-2 mb-6">
                {fs.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 size={14} className={highlight ? 'text-indigo-200' : 'text-indigo-500'} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className={`block text-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  highlight
                    ? 'bg-white text-indigo-600 hover:bg-indigo-50'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 dark:border-gray-800 py-8 text-center text-sm text-gray-400">
        <p>© {new Date().getFullYear()} TaskFlow. All rights reserved.</p>
        <div className="mt-2 flex justify-center gap-4">
          <Link to="/privacy" className="hover:text-indigo-600 transition-colors">Privacy Policy</Link>
          <Link to="/terms"   className="hover:text-indigo-600 transition-colors">Terms of Service</Link>
        </div>
      </footer>
    </div>
  );
}
