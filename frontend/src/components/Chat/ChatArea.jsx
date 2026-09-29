import React, { useState } from 'react';
import { ChatHeader } from './ChatHeader.jsx';
import { MessageList } from './MessageList.jsx';
import { MessageComposer } from './MessageComposer.jsx';
import { ImageViewerModal } from './ImageViewerModal.jsx';
import { GroupModal } from './GroupModal.jsx';

export const ChatArea = ({
  activeChat,
  currentUserId,
  messages = [],
  isTyping = false,
  typingUserName = '',
  isOnline = false,
  onBack,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onReactMessage,
  onTypingStart,
  onTypingStop,
  hasMoreMessages = false,
  onLoadOlderMessages,
  isLoadingOlder = false,
  onGroupUpdated,
  isActiveOnMobile
}) => {
  const [replyingTo, setReplyingTo] = useState(null);
  const [viewingImage, setViewingImage] = useState(null); // { url, fileName }
  const [showGroupModal, setShowGroupModal] = useState(false);

  if (!activeChat) {
    return (
      <main className={`chat-area ${isActiveOnMobile ? 'active-mobile' : ''}`}>
        <div className="chat-empty-state">
          <div className="empty-state-icon">⚡</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main)' }}>
            Welcome to Nudge Chat
          </h2>
          <p style={{ maxWidth: 360, fontSize: 14, lineHeight: 1.5 }}>
            Pick a conversation from the sidebar or click <strong>✏️</strong> to find people and nudge them in real-time.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={`chat-area ${isActiveOnMobile ? 'active-mobile' : ''}`}>
      {/* Active Conversation Header */}
      <ChatHeader
        activeChat={activeChat}
        isTyping={isTyping}
        typingUserName={typingUserName}
        isOnline={isOnline}
        onBack={onBack}
        onOpenInfo={() => setShowGroupModal(true)}
      />

      {/* Message List */}
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        isGroup={activeChat.isGroup}
        onReply={(msg) => setReplyingTo(msg)}
        onEdit={onEditMessage}
        onDelete={onDeleteMessage}
        onReact={onReactMessage}
        onViewImage={(url, fileName) => setViewingImage({ url, fileName })}
        hasMore={hasMoreMessages}
        onLoadMore={onLoadOlderMessages}
        isLoadingOlder={isLoadingOlder}
      />

      {/* Typing indicator bubble */}
      {isTyping && (
        <div className="typing-bar">
          <div className="typing-dots">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
          <span>
            {activeChat.isGroup ? `${typingUserName || 'Someone'} is typing...` : 'typing...'}
          </span>
        </div>
      )}

      {/* Message Composer */}
      <MessageComposer
        onSendMessage={onSendMessage}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
      />

      {/* Image Viewer Lightbox Modal */}
      {viewingImage && (
        <ImageViewerModal
          imageUrl={viewingImage.url}
          fileName={viewingImage.fileName}
          onClose={() => setViewingImage(null)}
        />
      )}

      {/* Group Info Modal */}
      {showGroupModal && activeChat.isGroup && (
        <GroupModal
          isOpen={showGroupModal}
          onClose={() => setShowGroupModal(false)}
          group={activeChat}
          currentUserId={currentUserId}
          onGroupUpdated={onGroupUpdated}
        />
      )}
    </main>
  );
};
