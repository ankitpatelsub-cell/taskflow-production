import { Link } from '@tanstack/react-router';
import {
  Kanban, Zap, Users, BarChart2, CheckCircle2, ArrowRight,
  Brain, Calendar, LayoutList, Shield, Smartphone, Bell,
  Clock, GitBranch, Settings2,
} from 'lucide-react';

const features = [
  { icon: Kanban,    title: 'Kanban & List Views',    desc: 'Drag-and-drop kanban boards and sortable list views with filters for every workflow.' },
  { icon: Brain,     title: 'AI Project Summaries',   desc: 'One-click AI summary of your project status — completion %, risks, and recommendations.' },
  { icon: Zap,       title: 'Smart Automations',      desc: 'Set "When X → Then Y" rules: auto-notify teammates, change statuses, and more.' },
  { icon: BarChart2, title: 'Standup Reports',         desc: "Auto-generated daily standups show what was done, what's next, and blockers." },
  { icon: Calendar,  title: 'Calendar View',           desc: 'See all deadlines in a calendar. Click any day to instantly create a task.' },
  { icon: Users,     title: 'Workload Management',     desc: "Spot who's overloaded and who has capacity. Team health badges at a glance." },
  { icon: GitBranch, title: 'GitHub Task Links',       desc: 'Link PRs, issues, and commits directly to tasks — keeps code and work in sync.' },
  { icon: Smartphone,title: 'Mobile PWA',              desc: 'Install on any device. Works offline. Your workspace in your pocket.' },
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
    features: ['Unlimited projects', '20 team members', 'AI summaries', 'Automations & calendar'],
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

const stats = [
  { value: '10,000+', label: 'Tasks completed' },
  { value: '500+',    label: 'Teams onboarded' },
  { value: '99.9%',   label: 'Uptime SLA' },
  { value: '< 200ms', label: 'Average response' },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white">

      {/* Nav */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-black text-lg tracking-tight text-indigo-600">Tick</span>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-indigo-600 transition-colors">
              Sign in
            </Link>
            <Link
              to="/register"
              className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-20 pb-16 text-center">
        <span className="inline-block mb-4 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 text-xs font-semibold tracking-wide uppercase">
          Project Management · AI-Powered
        </span>
        <h1 className="text-5xl font-black tracking-tight leading-tight max-w-3xl mx-auto">
          Ship faster.<br />
          <span className="text-indigo-600">Together.</span>
        </h1>
        <p className="mt-5 text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
          Tick keeps your team aligned with real-time kanban boards, AI project summaries,
          smart automations, and daily standups — all in one place.
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

        {/* Trust badges */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-500" /> Free forever plan</span>
          <span className="text-gray-200 dark:text-gray-700">·</span>
          <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-500" /> No credit card required</span>
          <span className="text-gray-200 dark:text-gray-700">·</span>
          <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-500" /> Set up in 2 minutes</span>
          <span className="text-gray-200 dark:text-gray-700">·</span>
          <span className="flex items-center gap-1"><Shield size={12} className="text-emerald-500" /> GDPR compliant</span>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-indigo-600 dark:bg-indigo-800 py-12">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map(({ value, label }) => (
            <div key={label}>
              <p className="text-3xl font-black text-white">{value}</p>
              <p className="text-indigo-200 text-sm mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black mb-3">Everything your team needs</h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
            From AI-powered insights to simple automations — Tick grows with your team.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-gray-100 dark:border-gray-800 p-6 hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-md transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center mb-4 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 transition-colors">
                <Icon size={20} className="text-indigo-600" />
              </div>
              <h3 className="font-bold mb-1.5 text-gray-900 dark:text-white">{title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 dark:bg-gray-900 py-20">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black mb-3">Get your team running in minutes</h2>
            <p className="text-gray-500 dark:text-gray-400">No complex setup. No onboarding calls needed.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Create your workspace', desc: 'Sign up free and create your first project in under 60 seconds.', icon: Settings2 },
              { step: '02', title: 'Invite your team', desc: 'Send invite links. Members join and are immediately assigned to the right project.', icon: Users },
              { step: '03', title: 'Ship together', desc: 'Track progress on the board, get AI summaries, and never miss a deadline.', icon: CheckCircle2 },
            ].map(({ step, title, desc, icon: Icon }) => (
              <div key={step} className="text-center">
                <div className="inline-flex w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900 items-center justify-center mb-4">
                  <Icon size={22} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <p className="text-xs font-bold text-indigo-400 mb-1">STEP {step}</p>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black mb-3">Simple, transparent pricing</h2>
          <p className="text-gray-500 dark:text-gray-400">No hidden fees. Cancel anytime.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map(({ name, price, desc, features: fs, cta, highlight }) => (
            <div
              key={name}
              className={`rounded-2xl p-6 border ${
                highlight
                  ? 'border-indigo-500 bg-indigo-600 text-white shadow-xl shadow-indigo-200 dark:shadow-indigo-900/30 scale-105'
                  : 'border-gray-200 dark:border-gray-800'
              }`}
            >
              {highlight && (
                <p className="text-xs font-bold text-indigo-200 uppercase tracking-wider mb-1">Most Popular</p>
              )}
              <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${highlight ? 'text-indigo-100' : 'text-indigo-500'}`}>{name}</p>
              <p className="text-4xl font-black mb-1">{price}<span className="text-base font-normal opacity-70">/mo</span></p>
              <p className={`text-sm mb-5 ${highlight ? 'text-indigo-100' : 'text-gray-500 dark:text-gray-400'}`}>{desc}</p>
              <ul className="space-y-2 mb-6">
                {fs.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 size={14} className={highlight ? 'text-indigo-200 shrink-0' : 'text-indigo-500 shrink-0'} />
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
      <footer className="border-t border-gray-100 dark:border-gray-800 py-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="font-black text-indigo-600 text-lg">Tick</span>
            <p className="text-sm text-gray-400">© {new Date().getFullYear()} Tick. All rights reserved.</p>
            <div className="flex gap-4 text-sm text-gray-400">
              <Link to="/privacy" className="hover:text-indigo-600 transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-indigo-600 transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
