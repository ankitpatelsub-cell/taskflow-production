-- Mark all pre-existing users as email-verified (they're trusted; new users must verify)
UPDATE users SET email_verified = 1 WHERE email_verified = 0;

-- OAuth-registered users should always be considered verified
-- (already covered above, but explicit for clarity)
UPDATE users SET email_verified = 1 WHERE oauth_provider IS NOT NULL;
