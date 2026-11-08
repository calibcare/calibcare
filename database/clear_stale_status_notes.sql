-- One-time cleanup (2026-11-08): clear status notes that no longer describe
-- the device's status, e.g. an Active device still noted "ส่งสอบเทียบ Aug 2026"
-- because its status changed before the backend cleared notes on a status
-- change. A note is kept only while it starts with the register's word for
-- the current status (same rule as statusText in
-- backend/src/services/registerExport.js).
UPDATE equipment
SET status_note = NULL
WHERE status_note IS NOT NULL
  AND NOT (
       (status = 'active'               AND TRIM(status_note) LIKE 'ปกติ%')
    OR (status = 'sent_for_calibration' AND (TRIM(status_note) LIKE 'ส่งสอบเทียบ%' OR TRIM(status_note) LIKE 'ส่งแคล%'))
    OR (status = 'under_maintenance'    AND TRIM(status_note) LIKE 'ชำรุด%')
    OR (status = 'decommissioned'       AND TRIM(status_note) LIKE 'ยกเลิกการใช้งาน%')
  );
