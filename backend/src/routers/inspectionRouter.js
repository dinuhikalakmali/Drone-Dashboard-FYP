import express from 'express';
import Inspection from '../models/Inspection.js';
import { validateInspection } from '../middleware/validateInspection.js';

const router = express.Router();

router.post('/', validateInspection, async (req, res) => {
  try {
    const inspection = await Inspection.create({
      drone_id: req.body.drone_id.trim(),
      battery_level: req.body.battery_level,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
    });

    return res.status(201).json({
      success: true,
      data: inspection,
    });
  } catch (error) {
    console.error('Error creating inspection:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating inspection',
    });
  }
});

export default router;
