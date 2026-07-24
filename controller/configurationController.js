const Configuration = require('../model/Configuration');

exports.createConfiguration = async (req, res) => {
  try {
    const newConfig = new Configuration({
      ...req.body,
      lastUpdated: new Date()
    });

    await newConfig.save();
    res.status(201).json({ message: 'Configuration created successfully', config: newConfig });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getAllConfigurations = async (req, res) => {
  try {
    const configs = await Configuration.find();
    res.status(200).json(configs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getConfigurationById = async (req, res) => {
  try {
    const config = await Configuration.findById(req.params.id);
    if (!config) return res.status(404).json({ message: 'Configuration not found' });
    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateConfiguration = async (req, res) => {
  try {
    const config = await Configuration.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastUpdated: new Date() },
      { new: true, runValidators: true }
    );

    if (!config) return res.status(404).json({ message: 'Configuration not found' });
    res.status(200).json({ message: 'Configuration updated successfully', config });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteConfiguration = async (req, res) => {
  try {
    const result = await Configuration.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: 'Configuration not found' });
    res.status(200).json({ message: 'Configuration deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};