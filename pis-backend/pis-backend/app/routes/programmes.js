const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Programme = require('../models/Programme');
const { protect } = require('../middleware/auth');

const PATCHABLE_FIELDS = [
  'name',
  'format',
  'total_duration_days',
  'calendar_span_weeks',
  'cohort_size',
  'cohorts',
  'design_parameters',
  'derived_metrics',
  'rationale',
  'phases'
];

router.get('/', protect, async (req, res) => {
  try {
    const { opportunity_id } = req.query;
    if (!opportunity_id || !mongoose.isValidObjectId(opportunity_id)) {
      return res.status(400).json({ error: 'opportunity_id query param is required and must be a valid id' });
    }

    const programmes = await Programme.find({
      opportunity_id,
      tenant_id: req.user.id
    }).sort({ version: -1 });

    res.json({ programmes });
  } catch (err) {
    console.error('Failed to list programmes:', err.message);
    res.status(500).json({ error: 'Could not list programmes' });
  }
});
router.get('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid programme id' });
    }

    const programme = await Programme.findOne({ _id: req.params.id, tenant_id: req.user.id });
    if (!programme) return res.status(404).json({ error: 'Programme not found' });

    res.json(programme);
  } catch (err) {
    console.error('Failed to fetch programme:', err.message);
    res.status(500).json({ error: 'Could not fetch programme' });
  }
});

router.patch('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid programme id' });
    }

    const programme = await Programme.findOne({ _id: req.params.id, tenant_id: req.user.id });
    if (!programme) return res.status(404).json({ error: 'Programme not found' });

    if (programme.status === 'locked') {
      return res.status(409).json({
        error: 'This programme version is locked. Unlock it to create an editable revision.'
      });
    }

    const updates = {};
    for (const field of PATCHABLE_FIELDS) {
      if (field in req.body) updates[field] = req.body[field];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No patchable fields provided' });
    }

    Object.assign(programme, updates);
    await programme.save();

    res.json(programme);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error('Failed to update programme:', err.message);
    res.status(500).json({ error: 'Could not update programme' });
  }
});

module.exports = router;
