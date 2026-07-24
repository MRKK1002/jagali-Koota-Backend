const express = require('express');
const router = express.Router();
const configController = require('../controller/configurationController');

router.post('/', configController.createConfiguration);
router.get('/', configController.getAllConfigurations);
router.get('/:id', configController.getConfigurationById);
router.put('/:id', configController.updateConfiguration);
router.delete('/:id', configController.deleteConfiguration);

module.exports = router;