# Updating the database from a newer FP-ENG-05-01 register

The app's data has been edited since the first import (calibrations
recorded, statuses changed, typos fixed, certificates uploaded), so a new
register is never reloaded from scratch. Instead only what changed between
the previous register and the new one is applied:

1. `python3 parse.py <old.xlsx> old.json` and `python3 parse.py <new.xlsx> new.json`
2. `bash dbstate.sh <dir> <mysql connection args>` -- snapshot of the target database
3. `python3 merge.py <dir> old.json new.json update.sql` -- prints a report and writes one transaction
4. Back up the database (`mysqldump`), then `mysql <args> mcems < update.sql`

`merge.py` keeps the app's value whenever the app and the register both
changed the same field (listed as a conflict), skips calibrations the app
already has, removes/adds capabilities that moved, and inserts new
instruments (including extra units listed under an existing register
number, e.g. a Spot Light under a Prosim4). Status words: ปกติ = active,
ส่งแคล / ส่งสอบเทียบ = sent for calibration, ยกเลิกการใช้งาน = decommissioned,
ชำรุด = under maintenance.
