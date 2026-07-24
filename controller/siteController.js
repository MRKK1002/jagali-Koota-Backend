const Site = require('../model/siteModel');

// Get all sites
exports.getSites = async (req, res) => {
    try {
        const sites = await Site.find().sort({ createdAt: -1 });
        res.json(sites);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Create a new site
exports.createSite = async (req, res) => {
    try {
        const newSite = new Site(req.body);
        const savedSite = await newSite.save();
        res.status(201).json(savedSite);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Update a site
exports.updateSite = async (req, res) => {
    try {
        const site = await Site.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!site) return res.status(404).json({ error: 'Site not found' });
        res.json(site);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Delete a site
exports.deleteSite = async (req, res) => {
    try {
        const site = await Site.findByIdAndDelete(req.params.id);
        if (!site) return res.status(404).json({ error: 'Site not found' });
        res.json({ message: 'Site deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};