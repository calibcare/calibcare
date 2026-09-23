-- One-time migration: replaces the abstract account roles
-- (admin/engineer/qa/manager) with the real engineering job positions,
-- which now double as the access levels. See
-- backend/src/services/positions.js for the ranking and what each level
-- can do.
--
-- Run once against a live database that already has data (local + Railway
-- both need this -- schema.sql itself is NOT safe to re-run against them,
-- it drops and recreates every table).
--
-- Done in three steps so existing rows are never invalid mid-migration:
-- widen the ENUM to a superset, remap the values, then narrow it to the
-- final five. The mapping preserves each account's CURRENT capability
-- exactly -- admin could edit and run reminders (-> Deputy Manager),
-- engineer could edit (-> Senior Specialist), and qa/manager were already
-- view-only (-> Specialist 1).

ALTER TABLE users
    MODIFY COLUMN role ENUM(
        'admin', 'engineer', 'qa', 'manager',
        'deputy_manager', 'senior_specialist', 'specialist_1_pm', 'specialist_1', 'specialist_2'
    ) NOT NULL DEFAULT 'engineer';

UPDATE users SET role = 'deputy_manager'    WHERE role = 'admin';
UPDATE users SET role = 'senior_specialist' WHERE role = 'engineer';
UPDATE users SET role = 'specialist_1'      WHERE role IN ('qa', 'manager');

ALTER TABLE users
    MODIFY COLUMN role ENUM(
        'deputy_manager', 'senior_specialist', 'specialist_1_pm', 'specialist_1', 'specialist_2'
    ) NOT NULL DEFAULT 'specialist_2'
    COMMENT 'engineering position; doubles as the access level -- see backend/src/services/positions.js';
