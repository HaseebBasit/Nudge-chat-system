import React, { useState, useEffect } from 'react';
import { Modal } from '../Common/Modal.jsx';
import { Avatar } from '../Common/Avatar.jsx';
import { searchUsers } from '../../services/chatService.js';
import { useSocket } from '../../context/SocketContext.jsx';

export const SearchModal = ({ isOpen, onClose, onSelectUser }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const { isOnline } = useSocket();

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (query.trim().length >= 1) {
        setIsSearching(true);
        try {
          const res = await searchUsers(query.trim());
          if (res.success) {
            setResults(res.users);
          }
        } catch (err) {
          console.error('Search error:', err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setResults([]);
      }
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Start New Conversation">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <input
          type="text"
          placeholder="Search people by name or email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className="search-input"
          style={{ width: '100%', padding: '10px 14px' }}
        />

        {isSearching && (
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
            Searching users...
          </div>
        )}

        {!isSearching && query.trim() && results.length === 0 && (
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', padding: 12 }}>
            No verified users found matching "{query}".
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
          {results.map((u) => {
            const online = isOnline(u._id);
            return (
              <div
                key={u._id}
                className="user-select-row"
                onClick={() => {
                  onSelectUser(u);
                  onClose();
                }}
              >
                <div className="user-select-info">
                  <Avatar
                    name={u.name}
                    mediaId={u.profileMediaId}
                    size={38}
                    isOnline={online}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email}</span>
                  </div>
                </div>
                <button type="button" className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }}>
                  Chat
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
