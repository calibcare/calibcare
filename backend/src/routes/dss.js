import { Router } from 'express';
import { pool } from '../db.js';
import { runDssMatch } from '../services/dssMatcher.js';

export const dssRouter = Router();

// GET /api/dss/purposes -- distinct measurement purposes, for building the
// requirement-entry form (so engineers pick from known values).
dssRouter.get('/purposes', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT DISTINCT measurement_purpose FROM equipment_capability ORDER BY measurement_purpose'
    );
    res.json(rows.map((r) => r.measurement_purpose));
  } catch (err) {
    next(err);
  }
});

// POST /api/dss/match
// body: { requirements: [{ measurement_purpose, min, max, unit }] }
dssRouter.post('/match', async (req, res, next) => {
  try {
    const { requirements } = req.body;

    if (!Array.isArray(requirements) || requirements.length === 0) {
      return res.status(400).json({ error: 'requirements must be a non-empty array' });
    }

    for (const r of requirements) {
      if (
        typeof r.measurement_purpose !== 'string' ||
        !r.measurement_purpose.trim() ||
        typeof r.min !== 'number' ||
        typeof r.max !== 'number' ||
        r.min > r.max
      ) {
        return res.status(400).json({
          error:
            'each requirement needs measurement_purpose (string), min (number), max (number) with min <= max',
        });
      }
    }

    const purposes = requirements.map((r) => r.measurement_purpose);
    const placeholders = purposes.map(() => '?').join(',');

    const [rows] = await pool.query(
      `SELECT e.equipment_id, e.equipment_no, e.name, e.model, e.serial_number,
              e.location, e.status,
              c.measurement_purpose, c.measurement_range, c.instrument_accuracy,
              c.product_operating_range, c.acceptance_criteria
       FROM equipment e
       JOIN equipment_capability c ON c.equipment_id = e.equipment_id
       WHERE e.status = 'active' AND c.measurement_purpose IN (${placeholders})`,
      purposes
    );

    const byEquipment = new Map();
    for (const row of rows) {
      if (!byEquipment.has(row.equipment_id)) {
        byEquipment.set(row.equipment_id, {
          equipment: {
            equipment_id: row.equipment_id,
            equipment_no: row.equipment_no,
            name: row.name,
            model: row.model,
            serial_number: row.serial_number,
            location: row.location,
            status: row.status,
          },
          capabilities: [],
        });
      }
      byEquipment.get(row.equipment_id).capabilities.push({
        measurement_purpose: row.measurement_purpose,
        measurement_range: row.measurement_range,
        instrument_accuracy: row.instrument_accuracy,
        product_operating_range: row.product_operating_range,
        acceptance_criteria: row.acceptance_criteria,
      });
    }

    const result = runDssMatch([...byEquipment.values()], requirements);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
