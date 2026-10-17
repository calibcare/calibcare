-- One-time migration: adds must_change_password to an existing users table.
-- Run once against a live database that already has data (local + Railway
-- both need this — schema.sql itself is NOT safe to re-run against them,
-- it drops and recreates every table).
--
-- Set to 1 when a Deputy Manager / Senior Specialist issues a temporary
-- password from the Admin page; the user is then forced to choose their own
-- password at next login, so the admin never keeps knowing it.

ALTER TABLE users
    ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'set when an admin issues a temporary password; cleared when the user chooses a new one'
    AFTER email_verified;
