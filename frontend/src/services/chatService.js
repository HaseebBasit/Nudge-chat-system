import { apiRequest } from './api.js';

// Conversations
export const getPrivateConversations = async () => {
  return apiRequest('/api/conversations/private');
};

export const startPrivateConversation = async (recipientId) => {
  return apiRequest('/api/conversations/private', {
    method: 'POST',
    body: JSON.stringify({ recipientId })
  });
};

export const getConversationMessages = async (conversationId, page = 1, limit = 30) => {
  return apiRequest(`/api/conversations/${conversationId}/messages?page=${page}&limit=${limit}`);
};

export const sendMessage = async (conversationId, messageData) => {
  return apiRequest(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(messageData)
  });
};

export const markConversationSeen = async (conversationId) => {
  return apiRequest(`/api/conversations/${conversationId}/read`, {
    method: 'POST'
  });
};

// Message Actions
export const editMessage = async (messageId, content) => {
  return apiRequest(`/api/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content })
  });
};

export const deleteMessage = async (messageId) => {
  return apiRequest(`/api/messages/${messageId}`, {
    method: 'DELETE'
  });
};

export const toggleReaction = async (messageId, emoji) => {
  return apiRequest(`/api/messages/${messageId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ emoji })
  });
};

// Groups
export const getGroups = async () => {
  return apiRequest('/api/groups');
};

export const createGroup = async (groupData) => {
  return apiRequest('/api/groups', {
    method: 'POST',
    body: JSON.stringify(groupData)
  });
};

export const getGroupDetails = async (groupId) => {
  return apiRequest(`/api/groups/${groupId}`);
};

export const addGroupMember = async (groupId, userId) => {
  return apiRequest(`/api/groups/${groupId}/members`, {
    method: 'POST',
    body: JSON.stringify({ userId })
  });
};

export const removeGroupMember = async (groupId, userId) => {
  return apiRequest(`/api/groups/${groupId}/members/${userId}`, {
    method: 'DELETE'
  });
};

export const renameGroup = async (groupId, name, description) => {
  return apiRequest(`/api/groups/${groupId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name, description })
  });
};

// Users
export const searchUsers = async (query) => {
  return apiRequest(`/api/users/search?q=${encodeURIComponent(query)}`);
};

export const updateProfile = async (profileData) => {
  return apiRequest('/api/users/profile', {
    method: 'PATCH',
    body: JSON.stringify(profileData)
  });
};
