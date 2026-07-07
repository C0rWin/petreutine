import { NextFunction, Request, Response, Router } from 'express';

import { query } from '../db/index.js';
import { feedbackSchema } from '../types/index.js';

const router = Router();

// Public: submit a contact/feedback message. Stored for the admin panel.
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, message } = feedbackSchema.parse(req.body);
    await query('INSERT INTO feedback (name, email, message) VALUES ($1, $2, $3)', [
      name?.trim() || null,
      email?.trim() || null,
      message.trim(),
    ]);
    res.status(201).json({ success: true, message: 'Спасибо! Ваше сообщение отправлено.' });
  } catch (error) {
    next(error);
  }
});

export default router;
