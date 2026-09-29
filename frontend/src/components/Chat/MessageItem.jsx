import React, { useState } from 'react';
import { VoicePlayer } from './VoicePlayer.jsx';
import { getMediaUrl } from '../../services/mediaService.js';
import { formatMessageTime, formatFileSize } from '../../utils/formatTime.js';

const QUICK_EMOJIS = ['❤️', '😂', '👍', '😮', '😢', '🙏'];

export const MessageItem = ({
  message,
  currentUserId,
  isGroup = false,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onViewImage
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [editContent, setEditContent] = useState(message.content || '');

  const isMyMessage = String(message.senderId?._id || message.senderId) === String(currentUserId);
  const isDeleted = Boolean(message.deleted);

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editContent.trim()) return;
    onEdit(message._id, editContent.trim());
    setIsEditingInline(false);
  };

  const renderStatusTick = () => {
    if (!isMyMessage || isDeleted) return null;
    const status = message.status || 'sent';

    if (status === 'seen') {
      return <span className="status-tick seen" title="Seen">✓✓</span>;
    }
    if (status === 'delivered') {
      return <span className="status-tick" title="Delivered">✓✓</span>;
    }
    return <span className="status-tick" title="Sent">✓</span>;
  };

  return (
    <div className={`message-row ${isMyMessage ? 'my-message' : 'other-message'}`}>
      {/* Sender Name in Group Chat */}
      {isGroup && !isMyMessage && (
        <span className="message-sender-name">
          {message.senderId?.name || 'Group Member'}
        </span>
      )}

      {/* Main Bubble */}
      <div className="message-bubble">
        {/* Reply Quote Preview */}
        {message.replyTo && (
          <div className="message-reply-quote">
            <div className="reply-quote-sender">
              {message.replyTo.senderId?.name || 'Reply'}
            </div>
            <div>
              {message.replyTo.type === 'image' && '📷 Photo'}
              {message.replyTo.type === 'voice' && '🎤 Voice message'}
              {message.replyTo.type === 'file' && `📎 ${message.replyTo.fileName || 'File'}`}
              {message.replyTo.type === 'text' && message.replyTo.content}
            </div>
          </div>
        )}

        {/* Deleted Message State */}
        {isDeleted ? (
          <span style={{ fontStyle: 'italic', opacity: 0.75 }}>
            🚫 {message.content || 'This message was deleted'}
          </span>
        ) : (
          <>
            {/* Image Message */}
            {message.type === 'image' && message.mediaId && (
              <div
                className="message-image-wrapper"
                onClick={() => onViewImage(getMediaUrl(message.mediaId), message.fileName)}
              >
                <img
                  src={getMediaUrl(message.mediaId)}
                  alt={message.fileName || 'Photo'}
                  className="message-image"
                  loading="lazy"
                />
              </div>
            )}

            {/* Voice Message */}
            {message.type === 'voice' && message.mediaId && (
              <VoicePlayer
                mediaId={message.mediaId}
                totalDuration={message.duration}
                isMyMessage={isMyMessage}
              />
            )}

            {/* File Attachment */}
            {message.type === 'file' && message.mediaId && (
              <a
                href={getMediaUrl(message.mediaId)}
                download={message.fileName || 'download'}
                target="_blank"
                rel="noreferrer"
                className="message-file-card"
              >
                <div className="file-card-icon">📄</div>
                <div className="file-card-details">
                  <span className="file-card-name">{message.fileName || 'Document'}</span>
                  <span className="file-card-size">{formatFileSize(message.fileSize)}</span>
                </div>
              </a>
            )}

            {/* Text Content / Caption */}
            {isEditingInline ? (
              <form onSubmit={handleSaveEdit} style={{ marginTop: 4 }}>
                <input
                  type="text"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 6,
                    color: '#000000',
                    background: '#ffffff'
                  }}
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 4, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: 11, padding: '4px 8px' }}
                    onClick={() => setIsEditingInline(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    Save
                  </button>
                </div>
              </form>
            ) : (
              message.content && <div>{message.content}</div>
            )}
          </>
        )}

        {/* Message Timestamp & Metadata */}
        <div className="message-meta">
          {message.edited && !isDeleted && (
            <span style={{ fontSize: 10, opacity: 0.8 }}>(edited)</span>
          )}
          <span>{formatMessageTime(message.createdAt)}</span>
          {renderStatusTick()}
        </div>
      </div>

      {/* Floating Action Toolbar on Hover */}
      {!isDeleted && (
        <div className="message-actions-toolbar">
          <button
            type="button"
            className="action-tool-btn"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="React"
          >
            😀
          </button>
          <button
            type="button"
            className="action-tool-btn"
            onClick={() => onReply(message)}
            title="Reply"
          >
            ↩
          </button>
          {isMyMessage && message.type === 'text' && (
            <button
              type="button"
              className="action-tool-btn"
              onClick={() => {
                setEditContent(message.content);
                setIsEditingInline(true);
              }}
              title="Edit message"
            >
              ✎
            </button>
          )}
          {isMyMessage && (
            <button
              type="button"
              className="action-tool-btn"
              onClick={() => onDelete(message._id)}
              title="Delete message"
            >
              🗑
            </button>
          )}
        </div>
      )}

      {/* Quick Emoji Picker Popover */}
      {showEmojiPicker && (
        <div
          style={{
            position: 'absolute',
            top: -36,
            right: isMyMessage ? 0 : 'auto',
            left: isMyMessage ? 'auto' : 0,
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: 24,
            padding: '4px 8px',
            display: 'flex',
            gap: 6,
            boxShadow: 'var(--shadow-lg)',
            zIndex: 10
          }}
        >
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}
              onClick={() => {
                onReact(message._id, emoji);
                setShowEmojiPicker(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Emoji Reactions Row */}
      {message.reactions && Object.keys(message.reactions).length > 0 && (
        <div className="message-reactions-row">
          {Object.entries(message.reactions).map(([emoji, data]) => {
            const hasUserReacted =
              data.hasReacted ||
              data.users?.some((u) => String(u._id || u) === String(currentUserId));

            return (
              <button
                key={emoji}
                type="button"
                className={`reaction-pill ${hasUserReacted ? 'active' : ''}`}
                onClick={() => onReact(message._id, emoji)}
                title={data.users?.map((u) => u.name).join(', ')}
              >
                <span>{emoji}</span>
                <span className="reaction-count">{data.count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
