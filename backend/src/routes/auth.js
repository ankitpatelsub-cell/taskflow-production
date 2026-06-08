const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { queryOne, execute } = require('../config/db');
const { hash, compare } = require('../utils/password');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../services/emailService');
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL, NODE_ENV } = require('../config/env');
const logger = require('../config/logger');

const router = express.Router();

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function issueTokens(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    email_verified: !!(user.email_verified),
  };
  return {
    accessToken: signAccess(payload),
    refreshToken: signRefresh({ id: user.id }),
  };
}

async function storeRefreshToken(userId, refreshToken) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await execute(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
    [uuidv4(), userId, hashToken(refreshToken), expiresAt]
  );
}

function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: NODE_ENV === 'production',
  });
}

// ── Google OAuth ──────────────────────────────────────────────────────────────
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: `${APP_URL.replace('5173', '3001')}/api/auth/google/callback`,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value?.toLowerCase();
        if (!email) return done(new Error('No email from Google'));

        let user = await queryOne('SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?', ['google', profile.id]);

        if (!user) {
          user = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
          if (user) {
            await execute('UPDATE users SET oauth_provider = ?, oauth_id = ? WHERE id = ?', ['google', profile.id, user.id]);
            user = await queryOne('SELECT * FROM users WHERE id = ?', [user.id]);
            logger.info({ userId: user.id, email, provider: 'google' }, 'user.oauth_account_linked');
          } else {
            const id = uuidv4();
            await execute(
              `INSERT INTO users (id, name, email, oauth_provider, oauth_id, avatar_url, role, is_active, email_verified)
               VALUES (?, ?, ?, 'google', ?, ?, 'member', 1, 1)`,
              [id, profile.displayName || email, email, profile.id, profile.photos?.[0]?.value || null]
            );
            user = await queryOne('SELECT * FROM users WHERE id = ?', [id]);
            logger.info({ userId: id, email, provider: 'google' }, 'user.registered_via_oauth');
          }
        }

        if (!user.is_active) {
          logger.warn({ userId: user.id, email, provider: 'google' }, 'auth.oauth_account_inactive');
          return done(null, false, { message: 'Account deactivated' });
        }
        done(null, user);
      } catch (err) {
        logger.error({ err: err.message, provider: 'google' }, 'auth.oauth_strategy_error');
        done(err);
      }
    }
  ));

  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

  router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: `${APP_URL}/login?error=oauth` }),
    async (req, res) => {
      try {
        const { accessToken, refreshToken } = issueTokens(req.user);
        await storeRefreshToken(req.user.id, refreshToken);
        setRefreshCookie(res, refreshToken);
        logger.info({ userId: req.user.id, email: req.user.email }, 'user.login_oauth');
        res.redirect(`${APP_URL}/auth/callback?token=${accessToken}`);
      } catch (err) {
        logger.error({ userId: req.user?.id, err: err.message }, 'auth.oauth_callback_failed');
        res.redirect(`${APP_URL}/login?error=oauth`);
      }
    }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim())    return res.status(400).json({ error: 'Name is required' });
    if (!email?.trim())   return res.status(400).json({ error: 'Email is required' });
    if (!password)        return res.status(400).json({ error: 'Password is required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter and one number' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email address' });

    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing) {
      req.log.warn({ email }, 'auth.register_conflict');
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const id = uuidv4();
    const passwordHash = await hash(password);
    await execute(
      `INSERT INTO users (id, name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, 'member', 1)`,
      [id, name.trim(), email.toLowerCase().trim(), passwordHash]
    );

    const user = await queryOne('SELECT * FROM users WHERE id = ?', [id]);
    const { accessToken, refreshToken } = issueTokens(user);
    await storeRefreshToken(user.id, refreshToken);
    setRefreshCookie(res, refreshToken);

    req.log.info({ userId: id, email: user.email }, 'user.registered');

    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    execute(
      'INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), id, hashToken(verifyToken), verifyExpires]
    ).then(() =>
      sendWelcomeEmail({
        to: user.email,
        name: user.name,
        verifyUrl: `${APP_URL}/verify-email/${verifyToken}`,
      })
    ).catch((e) => req.log.warn({ userId: id, err: e.message }, 'auth.welcome_email_failed'));

    res.status(201).json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_url: null },
    });
  } catch (err) {
    req.log.error({ err: err.message }, 'auth.register_failed');
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await queryOne('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);
    if (!user) {
      req.log.warn({ email, ip: req.ip }, 'auth.login_invalid_credentials');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.password_hash) {
      req.log.warn({ userId: user.id, email, ip: req.ip }, 'auth.login_social_account');
      return res.status(401).json({ error: 'This account uses social login' });
    }

    const valid = await compare(password, user.password_hash);
    if (!valid) {
      req.log.warn({ userId: user.id, email, ip: req.ip }, 'auth.login_wrong_password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // If TOTP is enabled, return a partial response — client must complete /auth/2fa/verify
    if (user.totp_enabled) {
      req.log.info({ userId: user.id, email: user.email }, 'auth.login_totp_required');
      return res.json({ requiresTwoFactor: true, userId: user.id });
    }

    const { accessToken, refreshToken } = issueTokens(user);
    await storeRefreshToken(user.id, refreshToken);
    setRefreshCookie(res, refreshToken);

    req.log.info({ userId: user.id, email: user.email, role: user.role }, 'user.login');

    res.json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_url: user.avatar_url },
    });
  } catch (err) {
    req.log.error({ err: err.message }, 'auth.login_failed');
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ error: 'No refresh token' });

    let payload;
    try { payload = verifyRefresh(token); } catch {
      req.log.warn({ ip: req.ip }, 'auth.refresh_invalid_token');
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const stored = await queryOne(
      "SELECT * FROM refresh_tokens WHERE user_id = ? AND token_hash = ? AND expires_at > NOW()",
      [payload.id, hashToken(token)]
    );
    if (!stored) {
      req.log.warn({ userId: payload.id, ip: req.ip }, 'auth.refresh_token_revoked');
      return res.status(401).json({ error: 'Refresh token revoked or expired' });
    }

    const user = await queryOne('SELECT * FROM users WHERE id = ? AND is_active = 1', [payload.id]);
    if (!user) {
      req.log.warn({ userId: payload.id }, 'auth.refresh_user_not_found');
      return res.status(401).json({ error: 'User not found' });
    }

    // Rotate: delete old token and issue a new one (single-use tokens)
    await execute('DELETE FROM refresh_tokens WHERE id = ?', [stored.id]);
    const { accessToken, refreshToken: newRefreshToken } = issueTokens(user);
    await storeRefreshToken(user.id, newRefreshToken);
    setRefreshCookie(res, newRefreshToken);

    req.log.debug({ userId: user.id }, 'auth.token_refreshed');
    res.json({ accessToken });
  } catch (err) {
    req.log.error({ err: err.message }, 'auth.refresh_failed');
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      await execute('DELETE FROM refresh_tokens WHERE token_hash = ?', [hashToken(token)]);
    }
    res.clearCookie('refreshToken');
    req.log.info({ userId: req.user.id }, 'user.logout');
    res.json({ message: 'Logged out' });
  } catch {
    res.json({ message: 'Logged out' });
  }
});

// POST /api/auth/resend-verification
// No email_verified gate needed — this is the escape hatch.
// Rate-limited by the global auth limiter. Requires a valid access token so a
// random person can't spam verification emails for arbitrary addresses.
router.post('/resend-verification', authenticate, async (req, res) => {
  try {
    const user = await queryOne('SELECT id, name, email, email_verified FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.email_verified) return res.status(400).json({ error: 'Email already verified' });

    // Enforce 5-minute cooldown per user to prevent email spam
    const recent = await queryOne(
      "SELECT id FROM email_verification_tokens WHERE user_id = ? AND used_at IS NULL AND created_at > NOW() - INTERVAL '5 minutes'",
      [user.id]
    );
    if (recent) return res.status(429).json({ error: 'Please wait 5 minutes before requesting another verification email.' });

    // Invalidate any outstanding tokens for this user
    await execute(
      "UPDATE email_verification_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL",
      [user.id]
    );

    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await execute(
      'INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), user.id, hashToken(verifyToken), verifyExpires]
    );

    const { sendWelcomeEmail } = require('../services/emailService');
    const { APP_URL } = require('../config/env');
    await sendWelcomeEmail({
      to: user.email,
      name: user.name,
      verifyUrl: `${APP_URL}/verify-email/${verifyToken}`,
    });

    req.log.info({ userId: user.id }, 'auth.verification_resent');
    res.json({ message: 'Verification email sent' });
  } catch (err) {
    req.log.error({ userId: req.user?.id, err: err.message }, 'auth.resend_verification_failed');
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

module.exports = router;
