import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [50, 'Name must not exceed 50 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    profileMediaId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    statusMessage: {
      type: String,
      default: 'Hey there! I am using Nudge Chat.',
      maxlength: [120, 'Status message cannot exceed 120 characters']
    },
    lastSeen: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Method to return safe public profile representation
userSchema.methods.toSafeObject = function () {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    isEmailVerified: this.isEmailVerified,
    profileMediaId: this.profileMediaId,
    statusMessage: this.statusMessage,
    lastSeen: this.lastSeen,
    createdAt: this.createdAt
  };
};

export const User = mongoose.model('User', userSchema);
