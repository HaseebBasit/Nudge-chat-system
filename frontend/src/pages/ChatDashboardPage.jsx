import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { Sidebar } from '../components/Chat/Sidebar.jsx';
import { ChatArea } from '../components/Chat/ChatArea.jsx';
import { SearchModal } from '../components/Chat/SearchModal.jsx';
import { GroupModal } from '../components/Chat/GroupModal.jsx';
import {
  getPrivateConversations,
  startPrivateConversation,
  getConversationMessages,
  sendMessage as apiSendMessage,
  markConversationSeen,
  editMessage as apiEditMessage,
  deleteMessage as apiDeleteMessage,
  toggleReaction as apiToggleReaction,
  getGroups
} from '../services/chatService.js';

export const ChatDashboardPage = () => {
  const { user, logout } = useAuth();
  const { socket, isOnline } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  // Typing state
  const [typingState, setTypingState] = useState({}); // { [conversationId]: { isTyping: true, userName: 'Name' } }

  // Modals
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

  // Mobile View state (true = show chat screen, false = show sidebar)
  const [isMobileChatActive, setIsMobileChatActive] = useState(false);

  const activeChatRef = useRef(activeChat);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // Load conversations & groups
  const loadSidebarData = useCallback(async () => {
    try {
      const [convRes, groupRes] = await Promise.all([
        getPrivateConversations(),
        getGroups()
      ]);
      if (convRes.success) setConversations(convRes.conversations);
      if (groupRes.success) setGroups(groupRes.groups);
    } catch (err) {
      console.error('Error fetching sidebar data:', err);
    }
  }, []);

  useEffect(() => {
    loadSidebarData();
  }, [loadSidebarData]);

  // Load messages when active chat changes
  const loadMessagesForChat = useCallback(async (chat, pageNum = 1) => {
    if (!chat) return;
    try {
      if (pageNum === 1) {
        setMessages([]);
      } else {
        setIsLoadingOlder(true);
      }

      const res = await getConversationMessages(chat._id, pageNum, 30);
      if (res.success) {
        if (pageNum === 1) {
          setMessages(res.messages);
        } else {
          setMessages((prev) => [...res.messages, ...prev]);
        }
        setHasMoreMessages(res.pagination.hasMore);
        setPage(pageNum);

        // Mark conversation as read
        await markConversationSeen(chat._id);

        // Reset unread count locally in sidebar
        if (chat.isGroup) {
          setGroups((prev) =>
            prev.map((g) => (g._id === chat._id ? { ...g, unreadCount: 0 } : g))
          );
        } else {
          setConversations((prev) =>
            prev.map((c) => (c._id === chat._id ? { ...c, unreadCount: 0 } : c))
          );
        }
      }
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setIsLoadingOlder(false);
    }
  }, []);

  // Handle switching active chat
  const handleSelectChat = (chat) => {
    if (activeChat && socket) {
      if (activeChat.isGroup) {
        socket.emit('leave_group', { groupId: activeChat._id });
      } else {
        socket.emit('leave_private_conversation', { conversationId: activeChat._id });
      }
    }

    setActiveChat(chat);
    setIsMobileChatActive(true);

    if (socket && chat) {
      if (chat.isGroup) {
        socket.emit('join_group', { groupId: chat._id });
      } else {
        socket.emit('join_private_conversation', { conversationId: chat._id });
      }
    }

    loadMessagesForChat(chat, 1);
  };

  // Socket.IO event registrations
  useEffect(() => {
    if (!socket) return;

    // Incoming private message
    const handlePrivateMessage = (newMsg) => {
      const currentActive = activeChatRef.current;
      if (currentActive && !currentActive.isGroup && currentActive._id === newMsg.conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
        // Automatically mark as read if in conversation
        markConversationSeen(newMsg.conversationId);
      }

      // Update sidebar
      setConversations((prev) => {
        const index = prev.findIndex((c) => c._id === newMsg.conversationId);
        if (index === -1) {
          loadSidebarData();
          return prev;
        }
        const updated = [...prev];
        const conv = { ...updated[index] };
        conv.lastMessage = newMsg;
        conv.lastMessageAt = newMsg.createdAt;
        if (!currentActive || currentActive._id !== newMsg.conversationId) {
          conv.unreadCount = (conv.unreadCount || 0) + 1;
        }
        updated.splice(index, 1);
        return [conv, ...updated];
      });
    };

    // Incoming group message
    const handleGroupMessage = (newMsg) => {
      const currentActive = activeChatRef.current;
      if (currentActive && currentActive.isGroup && currentActive._id === newMsg.conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
        markConversationSeen(newMsg.conversationId);
      }

      // Update sidebar
      setGroups((prev) => {
        const index = prev.findIndex((g) => g._id === newMsg.conversationId);
        if (index === -1) {
          loadSidebarData();
          return prev;
        }
        const updated = [...prev];
        const grp = { ...updated[index] };
        grp.lastMessage = newMsg;
        grp.lastMessageAt = newMsg.createdAt;
        if (!currentActive || currentActive._id !== newMsg.conversationId) {
          grp.unreadCount = (grp.unreadCount || 0) + 1;
        }
        updated.splice(index, 1);
        return [grp, ...updated];
      });
    };

    // User notification for new message
    const handleNewMessageNotification = ({ conversationId, isGroup: msgIsGroup, message: newMsg }) => {
      const currentActive = activeChatRef.current;
      if (!currentActive || currentActive._id !== conversationId) {
        if (msgIsGroup) {
          setGroups((prev) => {
            const index = prev.findIndex((g) => g._id === conversationId);
            if (index === -1) {
              loadSidebarData();
              return prev;
            }
            const updated = [...prev];
            const grp = { ...updated[index], lastMessage: newMsg, lastMessageAt: newMsg.createdAt };
            grp.unreadCount = (grp.unreadCount || 0) + 1;
            updated.splice(index, 1);
            return [grp, ...updated];
          });
        } else {
          setConversations((prev) => {
            const index = prev.findIndex((c) => c._id === conversationId);
            if (index === -1) {
              loadSidebarData();
              return prev;
            }
            const updated = [...prev];
            const conv = { ...updated[index], lastMessage: newMsg, lastMessageAt: newMsg.createdAt };
            conv.unreadCount = (conv.unreadCount || 0) + 1;
            updated.splice(index, 1);
            return [conv, ...updated];
          });
        }
      }
    };

    // Message edited
    const handleMessageEdited = (data) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === data.messageId
            ? { ...m, content: data.content, edited: true, updatedAt: data.updatedAt }
            : m
        )
      );
    };

    // Message deleted
    const handleMessageDeleted = (data) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === data.messageId
            ? {
                ...m,
                deleted: true,
                content: data.content,
                mediaId: null,
                fileName: '',
                duration: 0,
                reactions: {}
              }
            : m
        )
      );
    };

    // Reaction updated
    const handleReactionUpdated = (data) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === data.messageId ? { ...m, reactions: data.reactions } : m
        )
      );
    };

    // Messages seen
    const handleMessagesSeen = ({ conversationId }) => {
      const currentActive = activeChatRef.current;
      if (currentActive && currentActive._id === conversationId) {
        setMessages((prev) =>
          prev.map((m) => (m.status !== 'seen' ? { ...m, status: 'seen' } : m))
        );
      }
    };

    // Typing start/stop
    const handlePrivateTypingStart = ({ conversationId, userName }) => {
      setTypingState((prev) => ({
        ...prev,
        [conversationId]: { isTyping: true, userName }
      }));
    };

    const handlePrivateTypingStop = ({ conversationId }) => {
      setTypingState((prev) => ({
        ...prev,
        [conversationId]: { isTyping: false }
      }));
    };

    const handleGroupTypingStart = ({ groupId, userName }) => {
      setTypingState((prev) => ({
        ...prev,
        [groupId]: { isTyping: true, userName }
      }));
    };

    const handleGroupTypingStop = ({ groupId }) => {
      setTypingState((prev) => ({
        ...prev,
        [groupId]: { isTyping: false }
      }));
    };

    // Group events
    const handleGroupCreated = () => loadSidebarData();
    const handleGroupJoined = () => loadSidebarData();

    socket.on('private_message', handlePrivateMessage);
    socket.on('group_message', handleGroupMessage);
    socket.on('new_message_notification', handleNewMessageNotification);
    socket.on('message_edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('reaction_updated', handleReactionUpdated);
    socket.on('messages_seen', handleMessagesSeen);
    socket.on('private_typing_start', handlePrivateTypingStart);
    socket.on('private_typing_stop', handlePrivateTypingStop);
    socket.on('group_typing_start', handleGroupTypingStart);
    socket.on('group_typing_stop', handleGroupTypingStop);
    socket.on('group_created', handleGroupCreated);
    socket.on('group_joined', handleGroupJoined);

    return () => {
      socket.off('private_message', handlePrivateMessage);
      socket.off('group_message', handleGroupMessage);
      socket.off('new_message_notification', handleNewMessageNotification);
      socket.off('message_edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('reaction_updated', handleReactionUpdated);
      socket.off('messages_seen', handleMessagesSeen);
      socket.off('private_typing_start', handlePrivateTypingStart);
      socket.off('private_typing_stop', handlePrivateTypingStop);
      socket.off('group_typing_start', handleGroupTypingStart);
      socket.off('group_typing_stop', handleGroupTypingStop);
      socket.off('group_created', handleGroupCreated);
      socket.off('group_joined', handleGroupJoined);
    };
  }, [socket, loadSidebarData]);

  // Actions
  const handleSendMessage = async (msgData) => {
    if (!activeChat) return;
    try {
      const res = await apiSendMessage(activeChat._id, msgData);
      if (res.success && res.message) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === res.message._id)) return prev;
          return [...prev, res.message];
        });

        // Update sidebar conversation item immediately
        if (activeChat.isGroup) {
          setGroups((prev) => {
            const index = prev.findIndex((g) => g._id === activeChat._id);
            if (index === -1) return prev;
            const updated = [...prev];
            const grp = { ...updated[index], lastMessage: res.message, lastMessageAt: new Date() };
            updated.splice(index, 1);
            return [grp, ...updated];
          });
        } else {
          setConversations((prev) => {
            const index = prev.findIndex((c) => c._id === activeChat._id);
            if (index === -1) return prev;
            const updated = [...prev];
            const conv = { ...updated[index], lastMessage: res.message, lastMessageAt: new Date() };
            updated.splice(index, 1);
            return [conv, ...updated];
          });
        }
      }
    } catch (err) {
      alert('Error sending message: ' + err.message);
    }
  };

  const handleEditMessage = async (messageId, content) => {
    try {
      await apiEditMessage(messageId, content);
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, content, edited: true } : m))
      );
    } catch (err) {
      alert('Error editing message: ' + err.message);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Delete this message for everyone?')) return;
    try {
      await apiDeleteMessage(messageId);
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId
            ? { ...m, deleted: true, content: 'This message was deleted', reactions: {} }
            : m
        )
      );
    } catch (err) {
      alert('Error deleting message: ' + err.message);
    }
  };

  const handleReactMessage = async (messageId, emoji) => {
    try {
      const res = await apiToggleReaction(messageId, emoji);
      if (res.success) {
        setMessages((prev) =>
          prev.map((m) => (m._id === messageId ? { ...m, reactions: res.reactions } : m))
        );
      }
    } catch (err) {
      console.error('Error toggling reaction:', err);
    }
  };

  const handleTypingStart = () => {
    if (!socket || !activeChat) return;
    if (activeChat.isGroup) {
      socket.emit('group_typing_start', { groupId: activeChat._id });
    } else {
      socket.emit('private_typing_start', { conversationId: activeChat._id });
    }
  };

  const handleTypingStop = () => {
    if (!socket || !activeChat) return;
    if (activeChat.isGroup) {
      socket.emit('group_typing_stop', { groupId: activeChat._id });
    } else {
      socket.emit('private_typing_stop', { conversationId: activeChat._id });
    }
  };

  const handleSelectUserFromSearch = async (targetUser) => {
    try {
      const res = await startPrivateConversation(targetUser._id);
      if (res.success && res.conversation) {
        // If not in conversations list yet, prepend it
        setConversations((prev) => {
          if (!prev.some((c) => c._id === res.conversation._id)) {
            return [res.conversation, ...prev];
          }
          return prev;
        });
        handleSelectChat(res.conversation);
      }
    } catch (err) {
      alert('Could not start conversation: ' + err.message);
    }
  };

  const handleLoadOlderMessages = () => {
    if (!hasMoreMessages || isLoadingOlder || !activeChat) return;
    loadMessagesForChat(activeChat, page + 1);
  };

  const currentChatTyping = activeChat ? typingState[activeChat._id] : null;

  return (
    <div className="app-layout">
      {/* Sidebar (Conversations / Groups / Profile / Search) */}
      <Sidebar
        currentUser={user}
        activeChat={activeChat}
        conversations={conversations}
        groups={groups}
        onSelectChat={handleSelectChat}
        onOpenNewChat={() => setIsSearchModalOpen(true)}
        onOpenNewGroup={() => setIsGroupModalOpen(true)}
        onLogout={logout}
        isVisibleOnMobile={!isMobileChatActive}
      />

      {/* Main Chat Area */}
      <ChatArea
        activeChat={activeChat}
        currentUserId={user?._id}
        messages={messages}
        isTyping={Boolean(currentChatTyping?.isTyping)}
        typingUserName={currentChatTyping?.userName || ''}
        isOnline={
          activeChat && !activeChat.isGroup && activeChat.participant
            ? isOnline(activeChat.participant._id)
            : false
        }
        onBack={() => setIsMobileChatActive(false)}
        onSendMessage={handleSendMessage}
        onEditMessage={handleEditMessage}
        onDeleteMessage={handleDeleteMessage}
        onReactMessage={handleReactMessage}
        onTypingStart={handleTypingStart}
        onTypingStop={handleTypingStop}
        hasMoreMessages={hasMoreMessages}
        onLoadOlderMessages={handleLoadOlderMessages}
        isLoadingOlder={isLoadingOlder}
        onGroupUpdated={(updated) => {
          setActiveChat(updated);
          loadSidebarData();
        }}
        isActiveOnMobile={isMobileChatActive}
      />

      {/* User Search & Direct Chat Start Modal */}
      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectUser={handleSelectUserFromSearch}
      />

      {/* Create New Group Modal */}
      <GroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        currentUserId={user?._id}
        onGroupCreated={(newGroup) => {
          setGroups((prev) => [newGroup, ...prev]);
          handleSelectChat(newGroup);
        }}
      />
    </div>
  );
};
