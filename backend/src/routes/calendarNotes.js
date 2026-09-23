import { Router } from 'express';
import { pool } from '../db.js';
import { requireCapability } from '../middleware/auth.js';

export const calendarNotesRouter = Router();

const canManage = requireCapability('canEdit');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/calendar-notes -- all shared calendar notes (expected volume is
// small, manual annotations only, so no month filtering is needed).
calendarNotesRouter.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT note_date, note_text, updated_at FROM calendar_note');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// PUT /api/calendar-notes/:date -- create or update the note for a date.
calendarNotesRouter.put('/:date', canManage, async (req, res, next) => {
  try {
    const { date } = req.params;
    const { note_text } = req.body;

    if (!DATE_RE.test(date)) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    }
    if (!note_text || !note_text.trim()) {
      return res.status(400).json({ error: 'note_text is required' });
    }

    await pool.query(
      `INSERT INTO calendar_note (note_date, note_text, updated_by) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE note_text = VALUES(note_text), updated_by = VALUES(updated_by)`,
      [date, note_text.trim(), req.user.user_id]
    );

    res.json({ note_date: date, note_text: note_text.trim() });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/calendar-notes/:date -- remove the note for a date, if any.
calendarNotesRouter.delete('/:date', canManage, async (req, res, next) => {
  try {
    const { date } = req.params;
    if (!DATE_RE.test(date)) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    }

    await pool.query('DELETE FROM calendar_note WHERE note_date = ?', [date]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
