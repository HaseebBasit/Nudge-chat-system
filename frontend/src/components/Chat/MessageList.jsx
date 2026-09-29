import React, { useEffect, useRef } from 'react';
import { MessageItem } from './MessageItem.jsx';

export const MessageList = ({
  messages,
  currentUserId,
  isGroup,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onViewImage,
  hasMore,
  onLoadMore,
  isLoadingOlder
}) => {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    // Auto scroll to bottom when new messages arrive or on initial load
    if (bottomRef.current) {
      if (isFirstLoadRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'auto' });
        isFirstLoadRef.current = false;
      } else {
        bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages.length]);

  return (
    <div className="messages-container" ref={containerRef}>
      {hasMore && (
        <button
          type="button"
          className="btn-secondary load-more-btn"
          onClick={onLoadMore}
          disabled={isLoadingOlder}
        >
          {isLoadingOlder ? 'Loading earlier messages...' : '↑ Load older messages'}
        </button>
      )}

      {messages.length === 0 ? (
        <div
          style={{
            margin: 'auto',
            textAlign: 'center',
            color: 'var(--text-light)',
            padding: 32
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 8 }}>💬</div>
          <p style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
            No messages here yet
          </p>
          <p style={{ fontSize: 13 }}>
            Send a message or voice note to break the ice!
          </p>
        </div>
      ) : (
        messages.map((message) => (
          <MessageItem
            key={message._id}
            message={message}
            currentUserId={currentUserId}
            isGroup={isGroup}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
            onReact={onReact}
            onViewImage={onViewImage}
          />
        ))
      )}

      <div ref={bottomRef} style={{ height: 1 }} />
    </div>
  );
};
