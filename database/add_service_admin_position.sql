-- One-time migration: adds the 'service_admin' position ("Service Admin"),
-- ranked between the System Owner and Deputy Manager -- see
-- backend/src/services/positions.js. Service Admin, Deputy Manager and
-- Senior Specialist now share the same rights (edit, accounts, email-only
-- list, reminders and positions); that part is code-only, no SQL needed.
-- Run once against a live database (local + Railway both need this).
--
-- Order matters on a live system:
--   1. this ALTER (harmless on its own -- nobody holds 'service_admin' yet)
--   2. deploy the backend that knows the 'service_admin' position
--   3. only then give someone the position from the Team page -- before
--      step 2, a 'service_admin' row would be an unknown position to the
--      old code and would lose all access.

ALTER TABLE users
    MODIFY role ENUM('owner', 'service_admin', 'deputy_manager', 'senior_specialist', 'specialist_1_pm', 'specialist_1', 'specialist_2')
        NOT NULL DEFAULT 'specialist_2'
        COMMENT 'engineering position; doubles as the access level -- see backend/src/services/positions.js';
