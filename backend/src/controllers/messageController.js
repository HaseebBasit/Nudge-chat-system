import { Message } from '../models/Message.js';
import { Conversation } from '../models/Conversation.js';
import { Group } from '../models/Group.js';
import { Reaction } from '../models/Reaction.js';
import { emitToRoom } from '../sockets/socketEmitter.js';

export const editMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const currentUserId = req.user._id;

    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Edited message content cannot be empty.'
      });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found.'
      });
    }

    // Strict ownership verification: only sender can edit
    if (String(message.senderId) !== String(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You can only edit your own messages.'
      });
    }

    if (message.deleted) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a deleted message.'
      });
    }

    message.content = content.trim();
    message.edited = true;
    await message.save();

    const roomName = message.isGroup
      ? `group_${message.conversationId}`
      : `private_${message.conversationId}`;

    // Broadcast edit event
    emitToRoom(roomName, 'message_edited', {
      messageId: message._id,
      conversationId: message.conversationId,
      content: message.content,
      edited: true,
      updatedAt: message.updatedAt
    });

    return res.status(200).json({
      success: true,
      message
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found.'
      });
    }

    // Strict ownership verification: only sender can delete
    if (String(message.senderId) !== String(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You can only delete your own messages.'
      });
    }

    // Soft delete
    message.deleted = true;
    message.content = 'This message was deleted';
    message.mediaId = null;
    message.fileName = '';
    message.fileSize = 0;
    message.duration = 0;
    await message.save();

    // Also remove reactions on deleted message
    await Reaction.deleteMany({ messageId: message._id });

    const roomName = message.isGroup
      ? `group_${message.conversationId}`
      : `private_${message.conversationId}`;

    // Broadcast delete event
    emitToRoom(roomName, 'message_deleted', {
      messageId: message._id,
      conversationId: message.conversationId,
      deleted: true,
      content: message.content
    });

    return res.status(200).json({
      success: true,
      message: 'Message deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

export const toggleReaction = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const currentUserId = req.user._id;

    if (!emoji || typeof emoji !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Emoji is required.'
      });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found.'
      });
    }

    // Check conversation membership
    if (message.isGroup) {
      const group = await Group.findById(message.conversationId);
      if (!group || !group.members.some((m) => String(m) === String(currentUserId))) {
        return res.status(403).json({ success: false, message: 'Unauthorized.' });
      }
    } else {
      const conv = await Conversation.findById(message.conversationId);
      if (!conv || !conv.participants.some((p) => String(p) === String(currentUserId))) {
        return res.status(403).json({ success: false, message: 'Unauthorized.' });
      }
    }

    // Check if reaction already exists
    const existing = await Reaction.findOne({
      messageId: message._id,
      userId: currentUserId,
      emoji
    });

    let action = 'added';
    if (existing) {
      // Toggle off: remove reaction
      await Reaction.deleteOne({ _id: existing._id });
      action = 'removed';
    } else {
      // Add reaction
      await Reaction.create({
        messageId: message._id,
        userId: currentUserId,
        emoji
      });
      action = 'added';
    }

    // Fetch all current reactions for this message to build aggregate view
    const allReactions = await Reaction.find({ messageId: message._id })
      .populate('userId', '_id name')
      .lean();

    const summary = {};
    allReactions.forEach((r) => {
      if (!summary[r.emoji]) {
        summary[r.emoji] = { count: 0, users: [] };
      }
      summary[r.emoji].count += 1;
      summary[r.emoji].users.push({ _id: r.userId._id, name: r.userId.name });
    });

    const roomName = message.isGroup
      ? `group_${message.conversationId}`
      : `private_${message.conversationId}`;

    emitToRoom(roomName, 'reaction_updated', {
      messageId: message._id,
      conversationId: message.conversationId,
      action,
      emoji,
      userId: currentUserId,
      reactions: summary
    });

    return res.status(200).json({
      success: true,
      action,
      reactions: summary
    });
  } catch (error) {
    next(error);
  }
};
