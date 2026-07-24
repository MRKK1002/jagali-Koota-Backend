const express = require('express');
const router = express.Router();

const userController = require('../controller/userController');
const multer = require("multer")

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/profile")
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "_" + file.originalname)
    },
})

const upload = multer()


// OTP Routes
router.post('/register/send-otp', userController.sendOtpForRegistration);
router.post('/login/send-otp', userController.sendOtpForLogin);
router.post('/verify-otp', upload.single('image'), userController.verifyOtp);
router.post('/register/resend-otp', userController.resendOtpForRegistration);
router.post('/login/resend-otp', userController.resendOtpForLogin);

router.post('/', upload.single('image'), userController.createUser);
router.get('/', userController.getAllUsers);
router.get('/all', userController.getAllUsers); // Add explicit /all route
router.get('/:id', userController.getUserById);
router.put('/:id', upload.single('image'), userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;