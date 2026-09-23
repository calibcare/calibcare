-- One-time cleanup: "AC Curent" is a typo of "AC Current" in the source
-- Excel register (32 capability rows use the typo, only 4 use the correct
-- spelling). Left as two separate strings, a purpose dropdown would show
-- both as if they were different measurement purposes, and matching
-- against one would silently miss equipment recorded under the other.
--
-- Run once against a live database that already has data (local + Railway
-- both need this -- schema.sql itself is NOT safe to re-run against them).

UPDATE equipment_capability
SET measurement_purpose = 'AC Current'
WHERE measurement_purpose = 'AC Curent';
