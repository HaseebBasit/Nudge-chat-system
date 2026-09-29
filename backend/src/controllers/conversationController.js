import { Conversation } from '../models/Conversation.js';
import { Group } from '../models/Group.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { MessageReceipt } from '../models/MessageReceipt.js';
import { Reaction } from '../models/Reaction.js';
import { emitToRoom, emitToUser } from '../sockets/socketEmitter.js';
import { isUserOnline } from '../sockets/socketHandler.js';

export const getPrivateConversations = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;

    // Find all 1-to-1 conversations where current user is a participant
    const conversations = await Conversation.find({
      participants: currentUserId
    })
      .sort({ lastMessageAt: -1 })
      .populate('participants', '_id name email profileMediaId statusMessage lastSeen')
      .populate('lastMessage')
      .lean();

    // Attach unread counts & other participant details
    const formatted = await Promise.all(
      conversations.map(async (conv) => {
        const otherParticipant = conv.participants.find(
          (p) => String(p._id) !== String(currentUserId)
        );

        // Count unread messages sent by other participant where user hasn't marked seen
        const unreadCount = await MessageReceipt.countDocuments({
          conversationId: conv._id,
          userId: currentUserId,
          status: { $ne: 'seen' }
        });

        return {
          _id: conv._id,
          isGroup: false,
          participant: otherParticipant
            ? {
                ...otherParticipant,
                isOnline: isUserOnline(otherParticipant._id)
              }
            : null,
          lastMessage: conv.lastMessage,
          lastMessageAt: conv.lastMessageAt,
          unreadCount,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt
        };
      })
    );

    return res.status(200).json({
      success: true,
      conversations: formatted
    });
  } catch (error) {
    next(error);
  }
};

export const getOrCreatePrivateConversation = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { recipientId } = req.body;

    if (!recipientId) {
      return res.status(400).json({
        success: false,
        message: 'Recipient ID is required.'
      });
    }

    if (String(recipientId) === String(currentUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot start a private conversation with yourself.'
      });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient user does not exist.'
      });
    }

    // Deterministic key ensures no duplicate conversation can ever exist
    const participantKey = Conversation.generateKey(currentUserId, recipientId);

    let conversation = await Conversation.findOne({ participantKey })
      .populate('participants', '_id name email profileMediaId statusMessage lastSeen')
      .populate('lastMessage');

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [currentUserId, recipientId],
        participantKey,
        lastMessageAt: new Date()
      });

      conversation = await Conversation.findById(conversation._id)
        .populate('participants', '_id name email profileMediaId statusMessage lastSeen');
    }

    const otherParticipant = conversation.participants.find(
      (p) => String(p._id) !== String(currentUserId)
    );

    const unreadCount = await MessageReceipt.countDocuments({
      conversationId: conversation._id,
      userId: currentUserId,
      status: { $ne: 'seen' }
    });

    return res.status(200).json({
      success: true,
      conversation: {
        _id: conversation._id,
        isGroup: false,
        participant: {
          ...otherParticipant.toObject(),
          isOnline: isUserOnline(otherParticipant._id)
        },
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        unreadCount,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getConversationMessages = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));

    // Strict Authorization Check: Determine if Private Conversation or Group
    let isAuthorized = false;
    let isGroup = false;

    const privateConv = await Conversation.findById(id);
    if (privateConv) {
      isAuthorized = privateConv.participants.some(
        (p) => String(p) === String(currentUserId)
      );
      isGroup = false;
    } else {
      const groupConv = await Group.findById(id);
      if (groupConv) {
        isAuthorized = groupConv.members.some(
          (m) => String(m) === String(currentUserId)
        );
        isGroup = true;
      }
    }

    if (!privateConv && !isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.'
      });
    }

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You are not an authorized participant of this conversation.'
      });
    }

    const totalMessages = await Message.countDocuments({ conversationId: id });

    // Fetch paginated messages sorted newest first, then reverse for display
    const rawMessages = await Message.find({ conversationId: id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('senderId', '_id name email profileMediaId')
      .populate({
        path: 'replyTo',
        select: '_id senderId type content fileName',
        populate: { path: 'senderId', select: '_id name' }
      })
      .lean();

    const messageIds = rawMessages.map((m) => m._id);

    // Fetch reactions for all returned messages
    const reactions = await Reaction.find({ messageId: { $in: messageIds } })
      .populate('userId', '_id name')
      .lean();

    // Fetch message receipts for receipt statuses
    const receipts = await MessageReceipt.find({ messageId: { $in: messageIds } }).lean();

    // Attach reactions & delivery/seen status to each message
    const formattedMessages = rawMessages.map((msg) => {
      // Group reactions by emoji
      const msgReactions = reactions.filter(
        (r) => String(r.messageId) === String(msg._id)
      );
      const reactionSummary = {};
      msgReactions.forEach((r) => {
        if (!reactionSummary[r.emoji]) {
          reactionSummary[r.emoji] = {
            count: 0,
            users: [],
            hasReacted: false
          };
        }
        reactionSummary[r.emoji].count += 1;
        reactionSummary[r.emoji].users.push({ _id: r.userId._id, name: r.userId.name });
        if (String(r.userId._id) === String(currentUserId)) {
          reactionSummary[r.emoji].hasReacted = true;
        }
      });

      // Compute aggregate receipt status for sender
      const msgReceipts = receipts.filter(
        (rc) => String(rc.messageId) === String(msg._id)
      );
      let status = 'sent';
      if (msgReceipts.some((rc) => rc.status === 'seen')) {
        status = 'seen';
      } else if (msgReceipts.some((rc) => rc.status === 'delivered')) {
        status = 'delivered';
      }

      return {
        ...msg,
        reactions: reactionSummary,
        status
      };
    });

    // Return in chronological order for easy scrolling
    return res.status(200).json({
      success: true,
      messages: formattedMessages.reverse(),
      pagination: {
        page,
        limit,
        total: totalMessages,
        hasMore: page * limit < totalMessages
      }
    });
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { id } = req.params;
    const { type = 'text', content = '', mediaId = null, fileName = '', mimeType = '', fileSize = 0, duration = 0, replyTo = null } = req.body;

    if (type === 'text' && (!content || content.trim() === '')) {
      return res.status(400).json({
        success: false,
        message: 'Message text content cannot be empty.'
      });
    }

    // Verify conversation existence and participant authorization
    let isGroup = false;
    let recipients = [];
    let roomName = '';

    const privateConv = await Conversation.findById(id);
    if (privateConv) {
      const isParticipant = privateConv.participants.some(
        (p) => String(p) === String(currentUserId)
      );
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized. You cannot send messages in this private conversation.'
        });
      }
      isGroup = false;
      recipients = privateConv.participants.filter(
        (p) => String(p) !== String(currentUserId)
      );
      roomName = `private_${id}`;
    } else {
      const groupConv = await Group.findById(id);
      if (groupConv) {
        const isMember = groupConv.members.some(
          (m) => String(m) === String(currentUserId)
        );
        if (!isMember) {
          return res.status(403).json({
            success: false,
            message: 'Unauthorized. You cannot send messages in this group.'
          });
        }
        isGroup = true;
        recipients = groupConv.members.filter(
          (m) => String(m) !== String(currentUserId)
        );
        roomName = `group_${id}`;
      } else {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found.'
        });
      }
    }

    // Persist message in MongoDB
    const newMessage = await Message.create({
      conversationId: id,
      isGroup,
      senderId: currentUserId,
      type,
      content: content.trim(),
      mediaId,
      fileName,
      mimeType,
      fileSize,
      duration,
      replyTo: replyTo || null,
      edited: false,
      deleted: false
    });

    // Update conversation/group lastMessage and timestamp
    if (!isGroup) {
      await Conversation.findByIdAndUpdate(id, {
        lastMessage: newMessage._id,
        lastMessageAt: new Date()
      });
    } else {
      await Group.findByIdAndUpdate(id, {
        lastMessage: newMessage._id,
        lastMessageAt: new Date()
      });
    }

    // Create receipts for recipients
    for (const recipientId of recipients) {
      const online = isUserOnline(recipientId);
      await MessageReceipt.create({
        messageId: newMessage._id,
        conversationId: id,
        userId: recipientId,
        status: online ? 'delivered' : 'sent',
        deliveredAt: online ? new Date() : null
      });
    }

    // Populate sender info and replyTo info
    const populatedMessage = await Message.findById(newMessage._id)
      .populate('senderId', '_id name email profileMediaId')
      .populate({
        path: 'replyTo',
        select: '_id senderId type content fileName',
        populate: { path: 'senderId', select: '_id name' }
      })
      .lean();

    const formattedPayload = {
      ...populatedMessage,
      reactions: {},
      status: recipients.some((r) => isUserOnline(r)) ? 'delivered' : 'sent'
    };

    // Emit real-time message to conversation/group room
    emitToRoom(roomName, isGroup ? 'group_message' : 'private_message', formattedPayload);

    // Also notify recipients' private rooms for badge / unread counts
    for (const recipientId of recipients) {
      emitToUser(recipientId, 'new_message_notification', {
        conversationId: id,
        isGroup,
        message: formattedPayload
      });
    }

    return res.status(201).json({
      success: true,
      message: formattedPayload
    });
  } catch (error) {
    next(error);
  }
};

export const markConversationSeen = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { id } = req.params;

    // Verify membership
    let isGroup = false;
    let roomName = '';

    const privateConv = await Conversation.findById(id);
    if (privateConv) {
      const isParticipant = privateConv.participants.some(
        (p) => String(p) === String(currentUserId)
      );
      if (!isParticipant) {
        return res.status(403).json({ success: false, message: 'Unauthorized.' });
      }
      isGroup = false;
      roomName = `private_${id}`;
    } else {
      const groupConv = await Group.findById(id);
      if (groupConv) {
        const isMember = groupConv.members.some(
          (m) => String(m) === String(currentUserId)
        );
        if (!isMember) {
          return res.status(403).json({ success: false, message: 'Unauthorized.' });
        }
        isGroup = true;
        roomName = `group_${id}`;
      } else {
        return res.status(404).json({ success: false, message: 'Conversation not found.' });
      }
    }

    const now = new Date();

    // Mark unread receipts as seen
    const result = await MessageReceipt.updateMany(
      {
        conversationId: id,
        userId: currentUserId,
        status: { $ne: 'seen' }
      },
      {
        status: 'seen',
        readAt: now
      }
    );

    // Emit real-time seen event to conversation room
    emitToRoom(roomName, 'messages_seen', {
      conversationId: id,
      userId: currentUserId,
      readAt: now
    });

    return res.status(200).json({
      success: true,
      updatedCount: result.modifiedCount
    });
  } catch (error) {
    next(error);
  }
};
