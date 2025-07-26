-- KeyFate Seed Data
-- Generated: 2024-01-15
-- WARNING: This is for development only - contains test data

-- IMPORTANT: Create these auth users manually in Supabase Dashboard:
-- 1. Go to Authentication > Users in your Supabase dashboard
-- 2. Add these users with password 'password123':
--    - ceo@aviat.io (ID: 48a35ccd-e1e4-458b-86ec-5bd88a0addc7)
--    - john.doe@example.com (ID: 836f82db-9912-4b34-8101-1f16b49dfa5f)
--    - alice.smith@company.com (ID: 2734a10c-2335-480b-8bf3-efc468cf89de)
--    - bob.wilson@startup.io (ID: 78dd97e7-1ce4-4a41-8fdc-69e3371f2175)

-- Temporarily disable foreign key constraints for seeding without auth users
SET session_replication_role = replica;

-- Clean existing data (in reverse dependency order)
DELETE FROM reminders;
DELETE FROM checkin_history;
DELETE FROM check_in_tokens;
DELETE FROM recipient_access_tokens;
DELETE FROM secrets;
DELETE FROM user_contact_methods;
DELETE FROM user_subscriptions;
DELETE FROM user_tiers;
DELETE FROM subscription_usage;
DELETE FROM admin_notifications;

-- User contact methods
INSERT INTO user_contact_methods (id, user_id, email, phone, preferred_method, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440001', '48a35ccd-e1e4-458b-86ec-5bd88a0addc7', 'ceo@aviat.io', NULL, 'email', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440002', '836f82db-9912-4b34-8101-1f16b49dfa5f', 'john.doe@example.com', NULL, 'email', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440003', '2734a10c-2335-480b-8bf3-efc468cf89de', 'alice.smith@company.com', '+1-555-0123', 'both', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440004', '78dd97e7-1ce4-4a41-8fdc-69e3371f2175', NULL, '+1-555-0456', 'phone', NOW(), NOW());

-- User subscriptions
-- Free user subscription
INSERT INTO user_subscriptions (id, user_id, tier_name, status, created_at, updated_at) VALUES
('660e8400-e29b-41d4-a716-446655440002', '836f82db-9912-4b34-8101-1f16b49dfa5f', 'free', 'active', NOW(), NOW());

-- Pro user subscriptions
INSERT INTO user_subscriptions (id, user_id, tier_name, status, created_at, updated_at, current_period_start, current_period_end, paddle_customer_id, paddle_subscription_id) VALUES
('660e8400-e29b-41d4-a716-446655440001', '48a35ccd-e1e4-458b-86ec-5bd88a0addc7', 'pro', 'active', NOW(), NOW(), NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 'cust_48a35ccd', 'sub_48a35ccd'),
('660e8400-e29b-41d4-a716-446655440003', '2734a10c-2335-480b-8bf3-efc468cf89de', 'pro', 'active', NOW(), NOW(), NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 'cust_2734a10c', 'sub_2734a10c'),
('660e8400-e29b-41d4-a716-446655440004', '78dd97e7-1ce4-4a41-8fdc-69e3371f2175', 'pro', 'active', NOW(), NOW(), NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 'cust_78dd97e7', 'sub_78dd97e7');

-- User tiers
INSERT INTO user_tiers (id, user_id, tier_name, max_secrets, max_recipients_per_secret, custom_intervals, created_at, updated_at) VALUES
('770e8400-e29b-41d4-a716-446655440001', '48a35ccd-e1e4-458b-86ec-5bd88a0addc7', 'pro', 100, 10, true, NOW(), NOW()),
('770e8400-e29b-41d4-a716-446655440002', '836f82db-9912-4b34-8101-1f16b49dfa5f', 'free', 1, 1, false, NOW(), NOW()),
('770e8400-e29b-41d4-a716-446655440003', '2734a10c-2335-480b-8bf3-efc468cf89de', 'pro', 100, 10, true, NOW(), NOW()),
('770e8400-e29b-41d4-a716-446655440004', '78dd97e7-1ce4-4a41-8fdc-69e3371f2175', 'pro', 100, 10, true, NOW(), NOW());

-- Subscription usage
INSERT INTO subscription_usage (id, user_id, secrets_count, total_recipients, last_calculated) VALUES
('880e8400-e29b-41d4-a716-446655440001', '48a35ccd-e1e4-458b-86ec-5bd88a0addc7', 3, 3, NOW()),
('880e8400-e29b-41d4-a716-446655440002', '836f82db-9912-4b34-8101-1f16b49dfa5f', 1, 1, NOW()),
('880e8400-e29b-41d4-a716-446655440003', '2734a10c-2335-480b-8bf3-efc468cf89de', 4, 4, NOW()),
('880e8400-e29b-41d4-a716-446655440004', '78dd97e7-1ce4-4a41-8fdc-69e3371f2175', 2, 2, NOW());

-- Secrets (with encrypted server shares)
-- CEO Secret 1: Recently expired (triggered)
INSERT INTO secrets (
  id, user_id, title, recipient_name, recipient_email,
  contact_method, check_in_days, server_share, iv, auth_tag,
  sss_shares_total, sss_threshold, status, last_check_in, next_check_in,
  created_at, updated_at, is_triggered, triggered_at
) VALUES
('990e8400-e29b-41d4-a716-446655440001', '48a35ccd-e1e4-458b-86ec-5bd88a0addc7', 'Bitcoin Wallet Recovery', 'Emergency Contact', 'emergency@example.com', 'email', 7,
'iKqL2B8cR8A8a2Kc7Ij8jIpKqL2B8cR8A8a2Kc7Ij8jIpKqL2B8cR8A8a2Kc7Ij8jI=', 'randomIV123456==', 'authTag12345==',
3, 2, 'triggered', NOW() - INTERVAL '9 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '20 days', NOW(), true, NOW() - INTERVAL '2 days');

-- All other secrets (active/paused)
INSERT INTO secrets (
  id, user_id, title, recipient_name, recipient_email,
  contact_method, check_in_days, server_share, iv, auth_tag,
  sss_shares_total, sss_threshold, status, last_check_in, next_check_in,
  created_at, updated_at
) VALUES
-- CEO Secret 2: Triggering in 5 minutes
('990e8400-e29b-41d4-a716-446655440002', '48a35ccd-e1e4-458b-86ec-5bd88a0addc7', 'Buried Gold Location', 'Trusted Friend', 'friend@example.com', 'email', 7,
'mLpN3C9dS9B9b3Ld8Jk9kJqLpN3C9dS9B9b3Ld8Jk9kJqLpN3C9dS9B9b3Ld8Jk9kJ=', 'randomIV234567==', 'authTag23456==',
3, 2, 'active', NOW() - INTERVAL '6 days 23 hours 55 minutes', NOW() + INTERVAL '5 minutes', NOW() - INTERVAL '15 days', NOW()),

-- CEO Secret 3: Triggering in 30 days
('990e8400-e29b-41d4-a716-446655440003', '48a35ccd-e1e4-458b-86ec-5bd88a0addc7', 'Safe Combination', 'Family Member', 'family@example.com', 'email', 7,
'nMqO4D0eT0C0c4Me9Kl0lKrMqO4D0eT0C0c4Me9Kl0lKrMqO4D0eT0C0c4Me9Kl0lK=', 'randomIV345678==', 'authTag34567==',
3, 2, 'active', NOW(), NOW() + INTERVAL '30 days', NOW() - INTERVAL '10 days', NOW()),

-- John Doe (Free user): 1 secret only
('990e8400-e29b-41d4-a716-446655440011', '836f82db-9912-4b34-8101-1f16b49dfa5f', 'Personal Documents Location', 'Spouse', 'spouse@example.com', 'email', 7,
'oNrP5E1fU1D1d5Nf0Lm1mLsNrP5E1fU1D1d5Nf0Lm1mLsNrP5E1fU1D1d5Nf0Lm1mL=', 'randomIV456789==', 'authTag45678==',
3, 2, 'active', NOW() - INTERVAL '2 days', NOW() + INTERVAL '5 days', NOW() - INTERVAL '12 days', NOW()),

-- Alice Smith (Pro user): 4 secrets
('990e8400-e29b-41d4-a716-446655440021', '2734a10c-2335-480b-8bf3-efc468cf89de', 'Offshore Account Details', 'Estate Lawyer', 'lawyer@lawfirm.com', 'email', 7,
'pOsQ6F2gV2E2e6Og1Mn2nMtOsQ6F2gV2E2e6Og1Mn2nMtOsQ6F2gV2E2e6Og1Mn2nM=', 'randomIV567890==', 'authTag56789==',
3, 2, 'active', NOW() - INTERVAL '1 day', NOW() + INTERVAL '6 days', NOW() - INTERVAL '8 days', NOW()),

('990e8400-e29b-41d4-a716-446655440022', '2734a10c-2335-480b-8bf3-efc468cf89de', 'Server Access Keys', 'Tech Lead', 'techlead@company.com', 'email', 14,
'qPtR7G3hW3F3f7Ph2No3oNuPtR7G3hW3F3f7Ph2No3oNuPtR7G3hW3F3f7Ph2No3oN=', 'randomIV678901==', 'authTag67890==',
3, 2, 'active', NOW() - INTERVAL '3 days', NOW() + INTERVAL '11 days', NOW() - INTERVAL '18 days', NOW()),

('990e8400-e29b-41d4-a716-446655440023', '2734a10c-2335-480b-8bf3-efc468cf89de', 'Bitcoin Wallet Recovery', 'Emergency Contact', 'emergency2@example.com', 'email', 7,
'rQuS8H4iX4G4g8Qi3Op4pOvQuS8H4iX4G4g8Qi3Op4pOvQuS8H4iX4G4g8Qi3Op4pO=', 'randomIV789012==', 'authTag78901==',
3, 2, 'paused', NOW() - INTERVAL '5 days', NOW() + INTERVAL '2 days', NOW() - INTERVAL '25 days', NOW()),

('990e8400-e29b-41d4-a716-446655440024', '2734a10c-2335-480b-8bf3-efc468cf89de', 'Buried Gold Location', 'Trusted Friend', 'friend2@example.com', 'email', 7,
'sRvT9I5jY5H5h9Rj4Pq5qPwRvT9I5jY5H5h9Rj4Pq5qPwRvT9I5jY5H5h9Rj4Pq5qP=', 'randomIV890123==', 'authTag89012==',
3, 2, 'active', NOW() - INTERVAL '4 days', NOW() + INTERVAL '3 days', NOW() - INTERVAL '14 days', NOW()),

-- Bob Wilson (Pro user): 2 secrets
('990e8400-e29b-41d4-a716-446655440031', '78dd97e7-1ce4-4a41-8fdc-69e3371f2175', 'Safe Combination', 'Family Member', NULL, 'phone', 7,
'tSwU0J6kZ6I6i0Sk5Qr6rQxSwU0J6kZ6I6i0Sk5Qr6rQxSwU0J6kZ6I6i0Sk5Qr6rQ=', 'randomIV901234==', 'authTag90123==',
3, 2, 'active', NOW() - INTERVAL '1 day', NOW() + INTERVAL '6 days', NOW() - INTERVAL '11 days', NOW()),

('990e8400-e29b-41d4-a716-446655440032', '78dd97e7-1ce4-4a41-8fdc-69e3371f2175', 'Server Access Keys', 'Tech Lead', NULL, 'phone', 14,
'uTxV1K7lA7J7j1Tl6Rs7sRyTxV1K7lA7J7j1Tl6Rs7sRyTxV1K7lA7J7j1Tl6Rs7sR=', 'randomIV012345==', 'authTag01234==',
3, 2, 'active', NOW() - INTERVAL '2 days', NOW() + INTERVAL '12 days', NOW() - INTERVAL '19 days', NOW());

-- Check-in history (sample entries for each secret)
INSERT INTO checkin_history (id, secret_id, user_id, checked_in_at, next_check_in, created_at) VALUES
-- CEO check-ins
('aa0e8400-e29b-41d4-a716-446655440001', '990e8400-e29b-41d4-a716-446655440001', '48a35ccd-e1e4-458b-86ec-5bd88a0addc7', NOW() - INTERVAL '16 days', NOW() - INTERVAL '9 days', NOW() - INTERVAL '16 days'),
('aa0e8400-e29b-41d4-a716-446655440002', '990e8400-e29b-41d4-a716-446655440002', '48a35ccd-e1e4-458b-86ec-5bd88a0addc7', NOW() - INTERVAL '13 days 23 hours 55 minutes', NOW() - INTERVAL '6 days 23 hours 55 minutes', NOW() - INTERVAL '13 days 23 hours 55 minutes'),
('aa0e8400-e29b-41d4-a716-446655440003', '990e8400-e29b-41d4-a716-446655440003', '48a35ccd-e1e4-458b-86ec-5bd88a0addc7', NOW() - INTERVAL '7 days', NOW(), NOW() - INTERVAL '7 days'),

-- John check-ins
('aa0e8400-e29b-41d4-a716-446655440011', '990e8400-e29b-41d4-a716-446655440011', '836f82db-9912-4b34-8101-1f16b49dfa5f', NOW() - INTERVAL '9 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '9 days'),
('aa0e8400-e29b-41d4-a716-446655440012', '990e8400-e29b-41d4-a716-446655440011', '836f82db-9912-4b34-8101-1f16b49dfa5f', NOW() - INTERVAL '16 days', NOW() - INTERVAL '9 days', NOW() - INTERVAL '16 days'),

-- Alice check-ins
('aa0e8400-e29b-41d4-a716-446655440021', '990e8400-e29b-41d4-a716-446655440021', '2734a10c-2335-480b-8bf3-efc468cf89de', NOW() - INTERVAL '8 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '8 days'),
('aa0e8400-e29b-41d4-a716-446655440022', '990e8400-e29b-41d4-a716-446655440022', '2734a10c-2335-480b-8bf3-efc468cf89de', NOW() - INTERVAL '17 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '17 days'),

-- Bob check-ins
('aa0e8400-e29b-41d4-a716-446655440031', '990e8400-e29b-41d4-a716-446655440031', '78dd97e7-1ce4-4a41-8fdc-69e3371f2175', NOW() - INTERVAL '8 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '8 days'),
('aa0e8400-e29b-41d4-a716-446655440032', '990e8400-e29b-41d4-a716-446655440032', '78dd97e7-1ce4-4a41-8fdc-69e3371f2175', NOW() - INTERVAL '16 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '16 days');

-- Check-in tokens
INSERT INTO check_in_tokens (id, secret_id, token, expires_at, created_at) VALUES
('bb0e8400-e29b-41d4-a716-446655440001', '990e8400-e29b-41d4-a716-446655440002', 'checkin_token_ceo_secret2_abc123def456ghi789', NOW() + INTERVAL '30 days', NOW()),
('bb0e8400-e29b-41d4-a716-446655440002', '990e8400-e29b-41d4-a716-446655440003', 'checkin_token_ceo_secret3_xyz789uvw456rst123', NOW() + INTERVAL '30 days', NOW()),
('bb0e8400-e29b-41d4-a716-446655440011', '990e8400-e29b-41d4-a716-446655440011', 'checkin_token_john_secret1_def456ghi789jkl012', NOW() + INTERVAL '30 days', NOW()),
('bb0e8400-e29b-41d4-a716-446655440021', '990e8400-e29b-41d4-a716-446655440021', 'checkin_token_alice_secret1_ghi789jkl012mno345', NOW() + INTERVAL '30 days', NOW()),
('bb0e8400-e29b-41d4-a716-446655440022', '990e8400-e29b-41d4-a716-446655440022', 'checkin_token_alice_secret2_jkl012mno345pqr678', NOW() + INTERVAL '30 days', NOW()),
('bb0e8400-e29b-41d4-a716-446655440024', '990e8400-e29b-41d4-a716-446655440024', 'checkin_token_alice_secret4_mno345pqr678stu901', NOW() + INTERVAL '30 days', NOW()),
('bb0e8400-e29b-41d4-a716-446655440031', '990e8400-e29b-41d4-a716-446655440031', 'checkin_token_bob_secret1_pqr678stu901vwx234', NOW() + INTERVAL '30 days', NOW()),
('bb0e8400-e29b-41d4-a716-446655440032', '990e8400-e29b-41d4-a716-446655440032', 'checkin_token_bob_secret2_stu901vwx234yzb567', NOW() + INTERVAL '30 days', NOW());

-- Recipient access token for triggered secret
INSERT INTO recipient_access_tokens (id, secret_id, token, expires_at, created_at) VALUES
('cc0e8400-e29b-41d4-a716-446655440001', '990e8400-e29b-41d4-a716-446655440001', 'recipient_access_ceo_triggered_abc123def456ghi789jkl012', NOW() + INTERVAL '7 days', NOW() - INTERVAL '2 days');

-- Reminders for active secrets
INSERT INTO reminders (id, secret_id, user_id, type, scheduled_for, status, created_at) VALUES
-- CEO Secret 2 (triggering in 5 minutes) - urgent reminders
('dd0e8400-e29b-41d4-a716-446655440001', '990e8400-e29b-41d4-a716-446655440002', '48a35ccd-e1e4-458b-86ec-5bd88a0addc7', '1_hour', NOW() + INTERVAL '4 minutes', 'pending', NOW()),

-- CEO Secret 3 (30 days) - future reminders
('dd0e8400-e29b-41d4-a716-446655440002', '990e8400-e29b-41d4-a716-446655440003', '48a35ccd-e1e4-458b-86ec-5bd88a0addc7', '7_days', NOW() + INTERVAL '23 days', 'pending', NOW()),
('dd0e8400-e29b-41d4-a716-446655440003', '990e8400-e29b-41d4-a716-446655440003', '48a35ccd-e1e4-458b-86ec-5bd88a0addc7', '3_days', NOW() + INTERVAL '27 days', 'pending', NOW()),

-- John's reminders
('dd0e8400-e29b-41d4-a716-446655440011', '990e8400-e29b-41d4-a716-446655440011', '836f82db-9912-4b34-8101-1f16b49dfa5f', '24_hours', NOW() + INTERVAL '4 days', 'pending', NOW()),

-- Alice's reminders
('dd0e8400-e29b-41d4-a716-446655440021', '990e8400-e29b-41d4-a716-446655440021', '2734a10c-2335-480b-8bf3-efc468cf89de', '24_hours', NOW() + INTERVAL '5 days', 'pending', NOW()),
('dd0e8400-e29b-41d4-a716-446655440022', '990e8400-e29b-41d4-a716-446655440022', '2734a10c-2335-480b-8bf3-efc468cf89de', '3_days', NOW() + INTERVAL '8 days', 'pending', NOW()),

-- Bob's reminders
('dd0e8400-e29b-41d4-a716-446655440031', '990e8400-e29b-41d4-a716-446655440031', '78dd97e7-1ce4-4a41-8fdc-69e3371f2175', '24_hours', NOW() + INTERVAL '5 days', 'pending', NOW()),
('dd0e8400-e29b-41d4-a716-446655440032', '990e8400-e29b-41d4-a716-446655440032', '78dd97e7-1ce4-4a41-8fdc-69e3371f2175', '7_days', NOW() + INTERVAL '5 days', 'pending', NOW());

-- Admin notifications
INSERT INTO admin_notifications (id, type, severity, title, message, metadata, created_at) VALUES
('ee0e8400-e29b-41d4-a716-446655440001', 'security', 'medium', 'Multiple failed login attempts', 'User attempted to login 5 times with incorrect password', '{"user_id": "48a35ccd-e1e4-458b-86ec-5bd88a0addc7", "attempts": 5}', NOW() - INTERVAL '2 hours'),
('ee0e8400-e29b-41d4-a716-446655440002', 'system', 'high', 'Backup completed successfully', 'Daily backup completed without errors', '{"backup_size": "1.2GB", "duration": "45 minutes"}', NOW() - INTERVAL '1 day'),
('ee0e8400-e29b-41d4-a716-446655440003', 'reminder', 'low', 'Secret reminder sent', 'Reminder sent for upcoming secret expiration', '{"secret_id": "990e8400-e29b-41d4-a716-446655440002", "type": "24_hours"}', NOW() - INTERVAL '6 hours'),
('ee0e8400-e29b-41d4-a716-446655440004', 'security', 'high', 'Secret triggered', 'A secret has been triggered and recipient notified', '{"secret_id": "990e8400-e29b-41d4-a716-446655440001", "recipient": "emergency@example.com"}', NOW() - INTERVAL '2 days'),
('ee0e8400-e29b-41d4-a716-446655440005', 'system', 'low', 'User subscription upgraded', 'User upgraded to Pro tier', '{"user_id": "2734a10c-2335-480b-8bf3-efc468cf89de", "from": "free", "to": "pro"}', NOW() - INTERVAL '3 days');

-- AUTH USERS MUST BE CREATED SEPARATELY!
-- This seed file only creates database records with these specific UUIDs:
-- ceo@aviat.io -> 48a35ccd-e1e4-458b-86ec-5bd88a0addc7
-- john.doe@example.com -> 836f82db-9912-4b34-8101-1f16b49dfa5f
-- alice.smith@company.com -> 2734a10c-2335-480b-8bf3-efc468cf89de
-- bob.wilson@startup.io -> 78dd97e7-1ce4-4a41-8fdc-69e3371f2175
--
-- To create matching auth users, run: cd frontend && node create-seed-users.js
-- Or see supabase/SEED_README.md for full instructions

-- Summary:
-- ✓ 4 users (1 free, 3 pro tiers)
-- ✓ 10 secrets total with encrypted server shares
-- ✓ CEO user has 3 secrets: 1 triggered, 1 triggering in 5 min, 1 triggering in 30 days
-- ✓ Check-in history and tokens for all secrets
-- ✓ Appropriate reminders scheduled
-- ✓ Sample admin notifications
-- ✓ Mixed contact methods (email, phone, both)

-- Secret Content Examples (what's encrypted in server_share):
-- - Bitcoin wallet seed phrases
-- - Buried treasure coordinates
-- - Safe combinations
-- - Bank account details
-- - Server access credentials

-- Re-enable foreign key constraints
SET session_replication_role = DEFAULT;
