import { Conversation } from '../models/Conversation.js';
import { Group } from '../models/Group.js';
import { User } from '../models/User.js';

// In-memory mapping of active users: userId -> Set of socket IDs
const onlineUsers = new Map();

export const isUserOnline = (userId) => {
  return onlineUsers.has(String(userId)) && onlineUsers.get(String(userId)).size > 0;
};

export const getOnlineUserIds = () => {
  return Array.from(onlineUsers.keys());
};

export const registerSocketHandlers = (io) => {
  io.on('connection', async (socket) => {
    const user = socket.user;
    const userId = String(user._id);

    // Track user socket
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
      // First socket for this user: announce online status to everyone
      io.emit('user_online', { userId, lastSeen: new Date() });
    }
    onlineUsers.get(userId).add(socket.id);

    // Join personal notification room
    socket.join(`user_${userId}`);

    // Send current online user IDs to the connected client
    socket.emit('online_users_list', Array.from(onlineUsers.keys()));

    // ---- JOIN PRIVATE CONVERSATION ----
    socket.on('join_private_conversation', async ({ conversationId }, callback) => {
      try {
        if (!conversationId) {
          if (callback) callback({ success: false, error: 'conversationId required' });
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          if (callback) callback({ success: false, error: 'Conversation not found' });
          return;
        }

        // Strict authorization: is authenticated user a participant?
        const isParticipant = conversation.participants.some(
          (p) => String(p) === userId
        );

        if (!isParticipant) {
          if (callback) callback({ success: false, error: 'Unauthorized to join this conversation' });
          socket.emit('socket_error', { message: 'Unauthorized to join this conversation' });
          return;
        }

        const roomName = `private_${conversationId}`;
        socket.join(roomName);

        if (callback) callback({ success: true, room: roomName });
      } catch (err) {
        if (callback) callback({ success: false, error: 'Server error joining conversation' });
      }
    });

    // ---- LEAVE PRIVATE CONVERSATION ----
    socket.on('leave_private_conversation', ({ conversationId }) => {
      if (conversationId) {
        socket.leave(`private_${conversationId}`);
      }
    });

    // ---- JOIN GROUP ----
    socket.on('join_group', async ({ groupId }, callback) => {
      try {
        if (!groupId) {
          if (callback) callback({ success: false, error: 'groupId required' });
          return;
        }

        const group = await Group.findById(groupId);
        if (!group) {
          if (callback) callback({ success: false, error: 'Group not found' });
          return;
        }

        // Strict authorization: is authenticated user a member?
        const isMember = group.members.some((m) => String(m) === userId);
        if (!isMember) {
          if (callback) callback({ success: false, error: 'Unauthorized to join this group' });
          socket.emit('socket_error', { message: 'Unauthorized to join this group' });
          return;
        }

        const roomName = `group_${groupId}`;
        socket.join(roomName);

        if (callback) callback({ success: true, room: roomName });
      } catch (err) {
        if (callback) callback({ success: false, error: 'Server error joining group' });
      }
    });

    // ---- LEAVE GROUP ----
    socket.on('leave_group', ({ groupId }) => {
      if (groupId) {
        socket.leave(`group_${groupId}`);
      }
    });

    // ---- PRIVATE TYPING EVENTS ----
    socket.on('private_typing_start', ({ conversationId }) => {
      if (conversationId) {
        socket.to(`private_${conversationId}`).emit('private_typing_start', {
          conversationId,
          userId,
          userName: user.name
        });
      }
    });

    socket.on('private_typing_stop', ({ conversationId }) => {
      if (conversationId) {
        socket.to(`private_${conversationId}`).emit('private_typing_stop', {
          conversationId,
          userId
        });
      }
    });

    // ---- GROUP TYPING EVENTS ----
    socket.on('group_typing_start', ({ groupId }) => {
      if (groupId) {
        socket.to(`group_${groupId}`).emit('group_typing_start', {
          groupId,
          userId,
          userName: user.name
        });
      }
    });

    socket.on('group_typing_stop', ({ groupId }) => {
      if (groupId) {
        socket.to(`group_${groupId}`).emit('group_typing_stop', {
          groupId,
          userId
        });
      }
    });

    // ---- DISCONNECT ----
    socket.on('disconnect', async () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          const lastSeen = new Date();
          // Update user lastSeen in database
          try {
            await User.findByIdAndUpdate(userId, { lastSeen });
          } catch (e) {
            // Ignore DB error on disconnect
          }
          // Broadcast offline event to all clients
          io.emit('user_offline', { userId, lastSeen });
        }
      }
    });
  });
};
