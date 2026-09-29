import mongoose from 'mongoose';

const reactionSchema = new mongoose.Schema(
  {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    emoji: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Ensure a user can only have one of a specific emoji on a message
reactionSchema.index({ messageId: 1, userId: 1, emoji: 1 }, { unique: true });

export const Reaction = mongoose.model('Reaction', reactionSchema);
