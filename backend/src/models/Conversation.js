import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    ],
    // Deterministic sorted key "userIdA:userIdB" ensuring strict uniqueness
    participantKey: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Helper static method to generate participant key
conversationSchema.statics.generateKey = function (userId1, userId2) {
  const sorted = [String(userId1), String(userId2)].sort();
  return `${sorted[0]}:${sorted[1]}`;
};

export const Conversation = mongoose.model('Conversation', conversationSchema);
