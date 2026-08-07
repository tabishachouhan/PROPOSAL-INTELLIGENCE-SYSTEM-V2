const express = require('express');
const mongoose = require('mongoose');
const DiscoveryAnswer = require('../models/discoveryAnswer.model');
const {
  getWorkflowState,
  runDiscoveryCompletionCheck,
} = require('../services/discoveryWorkflow.service');

const router = express.Router();

// POST /api/v1/questions/answers
// Saves (or overwrites) a single question's answer. We upsert on
// opportunityId+questionId so the frontend can just fire-and-forget on
// every field blur without worrying about "does this row exist yet".
router.post('/', async (req, res) => {
  try {
    const { opportunityId, questionId, themeCode, value, status, foundInSource, answeredBy } = req.body;

    if (!opportunityId || !questionId || !themeCode) {
      return res.status(400).json({ error: 'opportunityId, questionId and themeCode are required' });
    }
    if (!mongoose.isValidObjectId(opportunityId)) {
      return res.status(400).json({ error: 'opportunityId is not a valid id' });
    }

    const answer = await DiscoveryAnswer.findOneAndUpdate(
      { opportunityId, questionId },
      {
        themeCode,
        value,
        status: status || 'answered',
        foundInSource,
        answeredBy: answeredBy || 'user',
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json(answer);
  } catch (err) {
    // Duplicate key races shouldn't really happen with upsert, but Mongo
    // can still throw one under concurrent writes on a brand-new doc.
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Answer already being written, try again' });
    }
    console.error('Failed to save discovery answer:', err);
    res.status(500).json({ error: 'Could not save the answer' });
  }
});

// PATCH /api/v1/questions/answers/:id
// Narrower update for cases where the frontend already has the row's _id
// (e.g. flipping status from "system_confirmed" to "answered" once a user
// overrides an inferred value).
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid answer id' });
    }

    const allowedFields = ['value', 'status', 'skipReason', 'foundInSource', 'answeredBy'];
    const updates = {};
    for (const field of allowedFields) {
      if (field in req.body) updates[field] = req.body[field];
    }

    const answer = await DiscoveryAnswer.findByIdAndUpdate(id, updates, { new: true });
    if (!answer) return res.status(404).json({ error: 'Answer not found' });

    res.json(answer);
  } catch (err) {
    console.error('Failed to update discovery answer:', err);
    res.status(500).json({ error: 'Could not update the answer' });
  }
});

// GET /api/v1/questions/answers/:opportunityId
// Everything the Discovery page needs to render current state — used on
// page load/refresh to repaint which questions are answered, skipped, etc.
router.get('/:opportunityId', async (req, res) => {
  try {
    const { opportunityId } = req.params;
    if (!mongoose.isValidObjectId(opportunityId)) {
      return res.status(400).json({ error: 'Invalid opportunity id' });
    }

    const answers = await DiscoveryAnswer.find({ opportunityId }).sort({ questionId: 1 });
    const state = getWorkflowState(answers);

    res.json({ answers, state });
  } catch (err) {
    console.error('Failed to load discovery answers:', err);
    res.status(500).json({ error: 'Could not load answers' });
  }
});

// POST /api/v1/questions/answers/:opportunityId/complete
// The "am I done, and can I move on" endpoint. Checks completeness against
// scoring, and — if clear — kicks off the downstream payload prep for
// Competency Mapping / Architecture / Approach Note.
router.post('/:opportunityId/complete', async (req, res) => {
  try {
    const { opportunityId } = req.params;
    if (!mongoose.isValidObjectId(opportunityId)) {
      return res.status(400).json({ error: 'Invalid opportunity id' });
    }

    const result = await runDiscoveryCompletionCheck(opportunityId);
    res.json(result);
  } catch (err) {
    console.error('Discovery completion check failed:', err);
    res.status(500).json({ error: 'Could not evaluate discovery completeness' });
  }
});

module.exports = router;
