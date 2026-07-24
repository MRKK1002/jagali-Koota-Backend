const IndentRequest = require('../model/IndentRequest');

// @desc    Create new indent request
// @route   POST /api/indents
exports.createIndent = async (req, res) => {
  try {
    const newRequest = new IndentRequest({
      ...req.body,
      requestedBy: req.body.requestedBy || 'Current User'
    });

    const savedRequest = await newRequest.save();
    res.status(201).json(savedRequest);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc    Get all indent requests
// @route   GET /api/indents
exports.getIndents = async (req, res) => {
  try {
    const { status, search } = req.query;
    
    let filter = {};
    if (status && status !== 'all') filter.status = status;
    
    if (search) {
      filter.$or = [
        { material: new RegExp(search, 'i') },
        { phase: new RegExp(search, 'i') }
      ];
    }

    const requests = await IndentRequest.find(filter).sort({ requested: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update indent status
// @route   PATCH /api/indents/:id
exports.updateIndentStatus = async (req, res) => {
  try {
    const request = await IndentRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (req.body.status) request.status = req.body.status;
    const updatedRequest = await request.save();
    
    res.json(updatedRequest);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc    Delete indent request
// @route   DELETE /api/indents/:id
exports.deleteIndent = async (req, res) => {
  try {
    const request = await IndentRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    await request.remove();
    res.json({ message: 'Request deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};