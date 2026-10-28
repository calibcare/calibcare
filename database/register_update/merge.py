"""Build the SQL that brings a CalibCare database up to the January 2026
register: apply only what changed between the old register (the original
import) and the new one, so edits made in the app since are kept.

usage: merge.py <db-state-dir> <old.json> <new.json> <out.sql>
"""
import csv, json, sys, collections

state, oldp, newp, outp = sys.argv[1:5]
old, new = json.load(open(oldp)), json.load(open(newp))
rows = lambda n: list(csv.DictReader(open(f"{state}/{n}.tsv"), delimiter="\t"))
N = lambda v: None if v in ("NULL", "") else v
eq, cal, cap = rows("eq"), rows("cal"), rows("cap")
db = {int(r["equipment_id"]): {k: N(v) for k, v in r.items()} for r in eq}
dbcal = collections.defaultdict(set)
for c in cal: dbcal[int(c["equipment_id"])].add(c["calibration_date"])
dbcap = collections.defaultdict(list)
for c in cap: dbcap[int(c["equipment_id"])].append((int(c["capability_id"]), N(c["measurement_purpose"]), N(c["measurement_range"])))

def q(v):
    if v is None: return "NULL"
    return "'" + str(v).replace("\\", "\\\\").replace("'", "\\'") + "'"

def status_of(raw):
    if not raw or raw.startswith("ปกติ"): return "active", None
    if raw.startswith("ยกเลิกการใช้งาน"): return "decommissioned", raw
    if raw.startswith("ส่งแคล") or raw.startswith("ส่งสอบเทียบ"): return "sent_for_calibration", raw
    if raw.startswith("ชำรุด"): return "under_maintenance", raw
    return "active", raw

SITES = [("Head office", ["Head office"]), ("Central", ["Central"]), ("Chiang Mai Branch", ["Chiang Mai Branch"]),
         ("Hat Yai Branch", ["Hat Yai Branch", "Hatyai Branch"]), ("KhonKaen Branch", ["KhonKaen Branch"]),
         ("QA Team", ["QA Team"]), ("Workshop room", ["Workshop room"])]
def site_of(loc):
    if not loc: return None
    for site, prefixes in SITES:
        if any(loc.lower().startswith(p.lower()) for p in prefixes): return site
    return None

# The original import gave equipment_id = position in the old register.
old_ids = {}
for i, e in enumerate(old, 1):
    r = db.get(i)
    assert r and r["equipment_no"] == e["no"] and r["serial_number"] == e["serial"], f"id {i} no longer matches register no {e['no']}"
    old_ids[e["no"]] = (i, e)

sql, report = ["START TRANSACTION;"], collections.defaultdict(list)
seen_no = collections.Counter()
parent_of = {}
for e in new:
    seen_no[e["no"]] += 1
    first = seen_no[e["no"]] == 1
    if first and e["no"] in old_ids:
        eid, o = old_ids[e["no"]]
        cur = db[eid]
        parent_of[e["no"]] = (eid, e)
        sets = {}
        for f, col in [("name", "name"), ("model", "model"), ("serial", "serial_number"), ("location", "location"), ("remarks", "remarks")]:
            if o[f] != e[f]:
                if cur[col] != o[f]: report["conflict (kept the app's value)"].append(f"No. {e['no']} {col}: app has {cur[col]!r}, register changed {o[f]!r} -> {e[f]!r}")
                else: sets[col] = e[f]
        if "location" in sets: sets["location_category"] = site_of(e["location"])
        if status_of(o["status"]) != status_of(e["status"]):
            want = status_of(e["status"])
            if cur["status"] != status_of(o["status"])[0]: report["conflict (kept the app's value)"].append(f"No. {e['no']} status: app has {cur['status']}, register changed {o['status']!r} -> {e['status']!r}")
            else: sets["status"], sets["status_note"] = want
        if sets:
            sql.append(f"UPDATE equipment SET {', '.join(f'{k} = {q(v)}' for k, v in sets.items())} WHERE equipment_id = {eid};")
            report["updated"].append(f"No. {e['no']} {e['name']} (S/N {e['serial']}): " + ", ".join(f"{k} -> {v}" for k, v in sets.items()))
        # capabilities that moved out (e.g. Percent Oxygen -> Spot Light) or in
        oc, nc = [tuple(c) for c in o["caps"]], [tuple(c) for c in e["caps"]]
        for c in oc:
            if c not in nc:
                ids = [cid for cid, p, rng in dbcap[eid] if p == c[0] and rng == c[1]]
                for cid in ids: sql.append(f"DELETE FROM equipment_capability WHERE capability_id = {cid};")
                report["capability removed"].append(f"No. {e['no']} {e['name']}: {c[0]} ({c[1]})")
        for c in nc:
            if c not in oc:
                sql.append(f"INSERT INTO equipment_capability (equipment_id, measurement_purpose, measurement_range, instrument_accuracy, product_operating_range, acceptance_criteria) VALUES ({eid}, {', '.join(q(x) for x in c)});")
                report["capability added"].append(f"No. {e['no']} {e['name']}: {c[0]}")
        for c in e["cals"]:
            if c in o["cals"]: continue
            if c[2] in dbcal[eid]: report["calibration already in the app"].append(f"No. {e['no']} {e['name']} (S/N {e['serial']}): {c[2]}"); continue
            sql.append(f"INSERT INTO calibration_history (equipment_id, responsible_person, calibration_frequency, calibration_date, next_calibration_date) VALUES ({eid}, {q(c[0])}, {q(c[1])}, {q(c[2])}, {q(c[3])});")
            report["calibration added"].append(f"No. {e['no']} {e['name']} (S/N {e['serial']}): calibrated {c[2]}, next due {c[3]}")
        continue
    # a new instrument: a new register number, or an extra unit listed under an existing number
    parent = parent_of.get(e["no"])
    name = e["name"] or (parent[1]["name"] if parent else None)
    like = next((r for r in db.values() if r["model"] == e["model"] and r["category"]), None) or (db[parent[0]] if parent else None) \
        or next((r for r in db.values() if r["name"] == name and r["category"]), None)
    status, note = status_of(e["status"])
    sql.append("INSERT INTO equipment (equipment_no, name, model, manufacturer, serial_number, category, location, location_category, status, status_note, remarks) VALUES "
               f"({e['no']}, {q(name)}, {q(e['model'])}, {q(like['manufacturer'] if like else None)}, {q(e['serial'])}, {q(like['category'] if like else None)}, "
               f"{q(e['location'])}, {q(site_of(e['location']))}, {q(status)}, {q(note)}, {q(e['remarks'])});")
    sql.append("SET @eid = LAST_INSERT_ID();")
    for c in e["caps"]:
        sql.append(f"INSERT INTO equipment_capability (equipment_id, measurement_purpose, measurement_range, instrument_accuracy, product_operating_range, acceptance_criteria) VALUES (@eid, {', '.join(q(x) for x in c)});")
    for c in e["cals"]:
        sql.append(f"INSERT INTO calibration_history (equipment_id, responsible_person, calibration_frequency, calibration_date, next_calibration_date) VALUES (@eid, {q(c[0])}, {q(c[1])}, {q(c[2])}, {q(c[3])});")
    report["new instrument"].append(f"No. {e['no']} {name} {e['model']} (S/N {e['serial']}), {e['location'] or 'no location'}, {status}, {len(e['caps'])} capabilities, "
                                    + (f"calibrated {e['cals'][0][2]}" if e["cals"] else "no calibration yet")
                                    + (f" -- extra unit under No. {e['no']}" if parent else "")
                                    + (f"; category/manufacturer copied from a {like['name']} {like['model']}" if like else ""))
sql.append("COMMIT;")
open(outp, "w").write("\n".join(sql) + "\n")
for k, v in report.items():
    print(f"\n## {k}: {len(v)}")
    for line in v: print("  -", line)
print(f"\n{len(sql) - 2} SQL statements -> {outp}")
