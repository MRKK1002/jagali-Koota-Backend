const express = require('express');
const router = express.Router();
const mealOfTheDayController = require('../controller/mealOfTheDayController');
const multer = require('multer');

// Configure multer for file uploads - using memory storage for AWS S3
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Meal of the day routes
router.get('/', mealOfTheDayController.getAllMealsOfTheDay);
router.get('/branch/:branchId', mealOfTheDayController.getMealsByBranch);
router.post('/', upload.single('image'), mealOfTheDayController.createMealOfTheDay);
router.get('/:id', mealOfTheDayController.getMealOfTheDayById);
router.put('/:id', upload.single('image'), mealOfTheDayController.updateMealOfTheDay);
router.delete('/:id', mealOfTheDayController.deleteMealOfTheDay);

module.exports = router;