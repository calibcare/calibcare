-- One-time migration: adds the reminder_rule table to an existing
-- database. Run once against a live database that already has data
-- (local + Railway both need this -- schema.sql itself is NOT safe to
-- re-run against them, it drops and recreates every table).
--
-- reminder_rule holds one row per bucket pickBucket() (reminderService.js)
-- can produce -- a per-bucket on/off switch plus which channels (LINE,
-- email) it sends on. Deputy-Manager-editable via PATCH
-- /api/reminders/rules/:bucket; everything else just reads it.
--
-- Seeded to exactly today's real behavior (every bucket enabled, LINE
-- only) so running this migration changes nothing on its own -- it only
-- takes effect once a Deputy Manager actually changes a rule.

CREATE TABLE IF NOT EXISTS reminder_rule (
    bucket      ENUM('30_days', '14_days', '7_days', 'due', 'overdue') NOT NULL PRIMARY KEY,
    enabled     TINYINT(1)    NOT NULL DEFAULT 1,
    send_line   TINYINT(1)    NOT NULL DEFAULT 1,
    send_email  TINYINT(1)    NOT NULL DEFAULT 0,
    updated_by  INT UNSIGNED  NULL COMMENT 'Deputy Manager who last changed this rule',
    updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_reminder_rule_user
        FOREIGN KEY (updated_by) REFERENCES users(user_id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT IGNORE INTO reminder_rule (bucket, enabled, send_line, send_email) VALUES
    ('30_days', 1, 1, 0),
    ('14_days', 1, 1, 0),
    ('7_days',  1, 1, 0),
    ('due',     1, 1, 0),
    ('overdue', 1, 1, 0);
