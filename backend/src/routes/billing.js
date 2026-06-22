const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryOne, execute } = require('../config/db');
const { authenticate, requireMinRole } = require('../middleware/auth');
const {
  STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
  STRIPE_PRO_PRICE_ID, STRIPE_TEAM_PRICE_ID, APP_URL,
} = require('../config/env');

const router = express.Router();

// Stripe is optional — gracefully degrade if not configured
let stripe;
if (STRIPE_SECRET_KEY) {
  stripe = require('stripe')(STRIPE_SECRET_KEY);
}

const PLANS = {
  free:  { name: 'Free',  price: 0,   projects: 1,  members: 5,  tasks: 100 },
  pro:   { name: 'Pro',   price: 12,  projects: 10, members: 25, tasks: -1 },
  team:  { name: 'Team',  price: 29,  projects: -1, members: -1, tasks: -1 },
};

function requireStripe(req, res, next) {
  if (!stripe) return res.status(503).json({ error: 'Billing not configured. Set STRIPE_SECRET_KEY.' });
  next();
}

// GET /api/billing/plans
router.get('/plans', (req, res) => {
  res.json(PLANS);
});

// GET /api/billing/subscription
router.get('/subscription', authenticate, async (req, res) => {
  try {
    const sub = await queryOne('SELECT * FROM subscriptions LIMIT 1');
    res.json(sub || { plan: 'free', status: 'active' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// POST /api/billing/checkout — create Stripe Checkout session
router.post('/checkout', authenticate, requireMinRole('admin'), requireStripe, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!['pro', 'team'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' });

    const priceId = plan === 'pro' ? STRIPE_PRO_PRICE_ID : STRIPE_TEAM_PRICE_ID;
    if (!priceId) return res.status(503).json({ error: `Stripe price ID for '${plan}' not configured` });

    let sub = await queryOne('SELECT * FROM subscriptions LIMIT 1');
    let customerId = sub?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.name,
        metadata: { taskflow_user_id: req.user.id },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${APP_URL}/app/billing?success=1`,
      cancel_url:  `${APP_URL}/app/billing?canceled=1`,
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[Billing]', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/billing/portal — customer portal for managing subscription
router.post('/portal', authenticate, requireMinRole('admin'), requireStripe, async (req, res) => {
  try {
    const sub = await queryOne('SELECT * FROM subscriptions WHERE stripe_customer_id IS NOT NULL LIMIT 1');
    if (!sub?.stripe_customer_id) return res.status(400).json({ error: 'No active subscription found' });

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${APP_URL}/app/billing`,
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: 'Failed to open billing portal' });
  }
});

// POST /api/billing/webhook — Stripe webhook handler (raw body required)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(503).send('Billing not configured');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode !== 'subscription') break;

        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const priceId = subscription.items.data[0]?.price.id;
        const plan = priceId === STRIPE_PRO_PRICE_ID ? 'pro'
                   : priceId === STRIPE_TEAM_PRICE_ID ? 'team' : 'free';

        const existing = await queryOne('SELECT id FROM subscriptions LIMIT 1');
        if (existing) {
          await execute(`
            UPDATE subscriptions SET
              stripe_customer_id = ?, stripe_subscription_id = ?,
              plan = ?, status = 'active',
              current_period_end = ?, updated_at = NOW()
            WHERE id = ?
          `, [
            session.customer, session.subscription, plan,
            new Date(subscription.current_period_end * 1000).toISOString(),
            existing.id,
          ]);
        } else {
          await execute(`
            INSERT INTO subscriptions (id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end)
            VALUES (?, ?, ?, ?, 'active', ?)
          `, [
            uuidv4(), session.customer, session.subscription, plan,
            new Date(subscription.current_period_end * 1000).toISOString(),
          ]);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const priceId = sub.items.data[0]?.price.id;
        const plan = priceId === STRIPE_PRO_PRICE_ID ? 'pro'
                   : priceId === STRIPE_TEAM_PRICE_ID ? 'team' : 'free';
        await execute(`
          UPDATE subscriptions SET plan = ?, status = ?, current_period_end = ?, updated_at = NOW()
          WHERE stripe_subscription_id = ?
        `, [plan, sub.status, new Date(sub.current_period_end * 1000).toISOString(), sub.id]);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await execute(
          "UPDATE subscriptions SET plan = 'free', status = 'canceled', updated_at = NOW() WHERE stripe_subscription_id = ?",
          [sub.id]
        );
        break;
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[Webhook]', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
