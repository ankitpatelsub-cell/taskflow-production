import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CheckCircle2, Zap, Building2, Shield, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';

const PLAN_ICONS = { free: Shield, pro: Zap, team: Building2 };
const PLAN_COLORS = {
  free: 'border-slate-200 bg-white',
  pro:  'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-400',
  team: 'border-slate-200 bg-white',
};

export function BillingPage() {
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const { data: plans = {} } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: () => api.get('/billing/plans').then((r) => r.data),
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.get('/billing/subscription').then((r) => r.data),
  });

  async function handleUpgrade(plan) {
    setCheckoutLoading(plan);
    try {
      const { data } = await api.post('/billing/checkout', { plan });
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start checkout');
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const { data } = await api.post('/billing/portal');
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  }

  const currentPlan = subscription?.plan || 'free';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Billing & Plans</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Current plan: <span className="font-semibold capitalize text-indigo-600">{currentPlan}</span>
          {subscription?.current_period_end && (
            <span className="ml-2 text-sm">
              · renews {new Date(subscription.current_period_end).toLocaleDateString()}
            </span>
          )}
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {Object.entries(plans).map(([planKey, plan]) => {
          const Icon = PLAN_ICONS[planKey] || Shield;
          const isCurrent = currentPlan === planKey;
          return (
            <div
              key={planKey}
              className={`rounded-2xl border-2 p-6 flex flex-col transition-all ${PLAN_COLORS[planKey]}`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <Icon size={20} className="text-indigo-600" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">{plan.name}</div>
                  <div className="text-sm text-slate-500">
                    {plan.price === 0 ? 'Free forever' : `$${plan.price}/mo`}
                  </div>
                </div>
                {isCurrent && (
                  <span className="ml-auto text-xs font-semibold bg-indigo-100 text-indigo-700 rounded-full px-2.5 py-1">
                    Current
                  </span>
                )}
              </div>

              <ul className="space-y-2 flex-1 mb-6 text-sm text-slate-600">
                <PlanFeature label={plan.projects === -1 ? 'Unlimited projects' : `${plan.projects} project${plan.projects > 1 ? 's' : ''}`} />
                <PlanFeature label={plan.members === -1 ? 'Unlimited members' : `Up to ${plan.members} members`} />
                <PlanFeature label={plan.tasks === -1 ? 'Unlimited tasks' : `Up to ${plan.tasks} tasks`} />
                {planKey !== 'free' && <PlanFeature label="Priority support" />}
                {planKey === 'team' && <PlanFeature label="SSO & advanced permissions" />}
              </ul>

              {isCurrent ? (
                planKey !== 'free' ? (
                  <Button variant="outline" size="sm" onClick={handlePortal} disabled={portalLoading}>
                    {portalLoading ? <Loader2 size={14} className="animate-spin" /> : 'Manage'}
                  </Button>
                ) : null
              ) : planKey !== 'free' ? (
                <Button
                  size="sm"
                  onClick={() => handleUpgrade(planKey)}
                  disabled={!!checkoutLoading}
                >
                  {checkoutLoading === planKey
                    ? <Loader2 size={14} className="animate-spin" />
                    : `Upgrade to ${plan.name}`}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Manage existing subscription */}
      {currentPlan !== 'free' && (
        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-5 flex items-center justify-between">
          <div>
            <div className="font-medium text-slate-900 dark:text-slate-100">Manage subscription</div>
            <div className="text-sm text-slate-500">Update payment method, download invoices, or cancel.</div>
          </div>
          <Button variant="outline" onClick={handlePortal} disabled={portalLoading}>
            {portalLoading ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
            Billing Portal
          </Button>
        </div>
      )}
    </div>
  );
}

function PlanFeature({ label }) {
  return (
    <li className="flex items-center gap-2">
      <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
      {label}
    </li>
  );
}
