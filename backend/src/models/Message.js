import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    isGroup: {
      type: Boolean,
      default: false,
      index: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['text', 'image', 'voice', 'file'],
      default: 'text'
    },
    content: {
      type: String,
      default: ''
    },
    mediaId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    fileName: {
      type: String,
      default: ''
    },
    mimeType: {
      type: String,
      default: ''
    },
    fileSize: {
      type: Number,
      default: 0
    },
    duration: {
      type: Number,
      default: 0 // Duration in seconds for voice messages
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null
    },
    edited: {
      type: Boolean,
      default: false
    },
    deleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

export const Message = mongoose.model('Message', messageSchema);
