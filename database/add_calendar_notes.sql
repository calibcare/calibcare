-- One-time migration: adds the calendar_note table to an existing database.
-- Run once against a live database that already has data (local + Railway
-- both need this -- schema.sql itself is NOT safe to re-run against them,
-- it drops and recreates every table).
--
-- calendar_note is a shared, free-text annotation on a calendar day, shown
-- on the Dashboard page's calendar widget -- independent of equipment data,
-- e.g. "technician on leave". One note per date, visible to everyone.

CREATE TABLE IF NOT EXISTS calendar_note (
    note_date   DATE          NOT NULL PRIMARY KEY COMMENT 'the calendar day this note is attached to',
    note_text   TEXT          NOT NULL,
    updated_by  INT UNSIGNED  NULL COMMENT 'user who last wrote this note',
    updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_calendar_note_user
        FOREIGN KEY (updated_by) REFERENCES users(user_id)
        ON DELETE SET NULL
) ENGINE=InnoDB;
