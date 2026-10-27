-- One-time migration: reminders now go out only 30 days, 7 days and
-- 1 day before the due date (was 30/14/7 days, due today, and overdue).
-- Run once against a live database (local + Railway both need this,
-- BEFORE deploying the backend that sends '1_day' reminders -- without it
-- the notification_log insert for a 1-day reminder fails).

-- 1. notification_log: allow '1_day'. The old values stay so the existing
--    reminder history keeps its rows.
ALTER TABLE notification_log
    MODIFY notification_type ENUM('30_days', '14_days', '7_days', 'due', 'overdue', '1_day') NOT NULL;

-- 2. reminder_rule: add the 1-day rule, remove the three retired rules.
--    The new 1-day rule takes over the old "due today" rule's channel
--    settings (its closest equivalent), falling back to LINE only.
ALTER TABLE reminder_rule
    MODIFY bucket ENUM('30_days', '14_days', '7_days', 'due', 'overdue', '1_day') NOT NULL;

INSERT IGNORE INTO reminder_rule (bucket, enabled, send_line, send_email)
SELECT '1_day', 1,
       COALESCE((SELECT send_line  FROM reminder_rule WHERE bucket = 'due'), 1),
       COALESCE((SELECT send_email FROM reminder_rule WHERE bucket = 'due'), 0);

DELETE FROM reminder_rule WHERE bucket IN ('14_days', 'due', 'overdue');

ALTER TABLE reminder_rule
    MODIFY bucket ENUM('30_days', '7_days', '1_day') NOT NULL;
