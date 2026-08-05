import { Router } from 'express';
import { pool } from '../db.js';
import { requireRole } from '../middleware/auth.js';

export const equipmentRouter = Router();

const VALID_STATUSES = ['active', 'under_maintenance', 'decommissioned', 'sent_for_calibration'];
const canManage = requireRole('admin', 'engineer');

// GET /api/equipment?q=<search>&status=<status>&limit=&offset=
// Search matches name, model, serial_number, or location (case-insensitive substring).
equipmentRouter.get('/', async (req, res, next) => {
  try {
    const { q, status, limit = 50, offset = 0 } = req.query;

    const where = [];
    const params = [];

    if (q) {
      where.push('(name LIKE ? OR model LIKE ? OR serial_number LIKE ? OR location LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` });
      }
      where.push('status = ?');
      params.push(status);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const safeLimit = Math.min(Number(limit) || 50, 200);
    const safeOffset = Math.max(Number(offset) || 0, 0);

    const [rows] = await pool.query(
      `SELECT * FROM equipment ${whereSql} ORDER BY equipment_no ASC LIMIT ? OFFSET ?`,
      [...params, safeLimit, safeOffset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM equipment ${whereSql}`, params);

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
    const [latestCalibration] = await pool.query(
      `SELECT * FROM calibration_history WHERE equipment_id = ?
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

    const editable = ['name', 'model', 'manufacturer', 'serial_number', 'category', 'location', 'status', 'status_note', 'remarks'];
    const updates = [];
    const params = [];

    for (const field of editable) {
      if (req.body[field] !== undefined) {
        if (field === 'status' && !VALID_STATUSES.includes(req.body.status)) {
          return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` });
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
      `SELECT * FROM calibration_history WHERE equipment_id = ?
       ORDER BY calibration_date DESC, calibration_id DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/equipment/:id/calibrations -- record a new calibration event.
equipmentRouter.post('/:id/calibrations', canManage, async (req, res, next) => {
  try {
    const [equipmentRows] = await pool.query('SELECT equipment_id FROM equipment WHERE equipment_id = ?', [req.params.id]);
    if (equipmentRows.length === 0) {
      return res.status(404).json({ error: 'equipment not found' });
    }

    const { responsible_person, calibration_frequency, calibration_date, next_calibration_date, certificate_path, notes } = req.body;
    if (!calibration_date) {
      return res.status(400).json({ error: 'calibration_date is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO calibration_history
        (equipment_id, responsible_person, calibration_frequency, calibration_date, next_calibration_date, certificate_path, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, responsible_person || null, calibration_frequency || null, calibration_date,
        next_calibration_date || null, certificate_path || null, notes || null]
    );

    const [rows] = await pool.query('SELECT * FROM calibration_history WHERE calibration_id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/equipment/:id/calibrations/:calibrationId -- correct a record (partial update).
equipmentRouter.put('/:id/calibrations/:calibrationId', canManage, async (req, res, next) => {
  try {
    const [existing] = await pool.query(
      'SELECT * FROM calibration_history WHERE calibration_id = ? AND equipment_id = ?',
      [req.params.calibrationId, req.params.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'calibration record not found for this equipment' });
    }

    const editable = ['responsible_person', 'calibration_frequency', 'calibration_date', 'next_calibration_date', 'certificate_path', 'notes'];
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

    params.push(req.params.calibrationId);
    await pool.query(`UPDATE calibration_history SET ${updates.join(', ')} WHERE calibration_id = ?`, params);

    const [rows] = await pool.query('SELECT * FROM calibration_history WHERE calibration_id = ?', [req.params.calibrationId]);
    res.json(rows[0]);
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
