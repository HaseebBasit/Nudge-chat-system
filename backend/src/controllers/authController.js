import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { createAndSendOtp, verifyOtpCode } from '../services/otpService.js';
import { generateToken } from '../utils/jwt.js';
import { isValidEmail, isValidPassword } from '../utils/validation.js';

export const signup = async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields (name, email, password, confirmPassword) are required.'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check duplicate email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      if (!existingUser.isEmailVerified) {
        // Send a fresh OTP if they haven't verified yet
        await createAndSendOtp(normalizedEmail, 'email_verification');
        return res.status(200).json({
          success: true,
          isEmailVerified: false,
          message: 'Account already registered but not verified. A new verification OTP has been sent.'
        });
      }
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.'
      });
    }

    // Hash password with bcryptjs
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      isEmailVerified: false
    });

    // Generate and send OTP via Nodemailer & MongoDB
    await createAndSendOtp(normalizedEmail, 'email_verification');

    return res.status(201).json({
      success: true,
      message: 'Account created successfully. Please verify your email with the 6-digit OTP code sent to you.',
      userId: newUser._id
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and 6-digit OTP are required.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify OTP against MongoDB
    const verification = await verifyOtpCode(normalizedEmail, otp, 'email_verification');
    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    // Update user verification status in MongoDB
    const user = await User.findOneAndUpdate(
      { email: normalizedEmail },
      { isEmailVerified: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.'
      });
    }

    // Issue JWT
    const token = generateToken({ id: user._id, email: user.email });

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully!',
      token,
      user: user.toSafeObject()
    });
  } catch (error) {
    next(error);
  }
};

export const resendOtp = async (req, res, next) => {
  try {
    const { email, purpose = 'email_verification' } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.'
      });
    }

    await createAndSendOtp(normalizedEmail, purpose);

    return res.status(200).json({
      success: true,
      message: 'A new 6-digit verification code has been sent to your email.'
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user including password field
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password credentials.'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password credentials.'
      });
    }

    // Verify email verification state
    if (!user.isEmailVerified) {
      // Send fresh OTP so they can easily complete verification
      try {
        await createAndSendOtp(normalizedEmail, 'email_verification');
      } catch (e) {
        // cooldown might be active
      }

      return res.status(403).json({
        success: false,
        isEmailVerified: false,
        message: 'Your email address is not verified yet. A verification OTP has been sent to your email.'
      });
    }

    // Issue JWT
    const token = generateToken({ id: user._id, email: user.email });

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: user.toSafeObject()
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // Return 200 to prevent user enumeration
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset code has been sent.'
      });
    }

    await createAndSendOtp(normalizedEmail, 'password_reset');

    return res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset code has been sent.'
    });
  } catch (error) {
    next(error);
  }
};

export const verifyResetOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and 6-digit OTP code are required.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const verification = await verifyOtpCode(normalizedEmail, otp, 'password_reset');

    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    // Return a short-lived token to authorize password update
    const resetToken = generateToken({ email: normalizedEmail, purpose: 'password_reset' }, '15m');

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully.',
      resetToken
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;

    if (!resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Reset token, new password, and confirmation are required.'
      });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.'
      });
    }

    const decoded = verifyToken(resetToken);
    if (!decoded || decoded.purpose !== 'password_reset' || !decoded.email) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset session. Please request a new code.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const user = await User.findOneAndUpdate(
      { email: decoded.email },
      { password: hashedPassword }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.'
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user.toSafeObject()
  });
};
