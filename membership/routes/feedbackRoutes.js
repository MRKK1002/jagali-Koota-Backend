const express = require('express');
const router = express.Router();
const {
  submitFeedback,
  getMyFeedback,
  getAllFeedback,
  getFeedbackById,
  updateFeedbackStatus,
  deleteFeedback,
  getFeedbackStats
} = require('../controllers/feedbackController');

// Import middleware
const { protectMember } = require('../middleware/memberAuth');
// Note: Admin protect needs to be added if available

// Member routes - using protectMember middleware
router.post('/', protectMember, submitFeedback);
router.get('/my-feedback', protectMember, getMyFeedback);

// Admin routes (temporarily without admin auth - add when available)
router.get('/all', getAllFeedback);
router.get('/stats/overview', getFeedbackStats);
router.get('/:id', getFeedbackById);
router.put('/:id', updateFeedbackStatus);
router.delete('/:id', deleteFeedback);

module.exports = router;
