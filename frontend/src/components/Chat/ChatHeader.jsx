import React from 'react';
import { Avatar } from '../Common/Avatar.jsx';

export const ChatHeader = ({
  activeChat,
  isTyping,
  typingUserName,
  isOnline,
  onBack,
  onOpenInfo
}) => {
  if (!activeChat) return null;

  const isGroup = activeChat.isGroup;
  const title = isGroup ? activeChat.name : activeChat.participant?.name;
  const avatarMediaId = isGroup ? activeChat.avatarMediaId : activeChat.participant?.profileMediaId;

  return (
    <div className="chat-header">
      <div className="chat-header-info">
        <button
          type="button"
          className="mobile-back-btn"
          onClick={onBack}
          title="Back to conversations"
        >
          ←
        </button>

        <Avatar
          name={title || 'Chat'}
          mediaId={avatarMediaId}
          size={42}
          isOnline={isGroup ? false : isOnline}
          showStatus={!isGroup}
        />

        <div className="chat-header-meta">
          <span className="chat-header-title">{title}</span>
          <span className={`chat-header-status ${!isGroup && isOnline ? 'online' : ''}`}>
            {isTyping ? (
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                {isGroup ? `${typingUserName || 'Someone'} is typing...` : 'Typing...'}
              </span>
            ) : isGroup ? (
              `${activeChat.memberCount || activeChat.members?.length || 0} members`
            ) : isOnline ? (
              '● Online'
            ) : (
              'Offline'
            )}
          </span>
        </div>
      </div>

      <div className="chat-header-actions">
        {isGroup && (
          <button
            type="button"
            className="btn-icon"
            onClick={onOpenInfo}
            title="Group info & members"
          >
            ℹ️
          </button>
        )}
      </div>
    </div>
  );
};
