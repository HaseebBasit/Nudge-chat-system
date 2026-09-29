import React, { useState, useRef, useEffect } from 'react';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder.js';
import { uploadMediaFile } from '../../services/mediaService.js';
import { formatAudioDuration } from '../../utils/formatTime.js';

const COMMON_EMOJIS = ['😊', '😂', '🔥', '👍', '❤️', '🎉', '🙌', '✨', '👋', '💯'];

export const MessageComposer = ({
  onSendMessage,
  replyingTo,
  onCancelReply,
  onTypingStart,
  onTypingStop,
  disabled = false
}) => {
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiRow, setShowEmojiRow] = useState(false);

  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording
  } = useVoiceRecorder();

  // Handle typing indicator debouncing
  const handleTextChange = (e) => {
    setText(e.target.value);

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      if (onTypingStart) onTypingStart();
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      if (onTypingStop) onTypingStop();
    }, 1800);
  };

  const handleSendText = (e) => {
    if (e) e.preventDefault();
    if (!text.trim() || disabled || isUploading) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      isTypingRef.current = false;
      if (onTypingStop) onTypingStop();
    }

    onSendMessage({
      type: 'text',
      content: text.trim(),
      replyTo: replyingTo?._id || null
    });

    setText('');
    if (replyingTo) onCancelReply();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  // Handle file uploads (Images & General Attachments)
  const handleFileUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const media = await uploadMediaFile(file);

      await onSendMessage({
        type: type || (file.type.startsWith('image/') ? 'image' : 'file'),
        content: '',
        mediaId: media.fileId,
        fileName: media.fileName,
        mimeType: media.mimeType,
        fileSize: media.fileSize,
        replyTo: replyingTo?._id || null
      });

      if (replyingTo) onCancelReply();
    } catch (err) {
      alert('Failed to upload file: ' + (err.message || 'Server error'));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Handle voice recording send
  const handleSendVoice = async () => {
    try {
      setIsUploading(true);
      const recordResult = await stopRecording();
      if (!recordResult || !recordResult.blob) return;

      const { blob, duration, mimeType } = recordResult;
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: mimeType });

      const media = await uploadMediaFile(file);

      await onSendMessage({
        type: 'voice',
        content: '',
        mediaId: media.fileId,
        fileName: media.fileName,
        mimeType: media.mimeType,
        fileSize: media.fileSize,
        duration: Math.max(1, duration),
        replyTo: replyingTo?._id || null
      });

      if (replyingTo) onCancelReply();
    } catch (err) {
      alert('Failed to send voice recording: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="message-composer">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFileUpload(e, 'image')}
      />
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf,.doc,.docx,.txt,.zip,.rar,.csv,.xlsx,.pptx"
        style={{ display: 'none' }}
        onChange={(e) => handleFileUpload(e, 'file')}
      />

      {/* Reply Preview Bar */}
      {replyingTo && (
        <div className="composer-reply-preview">
          <div>
            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
              Replying to {replyingTo.senderId?.name || 'User'}
            </span>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
              {replyingTo.content || (replyingTo.type === 'image' ? 'Photo' : 'Voice note')}
            </div>
          </div>
          <button
            type="button"
            className="btn-icon"
            style={{ width: 24, height: 24, fontSize: 13 }}
            onClick={onCancelReply}
          >
            ✕
          </button>
        </div>
      )}

      {/* Quick Emoji Bar */}
      {showEmojiRow && (
        <div style={{ display: 'flex', gap: 8, padding: '4px 0' }}>
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}
              onClick={() => {
                setText((prev) => prev + emoji);
                setShowEmojiRow(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Main Composer Row */}
      {isRecording ? (
        /* Voice Recording Active UI */
        <div className="composer-recording-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="recording-pulse" />
            <span className="recording-time">
              Recording... {formatAudioDuration(recordingDuration)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={cancelRecording}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ padding: '6px 14px', fontSize: 12 }}
              onClick={handleSendVoice}
            >
              Send Voice
            </button>
          </div>
        </div>
      ) : (
        /* Standard Typing & Attachments UI */
        <div className="composer-main-row">
          <div className="composer-actions">
            <button
              type="button"
              className="btn-icon"
              title="Add Emoji"
              onClick={() => setShowEmojiRow(!showEmojiRow)}
            >
              😀
            </button>
            <button
              type="button"
              className="btn-icon"
              title="Send Photo"
              onClick={() => imageInputRef.current?.click()}
            >
              📷
            </button>
            <button
              type="button"
              className="btn-icon"
              title="Attach File (PDF, DOC, ZIP)"
              onClick={() => fileInputRef.current?.click()}
            >
              📎
            </button>
          </div>

          <textarea
            className="composer-input"
            rows="1"
            placeholder={isUploading ? 'Uploading file...' : 'Write a nudge... (Enter to send)'}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            disabled={disabled || isUploading}
          />

          <div className="composer-actions">
            {text.trim().length > 0 ? (
              <button
                type="button"
                className="btn-primary"
                style={{ width: 40, height: 40, borderRadius: '50%', padding: 0 }}
                onClick={handleSendText}
                disabled={disabled || isUploading}
                title="Send message"
              >
                ➤
              </button>
            ) : (
              <button
                type="button"
                className="btn-icon"
                style={{ width: 40, height: 40, color: 'var(--primary)' }}
                onClick={() => startRecording().catch((err) => alert(err.message))}
                disabled={disabled || isUploading}
                title="Hold or click to record voice"
              >
                🎙
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
