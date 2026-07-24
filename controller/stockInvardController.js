const StockInward = require('../model/stockInward');

// Create new StockInward
exports.createStockInward = async (req, res) => {
    try {
        const { name, goodsReceiptNoteId, supplierId } = req.body;
        const stockInward = new StockInward({ name, goodsReceiptNoteId, supplierId });
        await stockInward.save();
        res.status(201).json(stockInward);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Get all StockInwards
exports.getAllStockInwards = async (req, res) => {
    try {
        const stockInwards = await StockInward.find()
            .populate('goodsReceiptNoteId')
            .populate('supplierId', 'name');
        res.json(stockInwards);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get StockInward by ID
exports.getStockInwardById = async (req, res) => {
    try {
        const stockInward = await StockInward.findById(req.params.id)
            .populate('goodsReceiptNoteId')
            .populate('supplierId','name');
        if (!stockInward) return res.status(404).json({ error: 'Not found' });
        res.json(stockInward);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Update StockInward
exports.updateStockInward = async (req, res) => {
    try {
        const { name, goodsReceiptNoteId, supplierId } = req.body;
        const stockInward = await StockInward.findByIdAndUpdate(
            req.params.id,
            { name, goodsReceiptNoteId, supplierId },
            { new: true }
        );
        if (!stockInward) return res.status(404).json({ error: 'Not found' });
        res.json(stockInward);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Delete StockInward
exports.deleteStockInward = async (req, res) => {
    try {
        const stockInward = await StockInward.findByIdAndDelete(req.params.id);
        if (!stockInward) return res.status(404).json({ error: 'Not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};