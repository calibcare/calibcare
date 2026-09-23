-- One-time migration: replaces calibration_history.certificate_path (a
-- free-text file name/path/link, never actually populated -- confirmed
-- zero non-empty values across all real rows before writing this) with
-- real PDF storage, directly in MySQL.
--
-- No separate file storage service (S3, Cloudinary, etc.) -- confirmed
-- with the user: Railway's filesystem is wiped on every redeploy, so
-- saving to disk there would silently lose every certificate. Storing the
-- PDF bytes as a LONGBLOB works identically locally and on Railway and
-- needs no new account/credentials.
--
-- Run once against a live database that already has data (local + Railway
-- both need this -- schema.sql itself is NOT safe to re-run against them).

ALTER TABLE calibration_history
    DROP COLUMN certificate_path,
    ADD COLUMN certificate_filename  VARCHAR(255)  NULL COMMENT 'original filename of the uploaded certificate PDF',
    ADD COLUMN certificate_mime_type VARCHAR(100)  NULL COMMENT 'always application/pdf today, kept for future formats',
    ADD COLUMN certificate_size      INT UNSIGNED  NULL COMMENT 'bytes, for display without decoding the blob',
    ADD COLUMN certificate_data      LONGBLOB      NULL COMMENT 'the certificate PDF itself, stored in MySQL -- no separate file storage service, survives Railway redeploys';
