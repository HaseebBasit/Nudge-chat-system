import React, { useState } from 'react';
import { Avatar } from '../Common/Avatar.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { formatConversationTime } from '../../utils/formatTime.js';

export const Sidebar = ({
  currentUser,
  activeChat,
  conversations = [],
  groups = [],
  onSelectChat,
  onOpenNewChat,
  onOpenNewGroup,
  onLogout,
  isVisibleOnMobile
}) => {
  const [activeTab, setActiveTab] = useState('direct'); // 'direct' | 'groups'
  const [searchFilter, setSearchFilter] = useState('');
  const { isOnline } = useSocket();

  const currentUserId = currentUser?._id;

  const renderLastMessageSnippet = (lastMsg) => {
    if (!lastMsg) return 'No messages yet';
    if (lastMsg.deleted) return '🚫 This message was deleted';
    if (lastMsg.type === 'image') return '📷 Photo';
    if (lastMsg.type === 'voice') return '🎤 Voice message';
    if (lastMsg.type === 'file') return `📎 ${lastMsg.fileName || 'Attachment'}`;
    return lastMsg.content || '';
  };

  const filteredConversations = conversations.filter((c) => {
    if (!searchFilter.trim()) return true;
    const name = c.participant?.name || '';
    return name.toLowerCase().includes(searchFilter.toLowerCase());
  });

  const filteredGroups = groups.filter((g) => {
    if (!searchFilter.trim()) return true;
    return g.name.toLowerCase().includes(searchFilter.toLowerCase());
  });

  return (
    <aside className={`sidebar ${!isVisibleOnMobile ? 'hidden-mobile' : ''}`}>
      {/* Sidebar Header with Branding */}
      <div className="sidebar-header">
        <div className="app-branding">
          <div className="app-logo-icon">⚡</div>
          <span className="app-title">Nudge Chat</span>
        </div>

        <div className="sidebar-actions">
          <button
            type="button"
            className="btn-icon"
            onClick={onOpenNewChat}
            title="Start new conversation"
          >
            ✏️
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={onOpenNewGroup}
            title="Create group"
          >
            👥
          </button>
        </div>
      </div>

      {/* Current User Strip */}
      <div className="user-profile-strip">
        <div className="user-info">
          <Avatar
            name={currentUser?.name}
            mediaId={currentUser?.profileMediaId}
            size={36}
            isOnline={true}
          />
          <div className="user-names">
            <span className="user-name-text">{currentUser?.name}</span>
            <span className="user-status-text">{currentUser?.email}</span>
          </div>
        </div>

        <button
          type="button"
          className="btn-icon"
          onClick={onLogout}
          title="Sign out of Nudge Chat"
        >
          🚪
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="sidebar-search">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search conversations..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Sidebar Tabs */}
      <div className="sidebar-tabs">
        <button
          type="button"
          className={`sidebar-tab ${activeTab === 'direct' ? 'active' : ''}`}
          onClick={() => setActiveTab('direct')}
        >
          Direct ({conversations.length})
        </button>
        <button
          type="button"
          className={`sidebar-tab ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          Groups ({groups.length})
        </button>
      </div>

      {/* Conversations / Groups List */}
      <div className="conversation-list">
        {activeTab === 'direct' ? (
          filteredConversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-light)', fontSize: 13 }}>
              {searchFilter ? 'No conversations match filter.' : 'No direct messages yet. Click ✏️ above to start one!'}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const participant = conv.participant;
              const online = participant ? isOnline(participant._id) : false;
              const isActive = activeChat && !activeChat.isGroup && activeChat._id === conv._id;

              return (
                <div
                  key={conv._id}
                  className={`conversation-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectChat(conv)}
                >
                  <Avatar
                    name={participant?.name || 'User'}
                    mediaId={participant?.profileMediaId}
                    size={46}
                    isOnline={online}
                  />

                  <div className="conversation-content">
                    <div className="conversation-row-top">
                      <span className="conversation-title">{participant?.name || 'User'}</span>
                      <span className="conversation-time">
                        {formatConversationTime(conv.lastMessageAt || conv.updatedAt)}
                      </span>
                    </div>

                    <div className="conversation-row-bottom">
                      <span className="conversation-last-msg">
                        {renderLastMessageSnippet(conv.lastMessage)}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span className="badge badge-primary">{conv.unreadCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )
        ) : filteredGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-light)', fontSize: 13 }}>
            {searchFilter ? 'No groups match filter.' : 'No groups yet. Click 👥 above to create one!'}
          </div>
        ) : (
          filteredGroups.map((grp) => {
            const isActive = activeChat && activeChat.isGroup && activeChat._id === grp._id;

            return (
              <div
                key={grp._id}
                className={`conversation-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectChat(grp)}
              >
                <Avatar
                  name={grp.name}
                  mediaId={grp.avatarMediaId}
                  size={46}
                  showStatus={false}
                />

                <div className="conversation-content">
                  <div className="conversation-row-top">
                    <span className="conversation-title">{grp.name}</span>
                    <span className="conversation-time">
                      {formatConversationTime(grp.lastMessageAt || grp.updatedAt)}
                    </span>
                  </div>

                  <div className="conversation-row-bottom">
                    <span className="conversation-last-msg">
                      {renderLastMessageSnippet(grp.lastMessage)}
                    </span>
                    {grp.unreadCount > 0 && (
                      <span className="badge badge-primary">{grp.unreadCount}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
