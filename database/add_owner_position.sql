-- One-time migration: adds the 'owner' position ("Admin - System Owner"),
-- ranked above Deputy Manager -- see backend/src/services/positions.js.
-- Run once against a live database (local + Railway both need this).
--
-- Order matters on a live system:
--   1. this ALTER (harmless on its own -- nobody holds 'owner' yet)
--   2. deploy the backend that knows the 'owner' position
--   3. the UPDATE below -- before step 2, an 'owner' row would be an
--      unknown position to the old code and would lose all access.

ALTER TABLE users
    MODIFY role ENUM('owner', 'deputy_manager', 'senior_specialist', 'specialist_1_pm', 'specialist_1', 'specialist_2')
        NOT NULL DEFAULT 'specialist_2'
        COMMENT 'engineering position; doubles as the access level -- see backend/src/services/positions.js';

-- Step 3 (run only after the new backend is live):
-- UPDATE users SET role = 'owner' WHERE email = 'ninedenim0@gmail.com';
