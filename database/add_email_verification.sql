-- One-time migration: adds email_verified to an existing users table.
-- Run once against a live database that already has data (local + Railway
-- both need this — schema.sql itself is NOT safe to re-run against them,
-- it drops and recreates every table).
--
-- Existing accounts are grandfathered in as already-verified (they logged
-- in successfully before this feature existed) -- only new registrations
-- going forward start unverified and must complete the OTP flow.

ALTER TABLE users
    ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'set true once the registration email-OTP is confirmed; login is blocked until then'
    AFTER line_user_id;

UPDATE users SET email_verified = 1;
