# usage: dbstate.sh <mysql args...>  -> TSV dumps of equipment and calibration_history
OUT=$1; shift
mysql "$@" mcems -B -e "SELECT equipment_id, equipment_no, name, model, serial_number, location, location_category, status, status_note, remarks, category, manufacturer FROM equipment ORDER BY equipment_id" > $OUT/eq.tsv
mysql "$@" mcems -B -e "SELECT calibration_id, equipment_id, calibration_date, next_calibration_date, responsible_person, calibration_frequency, created_at, certificate_filename IS NOT NULL AS has_cert FROM calibration_history ORDER BY calibration_id" > $OUT/cal.tsv
mysql "$@" mcems -B -e "SELECT capability_id, equipment_id, measurement_purpose, measurement_range FROM equipment_capability ORDER BY capability_id" > $OUT/cap.tsv
wc -l $OUT/*.tsv
