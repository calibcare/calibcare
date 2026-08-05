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
DROP TABLE IF EXISTS users;

-- ---------------------------------------------------------------------
-- users: system logins (Objective: Login / role-based access)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    user_id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name      VARCHAR(150)    NOT NULL,
    email          VARCHAR(150)    NOT NULL,
    password_hash  VARCHAR(255)    NOT NULL,
    role           ENUM('admin', 'engineer', 'qa', 'manager') NOT NULL DEFAULT 'engineer',
    line_user_id   VARCHAR(64)     NULL COMMENT 'LINE Messaging API user id, for targeted reminders',
    created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_email (email)
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
    location         VARCHAR(150)    NULL     COMMENT 'สถานที่ (branch / custodian, as free text in source)',
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
    certificate_path        VARCHAR(255)  NULL COMMENT 'uploaded calibration certificate file',
    notes                   VARCHAR(255)  NULL,
    created_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_calibration_equipment
        FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id)
        ON DELETE CASCADE,
    KEY idx_calibration_next_due (next_calibration_date)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- notification_log: record of reminders sent via LINE OA
-- (Objective 2: 30/14/7-day, due, and overdue reminders)
-- ---------------------------------------------------------------------
CREATE TABLE notification_log (
    notification_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    calibration_id     INT UNSIGNED  NOT NULL,
    user_id            INT UNSIGNED  NULL COMMENT 'recipient; NULL if broadcast',
    notification_type ENUM('30_days', '14_days', '7_days', 'due', 'overdue') NOT NULL,
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
