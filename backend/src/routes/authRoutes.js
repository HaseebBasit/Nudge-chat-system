import { Router } from 'express';
import {
  signup,
  verifyEmail,
  resendOtp,
  login,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  getMe
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/signup', signup);
router.post('/verify-email', verifyEmail);
router.post('/resend-otp', resendOtp);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);

export default router;
