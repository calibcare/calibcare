-- One-time data enrichment: adds `location_category` to equipment and
-- backfills it from the existing `location` free text. `location` itself
-- is left completely untouched -- still shown as-is everywhere it already
-- is (equipment table, detail page) -- location_category exists purely to
-- power a clean 7-option location filter, replacing a dropdown that would
-- otherwise show all 46 distinct raw location strings.
--
-- Real site names, confirmed with the user: Head office, Central, Chiang
-- Mai Branch, Hat Yai Branch, KhonKaen Branch, QA Team, Workshop room.
-- Everything under "Head office" that carries a person's name/date in
-- parentheses (e.g. "Head office(K.Anupong)") is a sub-unit of Head
-- office, not a separate site -- same idea for "Central(25/4/23)" and the
-- "Hatyai Branch" spelling variant under Hat Yai Branch.
--
-- Run once against a live database that already has data (local + Railway
-- both need this -- schema.sql itself is NOT safe to re-run against them).
-- Mapping verified against the real 163 rows before running: every
-- distinct location value matched exactly one of the 7 categories below,
-- nothing left unmapped.

ALTER TABLE equipment
    ADD COLUMN location_category VARCHAR(50) NULL
    COMMENT 'one of 7 real sites (Head office/Central/Chiang Mai Branch/Hat Yai Branch/KhonKaen Branch/QA Team/Workshop room), derived from `location` -- see this file. Powers the Equipment page location filter; `location` itself is untouched.'
    AFTER location;

UPDATE equipment SET location_category = 'Head office'      WHERE location LIKE 'Head office%';
UPDATE equipment SET location_category = 'Central'          WHERE location LIKE 'Central%';
UPDATE equipment SET location_category = 'Chiang Mai Branch' WHERE location LIKE 'Chiang Mai Branch%';
UPDATE equipment SET location_category = 'Hat Yai Branch'    WHERE location LIKE 'Hat Yai Branch%' OR location LIKE 'Hatyai Branch%';
UPDATE equipment SET location_category = 'KhonKaen Branch'  WHERE location LIKE 'KhonKaen Branch%';
UPDATE equipment SET location_category = 'QA Team'          WHERE location LIKE 'QA Team%';
UPDATE equipment SET location_category = 'Workshop room'    WHERE location LIKE 'Workshop room%';
