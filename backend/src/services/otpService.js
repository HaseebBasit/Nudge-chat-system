import crypto from 'crypto';
import { Otp } from '../models/Otp.js';
import { sendOtpEmail } from './emailService.js';

const OTP_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;

export const generateOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};

export const createAndSendOtp = async (email, purpose) => {
  const normalizedEmail = email.toLowerCase().trim();

  // Check resend cooldown
  const existingOtp = await Otp.findOne({ email: normalizedEmail, purpose }).sort({ createdAt: -1 });
  if (existingOtp) {
    const elapsedSeconds = (Date.now() - new Date(existingOtp.lastSentAt).getTime()) / 1000;
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      const waitSeconds = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsedSeconds);
      throw new Error(`Please wait ${waitSeconds}s before requesting a new code.`);
    }
  }

  // Invalidate any previous OTPs for this email & purpose
  await Otp.deleteMany({ email: normalizedEmail, purpose });

  // Generate new OTP
  const otpCode = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Save to MongoDB
  await Otp.create({
    email: normalizedEmail,
    otp: otpCode,
    purpose,
    expiresAt,
    lastSentAt: new Date()
  });

  // Send via Nodemailer
  await sendOtpEmail(normalizedEmail, otpCode, purpose);

  return { success: true, message: 'Verification code sent to your email.' };
};

export const verifyOtpCode = async (email, otp, purpose) => {
  const normalizedEmail = email.toLowerCase().trim();

  const record = await Otp.findOne({ email: normalizedEmail, purpose });
  if (!record) {
    return { valid: false, message: 'Invalid or expired verification code.' };
  }

  if (record.otp !== otp.trim()) {
    return { valid: false, message: 'Incorrect verification code.' };
  }

  if (new Date() > record.expiresAt) {
    await Otp.deleteOne({ _id: record._id });
    return { valid: false, message: 'Verification code has expired. Please request a new one.' };
  }

  // Code is valid - invalidate it so it cannot be used again
  await Otp.deleteOne({ _id: record._id });
  return { valid: true };
};
