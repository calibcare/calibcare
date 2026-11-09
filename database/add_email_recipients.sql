-- One-time migration (2026-11-09): adds the email_recipient table to an
-- existing database. Run once against a live database that already has
-- data (local + Railway both need this -- schema.sql itself is NOT safe to
-- re-run against them, it drops and recreates every table).
--
-- email_recipient holds people who should get the calibration reminder
-- emails without having a CalibCare account -- only three staff use the
-- website itself, the rest of the engineering team just needs the
-- reminders. Managed from the Reminders page by the System Owner or a
-- Deputy Manager (canRunReminders); reminderService.js adds these
-- addresses to the email recipients of every reminder whose rule has
-- email turned on.
--
-- Starts empty, so running this migration changes nothing on its own.

CREATE TABLE IF NOT EXISTS email_recipient (
    recipient_id  INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    full_name     VARCHAR(150)  NULL,
    email         VARCHAR(150)  NOT NULL,
    added_by      INT UNSIGNED  NULL COMMENT 'user who added this address',
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_email_recipient_email (email),
    CONSTRAINT fk_email_recipient_user
        FOREIGN KEY (added_by) REFERENCES users(user_id)
        ON DELETE SET NULL
) ENGINE=InnoDB;
