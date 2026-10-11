import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db.js';
import { requireCapability } from '../middleware/auth.js';

export const equipmentRouter = Router();

const VALID_STATUSES = ['active', 'under_maintenance', 'decommissioned', 'sent_for_calibration'];
// The 7 real sites -- see database/add_location_category.sql for how the
// existing data was backfilled into these exact values.
const VALID_LOCATION_CATEGORIES = [
  'Head office',
  'Central',
  'Chiang Mai Branch',
  'Hat Yai Branch',
  'KhonKaen Branch',
  'QA Team',
  'Workshop room',
];
const canManage = requireCapability('canEdit');

// Certificates are stored as LONGBLOBs directly in MySQL, never written to
// disk -- Railway's filesystem is wiped on every redeploy, so memory
// storage (buffer straight into the DB column) is the only option that
// survives a deploy without a separate file-storage service.
const certificateUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter(req, file, cb) {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('certificate must be a PDF file'));
    }
    cb(null, true);
  },
}).single('certificate');

// Wraps multer's callback-style errors (wrong file type, too large) into
// the same next(err)-based flow every other route here uses, and makes
// the "no file attached" case a true no-op rather than a 400 -- a
// certificate has always been optional.
function handleCertificateUpload(req, res, next) {
  certificateUpload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}

// GET /api/equipment?q=<search>&status=<status>&location=<location>&location_category=<location_category>&limit=&offset=
// Search matches name, model, serial_number, or location (case-insensitive substring).
// `location` is an exact match on the raw free-text field; `location_category`
// is an exact match on the clean 7-site grouping (see
// database/add_location_category.sql) -- the Equipment page's location
// filter uses the latter, since the raw field has 46 distinct values.
// Each row also carries next_calibration_date, from its most recent
// calibration_history record (NULL if it has none yet) -- the list view
// needs this for a due-date column, the same "latest per equipment" join
// pattern dashboardService.js already uses for the dashboard.
equipmentRouter.get('/', async (req, res, next) => {
  try {
    const { q, status, location, location_category, limit = 50, offset = 0 } = req.query;

    const where = [];
    const params = [];

    if (q) {
      where.push('(e.name LIKE ? OR e.model LIKE ? OR e.serial_number LIKE ? OR e.location LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` });
      }
      where.push('e.status = ?');
      params.push(status);
    }
    if (location) {
      where.push('e.location = ?');
      params.push(location);
    }
    if (location_category) {
      where.push('e.location_category = ?');
      params.push(location_category);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const safeLimit = Math.min(Number(limit) || 50, 200);
    const safeOffset = Math.max(Number(offset) || 0, 0);

    const [rows] = await pool.query(
      `SELECT e.*, latest_ch.next_calibration_date
       FROM equipment e
       LEFT JOIN (
         SELECT ch.equipment_id, ch.next_calibration_date
         FROM calibration_history ch
         INNER JOIN (
           SELECT equipment_id, MAX(calibration_date) AS max_date
           FROM calibration_history GROUP BY equipment_id
         ) m ON m.equipment_id = ch.equipment_id AND m.max_date = ch.calibration_date
       ) latest_ch ON latest_ch.equipment_id = e.equipment_id
       ${whereSql}
       ORDER BY e.equipment_no ASC LIMIT ? OFFSET ?`,
      [...params, safeLimit, safeOffset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM equipment e ${whereSql}`, params);

    res.json({ total, limit: safeLimit, offset: safeOffset, equipment: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/equipment/:id -- one equipment record with its capabilities and
// most recent calibration record.
equipmentRouter.get('/:id', async (req, res, next) => {
  try {
    const [equipmentRows] = await pool.query('SELECT * FROM equipment WHERE equipment_id = ?', [req.params.id]);
    if (equipmentRows.length === 0) {
      return res.status(404).json({ error: 'equipment not found' });
    }

    const [capabilities] = await pool.query(
      'SELECT * FROM equipment_capability WHERE equipment_id = ? ORDER BY capability_id',
      [req.params.id]
    );
    // certificate_data is excluded here (and from the list endpoint below)
    // -- it's a PDF blob, not something every page load should carry just
    // to know a certificate exists; certificate_filename/size are enough
    // for the UI to offer a download link, fetched separately.
    const [latestCalibration] = await pool.query(
      `SELECT calibration_id, equipment_id, responsible_person, calibration_frequency, calibration_date,
              next_calibration_date, notes, created_at, certificate_filename, certificate_mime_type, certificate_size
       FROM calibration_history WHERE equipment_id = ?
       ORDER BY calibration_date DESC, calibration_id DESC LIMIT 1`,
      [req.params.id]
    );

    res.json({
      ...equipmentRows[0],
      capabilities,
      latest_calibration: latestCalibration[0] || null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/equipment -- register new equipment. equipment_no is
// auto-assigned as the next available register number (matches how the
// source spreadsheet's "เลขที่" column works).
equipmentRouter.post('/', canManage, async (req, res, next) => {
  try {
    const { name, model, manufacturer, serial_number, category, location, status, status_note, remarks } = req.body;

    if (!name || !serial_number) {
      return res.status(400).json({ error: 'name and serial_number are required' });
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` });
    }

    const [[{ next_no }]] = await pool.query('SELECT COALESCE(MAX(equipment_no), 0) + 1 AS next_no FROM equipment');

    const [result] = await pool.query(
      `INSERT INTO equipment
        (equipment_no, name, model, manufacturer, serial_number, category, location, status, status_note, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [next_no, name, model || null, manufacturer || null, serial_number, category || null, location || null,
        status || 'active', status_note || null, remarks || null]
    );

    const [rows] = await pool.query('SELECT * FROM equipment WHERE equipment_id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/equipment/:id -- partial update; only fields present in the body are changed.
equipmentRouter.put('/:id', canManage, async (req, res, next) => {
  try {
    const [existing] = await pool.query('SELECT * FROM equipment WHERE equipment_id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'equipment not found' });
    }

    const editable = ['name', 'model', 'manufacturer', 'serial_number', 'category', 'location', 'location_category', 'status', 'status_note', 'remarks'];
    const updates = [];
    const params = [];

    for (const field of editable) {
      if (req.body[field] !== undefined) {
        if (field === 'status' && !VALID_STATUSES.includes(req.body.status)) {
          return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` });
        }
        if (field === 'location_category' && req.body.location_category && !VALID_LOCATION_CATEGORIES.includes(req.body.location_category)) {
          return res.status(400).json({ error: `location_category must be one of ${VALID_LOCATION_CATEGORIES.join(', ')}` });
        }
        updates.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'no editable fields provided' });
    }

    params.push(req.params.id);
    await pool.query(`UPDATE equipment SET ${updates.join(', ')} WHERE equipment_id = ?`, params);

    const [rows] = await pool.query('SELECT * FROM equipment WHERE equipment_id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/equipment/:id -- also removes its capabilities and calibration
// history via ON DELETE CASCADE (set up in schema.sql).
equipmentRouter.delete('/:id', canManage, async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM equipment WHERE equipment_id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'equipment not found' });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /api/equipment/:id/capabilities -- add a measurement capability.
equipmentRouter.post('/:id/capabilities', canManage, async (req, res, next) => {
  try {
    const [equipmentRows] = await pool.query('SELECT equipment_id FROM equipment WHERE equipment_id = ?', [req.params.id]);
    if (equipmentRows.length === 0) {
      return res.status(404).json({ error: 'equipment not found' });
    }

    const { measurement_purpose, measurement_range, instrument_accuracy, product_operating_range, acceptance_criteria } = req.body;
    if (!measurement_purpose) {
      return res.status(400).json({ error: 'measurement_purpose is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO equipment_capability
        (equipment_id, measurement_purpose, measurement_range, instrument_accuracy, product_operating_range, acceptance_criteria)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.id, measurement_purpose, measurement_range || null, instrument_accuracy || null,
        product_operating_range || null, acceptance_criteria || null]
    );

    const [rows] = await pool.query('SELECT * FROM equipment_capability WHERE capability_id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/equipment/:id/capabilities/:capabilityId
equipmentRouter.put('/:id/capabilities/:capabilityId', canManage, async (req, res, next) => {
  try {
    const [existing] = await pool.query(
      'SELECT * FROM equipment_capability WHERE capability_id = ? AND equipment_id = ?',
      [req.params.capabilityId, req.params.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'capability not found for this equipment' });
    }

    const editable = ['measurement_purpose', 'measurement_range', 'instrument_accuracy', 'product_operating_range', 'acceptance_criteria'];
    const updates = [];
    const params = [];
    for (const field of editable) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'no editable fields provided' });
    }

    params.push(req.params.capabilityId);
    await pool.query(`UPDATE equipment_capability SET ${updates.join(', ')} WHERE capability_id = ?`, params);

    const [rows] = await pool.query('SELECT * FROM equipment_capability WHERE capability_id = ?', [req.params.capabilityId]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/equipment/:id/capabilities/:capabilityId
equipmentRouter.delete('/:id/capabilities/:capabilityId', canManage, async (req, res, next) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM equipment_capability WHERE capability_id = ? AND equipment_id = ?',
      [req.params.capabilityId, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'capability not found for this equipment' });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /api/equipment/:id/calibrations -- full calibration timeline, most recent first.
equipmentRouter.get('/:id/calibrations', async (req, res, next) => {
  try {
    const [equipmentRows] = await pool.query('SELECT equipment_id FROM equipment WHERE equipment_id = ?', [req.params.id]);
    if (equipmentRows.length === 0) {
      return res.status(404).json({ error: 'equipment not found' });
    }

    const [rows] = await pool.query(
      `SELECT calibration_id, equipment_id, responsible_person, calibration_frequency, calibration_date,
              next_calibration_date, notes, created_at, certificate_filename, certificate_mime_type, certificate_size
       FROM calibration_history WHERE equipment_id = ?
       ORDER BY calibration_date DESC, calibration_id DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/equipment/:id/calibrations -- record a new calibration event.
// multipart/form-data with an optional `certificate` PDF field; every other
// field arrives in req.body exactly as multer parses multipart text fields
// (same shape express.json() gave this handler before).
equipmentRouter.post('/:id/calibrations', canManage, handleCertificateUpload, async (req, res, next) => {
  try {
    const [equipmentRows] = await pool.query('SELECT equipment_id FROM equipment WHERE equipment_id = ?', [req.params.id]);
    if (equipmentRows.length === 0) {
      return res.status(404).json({ error: 'equipment not found' });
    }

    const { responsible_person, calibration_frequency, calibration_date, next_calibration_date, notes } = req.body;
    if (!calibration_date) {
      return res.status(400).json({ error: 'calibration_date is required' });
    }

    const cert = req.file;
    const [result] = await pool.query(
      // Fixed 1-year cycle: if the caller doesn't send a next due date,
      // derive it from the calibration date (the web form always sends the
      // same +1 year value, computed client-side for display).
      `INSERT INTO calibration_history
        (equipment_id, responsible_person, calibration_frequency, calibration_date, next_calibration_date, notes,
         certificate_filename, certificate_mime_type, certificate_size, certificate_data)
       VALUES (?, ?, ?, ?, COALESCE(?, DATE_ADD(?, INTERVAL 1 YEAR)), ?, ?, ?, ?, ?)`,
      [req.params.id, responsible_person || null, calibration_frequency || '1 ปี', calibration_date,
        next_calibration_date || null, calibration_date, notes || null,
        cert ? cert.originalname : null, cert ? cert.mimetype : null, cert ? cert.size : null, cert ? cert.buffer : null]
    );

    const [rows] = await pool.query(
      `SELECT calibration_id, equipment_id, responsible_person, calibration_frequency, calibration_date,
              next_calibration_date, notes, created_at, certificate_filename, certificate_mime_type, certificate_size
       FROM calibration_history WHERE calibration_id = ?`,
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/equipment/:id/calibrations/:calibrationId -- correct a record
// (partial update); also accepts multipart/form-data to replace the
// certificate, same as POST above.
equipmentRouter.put('/:id/calibrations/:calibrationId', canManage, handleCertificateUpload, async (req, res, next) => {
  try {
    const [existing] = await pool.query(
      'SELECT calibration_id FROM calibration_history WHERE calibration_id = ? AND equipment_id = ?',
      [req.params.calibrationId, req.params.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'calibration record not found for this equipment' });
    }

    const editable = ['responsible_person', 'calibration_frequency', 'calibration_date', 'next_calibration_date', 'notes'];
    const updates = [];
    const params = [];
    for (const field of editable) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    }
    if (req.file) {
      updates.push('certificate_filename = ?', 'certificate_mime_type = ?', 'certificate_size = ?', 'certificate_data = ?');
      params.push(req.file.originalname, req.file.mimetype, req.file.size, req.file.buffer);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'no editable fields provided' });
    }

    params.push(req.params.calibrationId);
    await pool.query(`UPDATE calibration_history SET ${updates.join(', ')} WHERE calibration_id = ?`, params);

    const [rows] = await pool.query(
      `SELECT calibration_id, equipment_id, responsible_person, calibration_frequency, calibration_date,
              next_calibration_date, notes, created_at, certificate_filename, certificate_mime_type, certificate_size
       FROM calibration_history WHERE calibration_id = ?`,
      [req.params.calibrationId]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/equipment/:id/calibrations/:calibrationId/certificate -- streams
// the stored PDF back. Read-only, so gated only by the router's requireAuth
// (mounted in server.js), same as every other read in this app.
equipmentRouter.get('/:id/calibrations/:calibrationId/certificate', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT certificate_filename, certificate_mime_type, certificate_data
       FROM calibration_history WHERE calibration_id = ? AND equipment_id = ?`,
      [req.params.calibrationId, req.params.id]
    );
    if (rows.length === 0 || !rows[0].certificate_data) {
      return res.status(404).json({ error: 'no certificate on this calibration record' });
    }

    const cert = rows[0];
    res.set('Content-Type', cert.certificate_mime_type || 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${cert.certificate_filename || 'certificate.pdf'}"`);
    res.send(cert.certificate_data);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/equipment/:id/calibrations/:calibrationId -- for correcting mis-entered records.
equipmentRouter.delete('/:id/calibrations/:calibrationId', canManage, async (req, res, next) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM calibration_history WHERE calibration_id = ? AND equipment_id = ?',
      [req.params.calibrationId, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'calibration record not found for this equipment' });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
