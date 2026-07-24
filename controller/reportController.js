const Report = require('../model/Report');

const ReportController = {
  getReports: async (req, res, next) => {
    try {
      const { type, status, startDate, endDate, search, page = 1, limit = 10 } = req.query;
      const query = {};

      if (type && type !== 'all') query.type = type;
      if (status && status !== 'all') query.status = status;
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { generatedBy: { $regex: search, $options: 'i' } },
        ];
      }

      const reports = await Report.find(query)
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 });

      const total = await Report.countDocuments(query);

      res.json({
        data: reports,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        success: true,
      });
    } catch (error) {
      next(error);
    }
  },

  getReportById: async (req, res, next) => {
    try {
      const report = await Report.findById(req.params.id);
      if (!report) {
        return res.status(404).json({ error: 'Report not found', success: false });
      }
      res.json({ data: report, success: true });
    } catch (error) {
      next(error);
    }
  },

  createReport: async (req, res, next) => {
    try {
      const { name, type, period, generatedBy } = req.body;
      if (!name || !type || !period || !generatedBy) {
        return res.status(400).json({ error: 'Missing required fields', success: false });
      }
      const report = await Report.create({ name, type, period, generatedBy });
      res.status(201).json({ data: report, success: true });
    } catch (error) {
      next(error);
    }
  },

  updateReport: async (req, res, next) => {
    try {
      const { name, type, period, generatedBy, status } = req.body;
      const report = await Report.findByIdAndUpdate(
        req.params.id,
        { name, type, period, generatedBy, status },
        { new: true, runValidators: true }
      );
      if (!report) {
        return res.status(404).json({ error: 'Report not found', success: false });
      }
      res.json({ data: report, success: true });
    } catch (error) {
      next(error);
    }
  },

  deleteReport: async (req, res, next) => {
    try {
      const report = await Report.findByIdAndDelete(req.params.id);
      if (!report) {
        return res.status(404).json({ error: 'Report not found', success: false });
      }
      res.json({ message: 'Report deleted successfully', success: true });
    } catch (error) {
      next(error);
    }
  },

  downloadReport: async (req, res, next) => {
    try {
      const report = await Report.findById(req.params.id);
      if (!report) {
        return res.status(404).json({ error: 'Report not found', success: false });
      }
      if (report.status !== 'Complete') {
        return res.status(400).json({ error: 'Report is not complete', success: false });
      }
      // Simulate file download (replace with actual file serving in production)
      res.setHeader('Content-Disposition', `attachment; filename=${report.name}.pdf`);
      res.setHeader('Content-Type', 'application/pdf');
      res.send(`Simulated PDF content for ${report.name}`);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = ReportController;