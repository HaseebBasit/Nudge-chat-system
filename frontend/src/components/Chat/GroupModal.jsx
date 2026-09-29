import React, { useState, useEffect } from 'react';
import { Modal } from '../Common/Modal.jsx';
import { Avatar } from '../Common/Avatar.jsx';
import { searchUsers, createGroup, addGroupMember, removeGroupMember } from '../../services/chatService.js';
import { useSocket } from '../../context/SocketContext.jsx';

export const GroupModal = ({
  isOpen,
  onClose,
  group = null, // If provided, shows group info & member management mode; if null, create mode
  currentUserId,
  onGroupCreated,
  onGroupUpdated
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { isOnline } = useSocket();
  const isCreateMode = !group;
  const isAdmin = group && String(group.admin?._id || group.admin) === String(currentUserId);

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUserIds(new Set());
      setSelectedUsers([]);
      setError('');
    }
  }, [isOpen]);

  // Search users to add
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length >= 1) {
        try {
          const res = await searchUsers(searchQuery.trim());
          if (res.success) {
            setSearchResults(res.users);
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        setSearchResults([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleSelectUser = (u) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(u._id)) {
        next.delete(u._id);
        setSelectedUsers((users) => users.filter((x) => x._id !== u._id));
      } else {
        next.add(u._id);
        setSelectedUsers((users) => [...users, u]);
      }
      return next;
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a group name.');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      const res = await createGroup({
        name: name.trim(),
        description: description.trim(),
        members: Array.from(selectedUserIds)
      });

      if (res.success) {
        onGroupCreated(res.group);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to create group');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMemberToExisting = async (userId) => {
    try {
      setIsLoading(true);
      const res = await addGroupMember(group._id, userId);
      if (res.success) {
        onGroupUpdated(res.group);
        setSearchQuery('');
        setSearchResults([]);
      }
    } catch (err) {
      alert(err.message || 'Failed to add member');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Remove this member from the group?')) return;
    try {
      setIsLoading(true);
      const res = await removeGroupMember(group._id, userId);
      if (res.success) {
        if (String(userId) === String(currentUserId)) {
          onClose();
        }
        if (onGroupUpdated) {
          onGroupUpdated({
            ...group,
            members: group.members.filter((m) => String(m._id || m) !== String(userId))
          });
        }
      }
    } catch (err) {
      alert(err.message || 'Failed to remove member');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isCreateMode ? 'Create New Group' : `Group Info: ${group.name}`}
    >
      {error && <div className="auth-alert auth-alert-error" style={{ marginBottom: 12 }}>{error}</div>}

      {isCreateMode ? (
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Group Name *</label>
            <input
              type="text"
              placeholder="e.g. Engineering Team"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description (optional)</label>
            <input
              type="text"
              placeholder="What is this group for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Add Members</label>
            <input
              type="text"
              placeholder="Search users to add..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Selected pills */}
          {selectedUsers.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selectedUsers.map((u) => (
                <span
                  key={u._id}
                  className="badge badge-primary"
                  style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
                  onClick={() => toggleSelectUser(u)}
                >
                  {u.name} ✕
                </span>
              ))}
            </div>
          )}

          {/* Search suggestions */}
          <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {searchResults.map((u) => {
              const selected = selectedUserIds.has(u._id);
              return (
                <div
                  key={u._id}
                  className="user-select-row"
                  onClick={() => toggleSelectUser(u)}
                  style={{ background: selected ? '#eef2ff' : 'transparent' }}
                >
                  <div className="user-select-info">
                    <Avatar name={u.name} mediaId={u.profileMediaId} size={32} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</span>
                  </div>
                  <input type="checkbox" checked={selected} readOnly />
                </div>
              );
            })}
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading || !name.trim()}
            style={{ marginTop: 8 }}
          >
            {isLoading ? 'Creating Group...' : 'Create Group'}
          </button>
        </form>
      ) : (
        /* View / Manage existing group */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h4 style={{ fontSize: 16, fontWeight: 700 }}>{group.name}</h4>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{group.description || 'No description provided.'}</p>
          </div>

          {isAdmin && (
            <div className="form-group">
              <label className="form-label">Add new member (Admin only)</label>
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                {searchResults
                  .filter((u) => !group.members.some((m) => String(m._id || m) === String(u._id)))
                  .map((u) => (
                    <div
                      key={u._id}
                      className="user-select-row"
                      onClick={() => handleAddMemberToExisting(u._id)}
                    >
                      <div className="user-select-info">
                        <Avatar name={u.name} size={30} />
                        <span style={{ fontSize: 13 }}>{u.name}</span>
                      </div>
                      <button type="button" className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }}>
                        + Add
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div>
            <h5 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)' }}>
              MEMBERS ({group.members?.length || 0})
            </h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
              {group.members?.map((member) => {
                const memberId = String(member._id || member);
                const isMemberAdmin = String(group.admin?._id || group.admin) === memberId;
                const isSelf = memberId === String(currentUserId);

                return (
                  <div key={memberId} className="user-select-row">
                    <div className="user-select-info">
                      <Avatar
                        name={member.name || 'Member'}
                        mediaId={member.profileMediaId}
                        size={34}
                        isOnline={isOnline(memberId)}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {member.name || 'User'} {isSelf && '(You)'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {isMemberAdmin ? '👑 Admin' : 'Member'}
                        </span>
                      </div>
                    </div>

                    {(isAdmin || isSelf) && !isMemberAdmin && (
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: 11, padding: '4px 8px', color: 'var(--danger)' }}
                        onClick={() => handleRemoveMember(memberId)}
                      >
                        {isSelf ? 'Leave' : 'Remove'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
