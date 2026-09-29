import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    otp: {
      type: String,
      required: true,
      length: 6
    },
    purpose: {
      type: String,
      enum: ['email_verification', 'password_reset'],
      required: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    lastSentAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// TTL index to automatically clear expired OTP records from MongoDB
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Otp = mongoose.model('Otp', otpSchema);
