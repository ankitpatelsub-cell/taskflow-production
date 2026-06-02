const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { queryOne, execute } = require('../config/db');
const { hash, compare } = require('../utils/password');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL, NODE_ENV } = require('../config/env');

const router = express.Router();

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function issueTokens(user) {
  const payload = { id: user.id, email: user.email, role: user.role, name: user.name };
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
          // Check if email already exists — link accounts
          user = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
          if (user) {
            await execute('UPDATE users SET oauth_provider = ?, oauth_id = ? WHERE id = ?', ['google', profile.id, user.id]);
            user = await queryOne('SELECT * FROM users WHERE id = ?', [user.id]);
          } else {
            const id = uuidv4();
            await execute(
              `INSERT INTO users (id, name, email, oauth_provider, oauth_id, avatar_url, role, is_active)
               VALUES (?, ?, ?, 'google', ?, ?, 'member', 1)`,
              [id, profile.displayName || email, email, profile.id, profile.photos?.[0]?.value || null]
            );
            user = await queryOne('SELECT * FROM users WHERE id = ?', [id]);
          }
        }

        if (!user.is_active) return done(null, false, { message: 'Account deactivated' });
        done(null, user);
      } catch (err) {
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
        // Redirect to frontend with token in URL fragment (short-lived)
        res.redirect(`${APP_URL}/auth/callback?token=${accessToken}`);
      } catch (err) {
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
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email address' });

    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

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

    res.status(201).json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_url: null },
    });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await queryOne('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.password_hash) return res.status(401).json({ error: 'This account uses social login' });

    const valid = await compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const { accessToken, refreshToken } = issueTokens(user);
    await storeRefreshToken(user.id, refreshToken);
    setRefreshCookie(res, refreshToken);

    res.json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_url: user.avatar_url },
    });
  } catch (err) {
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
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const stored = await queryOne(
      "SELECT * FROM refresh_tokens WHERE user_id = ? AND token_hash = ? AND expires_at > NOW()",
      [payload.id, hashToken(token)]
    );
    if (!stored) return res.status(401).json({ error: 'Refresh token revoked or expired' });

    const user = await queryOne('SELECT * FROM users WHERE id = ? AND is_active = 1', [payload.id]);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const accessToken = signAccess({ id: user.id, email: user.email, role: user.role, name: user.name });
    res.json({ accessToken });
  } catch (err) {
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
    res.json({ message: 'Logged out' });
  } catch {
    res.json({ message: 'Logged out' });
  }
});

module.exports = router;
