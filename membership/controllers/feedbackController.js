const Feedback = require('../models/Feedback');
const asyncHandler = require('express-async-handler');

// @desc    Submit feedback for staff (Member App)
// @route   POST /api/v1/hotel/feedback
// @access  Private (Member)
exports.submitFeedback = asyncHandler(async (req, res) => {
  const {
    feedbackFor,
    staffId,
    staffName,
    rating,
    feedback,
    branch,
    branchName,
    orderNumber,
    tableNumber
  } = req.body;

  // Validation
  if (!feedbackFor || !rating || !feedback) {
    return res.status(400).json({
      success: false,
      message: 'Please provide feedbackFor, rating, and feedback'
    });
  }

  if (!['server', 'waiter', 'cook', 'general'].includes(feedbackFor)) {
    return res.status(400).json({
      success: false,
      message: 'feedbackFor must be one of: server, waiter, cook, general'
    });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({
      success: false,
      message: 'Rating must be between 1 and 5'
    });
  }

  // Create feedback
  const newFeedback = await Feedback.create({
    memberId: req.member._id,
    memberName: req.member.name || 'Member',
    memberEmail: req.member.email || '',
    feedbackFor,
    staffId: staffId || null,
    staffName: staffName || '',
    rating,
    feedback,
    branch: branch || null,
    branchName: branchName || '',
    orderNumber: orderNumber || null,
    tableNumber: tableNumber || null
  });

  res.status(201).json({
    success: true,
    message: 'Feedback submitted successfully',
    data: newFeedback
  });
});

// @desc    Get member's own feedbacks
// @route   GET /api/v1/hotel/feedback/my-feedback
// @access  Private (Member)
exports.getMyFeedback = asyncHandler(async (req, res) => {
  const feedbacks = await Feedback.find({ memberId: req.member._id })
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: feedbacks.length,
    data: feedbacks
  });
});

// @desc    Get all feedbacks (Admin)
// @route   GET /api/v1/hotel/feedback/all
// @access  Private (Admin)
exports.getAllFeedback = asyncHandler(async (req, res) => {
  const {
    status,
    feedbackFor,
    rating,
    branch,
    startDate,
    endDate,
    page = 1,
    limit = 20
  } = req.query;

  const query = {};

  if (status) query.status = status;
  if (feedbackFor) query.feedbackFor = feedbackFor;
  if (rating) query.rating = Number(rating);
  if (branch) query.branch = branch;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;

  const feedbacks = await Feedback.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Feedback.countDocuments(query);

  res.status(200).json({
    success: true,
    count: feedbacks.length,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
    data: feedbacks
  });
});

// @desc    Get feedback by ID (Admin)
// @route   GET /api/v1/hotel/feedback/:id
// @access  Private (Admin)
exports.getFeedbackById = asyncHandler(async (req, res) => {
  const feedback = await Feedback.findById(req.params.id);

  if (!feedback) {
    return res.status(404).json({
      success: false,
      message: 'Feedback not found'
    });
  }

  res.status(200).json({
    success: true,
    data: feedback
  });
});

// @desc    Update feedback status (Admin)
// @route   PUT /api/v1/hotel/feedback/:id
// @access  Private (Admin)
exports.updateFeedbackStatus = asyncHandler(async (req, res) => {
  const { status, adminNotes } = req.body;

  const feedback = await Feedback.findById(req.params.id);

  if (!feedback) {
    return res.status(404).json({
      success: false,
      message: 'Feedback not found'
    });
  }

  if (status) {
    if (!['pending', 'reviewed', 'resolved'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }
    feedback.status = status;
  }

  if (adminNotes !== undefined) {
    feedback.adminNotes = adminNotes;
  }

  if (status === 'reviewed' || status === 'resolved') {
    feedback.reviewedBy = req.admin?._id || req.user?._id;
    feedback.reviewedAt = new Date();
  }

  await feedback.save();

  res.status(200).json({
    success: true,
    message: 'Feedback updated successfully',
    data: feedback
  });
});

// @desc    Delete feedback (Admin)
// @route   DELETE /api/v1/hotel/feedback/:id
// @access  Private (Admin)
exports.deleteFeedback = asyncHandler(async (req, res) => {
  const feedback = await Feedback.findById(req.params.id);

  if (!feedback) {
    return res.status(404).json({
      success: false,
      message: 'Feedback not found'
    });
  }

  await feedback.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Feedback deleted successfully'
  });
});

// @desc    Get feedback statistics (Admin)
// @route   GET /api/v1/hotel/feedback/stats/overview
// @access  Private (Admin)
exports.getFeedbackStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const matchQuery = {};
  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
    if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
  }

  // Overall stats
  const totalFeedback = await Feedback.countDocuments(matchQuery);
  
  // By status
  const byStatus = await Feedback.aggregate([
    { $match: matchQuery },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  // By feedback type
  const byType = await Feedback.aggregate([
    { $match: matchQuery },
    { $group: { _id: '$feedbackFor', count: { $sum: 1 }, avgRating: { $avg: '$rating' } } }
  ]);

  // Average rating
  const avgRatingResult = await Feedback.aggregate([
    { $match: matchQuery },
    { $group: { _id: null, avgRating: { $avg: '$rating' } } }
  ]);

  // Rating distribution
  const ratingDistribution = await Feedback.aggregate([
    { $match: matchQuery },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      total: totalFeedback,
      averageRating: avgRatingResult[0]?.avgRating?.toFixed(2) || 0,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byType: byType.map(item => ({
        type: item._id,
        count: item.count,
        avgRating: item.avgRating.toFixed(2)
      })),
      ratingDistribution: ratingDistribution.map(item => ({
        rating: item._id,
        count: item.count
      }))
    }
  });
});
