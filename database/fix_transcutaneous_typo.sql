-- One-time cleanup: "Transcutanreous" is a typo of "Transcutaneous" in the
-- source Excel register (equipment 15 and 16, the two Impulse7000DP
-- analyzers). The name appears in LINE/email reminder messages, so it is
-- fixed in the database rather than left as-is.
--
-- Run once against a live database that already has data (local + Railway
-- both need this -- schema.sql itself is NOT safe to re-run against them).
-- seed_data.sql still carries the typo (it's generated from the Excel), so
-- re-run this after any reload from scratch.

UPDATE equipment
SET name = REPLACE(name, 'Transcutanreous', 'Transcutaneous')
WHERE name LIKE '%Transcutanreous%';
