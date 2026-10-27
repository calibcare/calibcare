-- =====================================================================
-- CalibCare — Medical Calibration Equipment Management System
-- Database Schema
--
-- Source of truth for this schema: 00 FP-ENG-05-01 Rev.02
-- "ทะเบียนควบคุมและประวัติการสอบเทียบเครื่องมือวัด" (equipment calibration
-- register). Each row in that spreadsheet is one (equipment, capability)
-- pair -- equipment fields (name/model/serial/location/status) are only
-- filled on the first row of a group, and repeat implicitly for every
-- additional measurement-purpose row underneath it. This schema
-- normalizes that into equipment (1) -> (N) equipment_capability.
--
-- Import into MySQL Workbench:
--   Database > Reverse Engineer... > pick this .sql file
-- or run directly:
--   mysql -u root -p < schema.sql
-- =====================================================================

CREATE DATABASE IF NOT EXISTS mcems
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE mcems;

-- Idempotent: drop children before parents so this script can be re-run.
DROP TABLE IF EXISTS notification_log;
DROP TABLE IF EXISTS calibration_history;
DROP TABLE IF EXISTS equipment_capability;
DROP TABLE IF EXISTS equipment;
DROP TABLE IF EXISTS calendar_note;
DROP TABLE IF EXISTS reminder_rule;
DROP TABLE IF EXISTS users;

-- ---------------------------------------------------------------------
-- users: system logins (Objective: Login / role-based access)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    user_id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name      VARCHAR(150)    NOT NULL,
    email          VARCHAR(150)    NOT NULL,
    password_hash  VARCHAR(255)    NOT NULL,
    role           ENUM('deputy_manager', 'senior_specialist', 'specialist_1_pm', 'specialist_1', 'specialist_2')
                                   NOT NULL DEFAULT 'specialist_2' COMMENT 'engineering position; doubles as the access level -- see backend/src/services/positions.js',
    line_user_id   VARCHAR(64)     NULL COMMENT 'LINE Messaging API user id, for targeted reminders',
    email_verified TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'set true once the registration email-OTP is confirmed; login is blocked until then',
    must_change_password TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'set when an admin issues a temporary password; cleared when the user chooses a new one',
    created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- calendar_note: a shared, free-text annotation on a calendar day, shown
-- on the Dashboard page's calendar widget. Independent of equipment data --
-- e.g. "technician on leave" -- one note per date, visible to everyone.
-- ---------------------------------------------------------------------
CREATE TABLE calendar_note (
    note_date   DATE          NOT NULL PRIMARY KEY COMMENT 'the calendar day this note is attached to',
    note_text   TEXT          NOT NULL,
    updated_by  INT UNSIGNED  NULL COMMENT 'user who last wrote this note',
    updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_calendar_note_user
        FOREIGN KEY (updated_by) REFERENCES users(user_id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- equipment: one row per physical calibration instrument
-- (เลขที่ / ชื่อเครื่องมือวัด / รุ่นเครื่องมือวัด / หมายเลขเครื่อง / สถานที่ / สถานะ / หมายเหตุ)
-- ---------------------------------------------------------------------
CREATE TABLE equipment (
    equipment_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    equipment_no     INT UNSIGNED    NOT NULL COMMENT 'เลขที่ - running register number from the source sheet',
    name             VARCHAR(150)    NOT NULL COMMENT 'ชื่อเครื่องมือวัด',
    model            VARCHAR(100)    NULL     COMMENT 'รุ่นเครื่องมือวัด',
    manufacturer     VARCHAR(100)    NULL     COMMENT 'not tracked in the source sheet yet; reserved per Objective 1',
    serial_number    VARCHAR(100)    NOT NULL COMMENT 'หมายเลขเครื่อง',
    category         VARCHAR(100)    NULL     COMMENT 'derived grouping for dashboard "by category" widget',
    location         VARCHAR(150)    NULL     COMMENT 'สถานที่ (branch / custodian, as free text in source) -- unchanged, kept exactly as sourced',
    location_category VARCHAR(50)    NULL     COMMENT 'one of 7 real sites (Head office/Central/Chiang Mai Branch/Hat Yai Branch/KhonKaen Branch/QA Team/Workshop room), derived from `location` -- see database/add_location_category.sql. Powers the Equipment page location filter; `location` itself is untouched and still shown on the table/detail pages.',
    status           ENUM('active', 'under_maintenance', 'decommissioned', 'sent_for_calibration')
                                     NOT NULL DEFAULT 'active' COMMENT 'normalized from สถานะ',
    status_note      VARCHAR(255)    NULL     COMMENT 'original free-text สถานะ value, e.g. "ยกเลิกการใช้งาน 1/25"',
    remarks          TEXT            NULL     COMMENT 'หมายเหตุ',
    created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_equipment_serial (serial_number),
    KEY idx_equipment_status (status),
    KEY idx_equipment_no (equipment_no)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- equipment_capability: measurement capabilities of an instrument.
-- This is exactly the table the Decision Support System (DSS) queries
-- to match a requirement against equipment.
-- (จุดประสงค์ที่ใช้วัด / ช่วงในการวัด / ค่าผิดพลาด / ช่วงในการใช้งานของผลิตภัณฑ์ / เกณฑ์การยอมรับ)
-- ---------------------------------------------------------------------
CREATE TABLE equipment_capability (
    capability_id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    equipment_id             INT UNSIGNED  NOT NULL,
    measurement_purpose      VARCHAR(100)  NOT NULL COMMENT 'จุดประสงค์ที่ใช้วัด, e.g. Flow, Pressure, Oxygen',
    measurement_range        VARCHAR(100)  NULL     COMMENT 'ช่วงในการวัดของเครื่องมือวัด',
    instrument_accuracy      VARCHAR(100)  NULL     COMMENT 'ค่าผิดพลาดของเครื่องมือวัด',
    product_operating_range  VARCHAR(100)  NULL     COMMENT 'ช่วงในการใช้งานของผลิตภัณฑ์',
    acceptance_criteria      VARCHAR(100)  NULL     COMMENT 'เกณฑ์การยอมรับของผลิตภัณฑ์',
    created_at                TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_capability_equipment
        FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id)
        ON DELETE CASCADE,
    KEY idx_capability_purpose (measurement_purpose)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- calibration_history: one row per calibration event for an instrument.
-- The source sheet only shows the latest cycle (ครั้งล่าสุด/ครั้งต่อไป);
-- this table is append-only so history accumulates over time.
-- (ผู้รับผิดชอบ / ความถี่ในการสอบเทียบ / สอบเทียบครั้งล่าสุด / สอบเทียบครั้งต่อไป)
-- ---------------------------------------------------------------------
CREATE TABLE calibration_history (
    calibration_id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    equipment_id            INT UNSIGNED  NOT NULL,
    responsible_person      VARCHAR(100)  NULL COMMENT 'ผู้รับผิดชอบ',
    calibration_frequency   VARCHAR(50)   NULL COMMENT 'ความถี่ในการสอบเทียบ, e.g. "1 ปี"',
    calibration_date        DATE          NULL COMMENT 'สอบเทียบครั้งล่าสุด',
    next_calibration_date   DATE          NULL COMMENT 'สอบเทียบครั้งต่อไป',
    certificate_filename    VARCHAR(255)  NULL COMMENT 'original filename of the uploaded certificate PDF',
    certificate_mime_type   VARCHAR(100)  NULL COMMENT 'always application/pdf today, kept for future formats',
    certificate_size        INT UNSIGNED  NULL COMMENT 'bytes, for display without decoding the blob',
    certificate_data        LONGBLOB      NULL COMMENT 'the certificate PDF itself, stored in MySQL -- no separate file storage service, survives Railway redeploys',
    notes                   VARCHAR(255)  NULL,
    created_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_calibration_equipment
        FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id)
        ON DELETE CASCADE,
    KEY idx_calibration_next_due (next_calibration_date)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- reminder_rule: per-bucket on/off + channel switches for the reminder
-- system, one row per bucket pickBucket() (reminderService.js) can
-- produce. Deputy-Manager-editable; everything else reads it.
-- ---------------------------------------------------------------------
CREATE TABLE reminder_rule (
    bucket      ENUM('30_days', '7_days', '1_day') NOT NULL PRIMARY KEY,
    enabled     TINYINT(1)    NOT NULL DEFAULT 1,
    send_line   TINYINT(1)    NOT NULL DEFAULT 1,
    send_email  TINYINT(1)    NOT NULL DEFAULT 0,
    updated_by  INT UNSIGNED  NULL COMMENT 'Deputy Manager who last changed this rule',
    updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_reminder_rule_user
        FOREIGN KEY (updated_by) REFERENCES users(user_id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

-- Seed one row per bucket, matching the reminder system's real behavior
-- before this table existed (every bucket on, LINE only) -- a fresh load
-- of this schema should not silently change what gets sent.
INSERT INTO reminder_rule (bucket, enabled, send_line, send_email) VALUES
    ('30_days', 1, 1, 0),
    ('7_days',  1, 1, 0),
    ('1_day',   1, 1, 0);

-- ---------------------------------------------------------------------
-- notification_log: record of reminders sent via LINE OA
-- (Objective 2: 30/14/7-day, due, and overdue reminders)
-- ---------------------------------------------------------------------
CREATE TABLE notification_log (
    notification_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    calibration_id     INT UNSIGNED  NOT NULL,
    user_id            INT UNSIGNED  NULL COMMENT 'recipient; NULL if broadcast',
    notification_type ENUM('30_days', '14_days', '7_days', 'due', 'overdue', '1_day') NOT NULL COMMENT '14_days/due/overdue: retired buckets, kept for old history rows',
    channel            VARCHAR(30)   NOT NULL DEFAULT 'LINE',
    status             ENUM('sent', 'failed') NOT NULL DEFAULT 'sent',
    sent_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notification_calibration
        FOREIGN KEY (calibration_id) REFERENCES calibration_history(calibration_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_notification_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE SET NULL,
    KEY idx_notification_sent_at (sent_at)
) ENGINE=InnoDB;
