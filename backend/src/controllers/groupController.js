import { Group } from '../models/Group.js';
import { User } from '../models/User.js';
import { MessageReceipt } from '../models/MessageReceipt.js';
import { emitToRoom, emitToUser } from '../sockets/socketEmitter.js';

export const createGroup = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { name, members = [], description = '', avatarMediaId = null } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Group name must be at least 2 characters long.'
      });
    }

    // Include the creator in members and remove duplicates
    const uniqueMemberIds = Array.from(
      new Set([String(currentUserId), ...members.map((m) => String(m))])
    );

    // Verify all member IDs exist
    const validUsers = await User.find({ _id: { $in: uniqueMemberIds } }).select('_id');
    const validMemberIds = validUsers.map((u) => u._id);

    const group = await Group.create({
      name: name.trim(),
      description: description.trim(),
      avatarMediaId: avatarMediaId || null,
      admin: currentUserId,
      members: validMemberIds,
      lastMessageAt: new Date()
    });

    const populatedGroup = await Group.findById(group._id)
      .populate('admin', '_id name email profileMediaId')
      .populate('members', '_id name email profileMediaId statusMessage lastSeen');

    // Notify all members
    for (const memberId of validMemberIds) {
      emitToUser(memberId, 'group_created', populatedGroup);
    }

    return res.status(201).json({
      success: true,
      group: populatedGroup
    });
  } catch (error) {
    next(error);
  }
};

export const getGroups = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;

    // Find all groups where current user is a member
    const groups = await Group.find({ members: currentUserId })
      .sort({ lastMessageAt: -1 })
      .populate('admin', '_id name email')
      .populate('members', '_id name email profileMediaId statusMessage')
      .populate('lastMessage')
      .lean();

    const formatted = await Promise.all(
      groups.map(async (grp) => {
        const unreadCount = await MessageReceipt.countDocuments({
          conversationId: grp._id,
          userId: currentUserId,
          status: { $ne: 'seen' }
        });

        return {
          _id: grp._id,
          isGroup: true,
          name: grp.name,
          description: grp.description,
          avatarMediaId: grp.avatarMediaId,
          admin: grp.admin,
          members: grp.members,
          memberCount: grp.members.length,
          lastMessage: grp.lastMessage,
          lastMessageAt: grp.lastMessageAt,
          unreadCount,
          createdAt: grp.createdAt
        };
      })
    );

    return res.status(200).json({
      success: true,
      groups: formatted
    });
  } catch (error) {
    next(error);
  }
};

export const getGroupDetails = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const currentUserId = req.user._id;

    const group = await Group.findById(groupId)
      .populate('admin', '_id name email profileMediaId')
      .populate('members', '_id name email profileMediaId statusMessage lastSeen');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found.'
      });
    }

    // Verify requesting user is a member
    const isMember = group.members.some(
      (m) => String(m._id) === String(currentUserId)
    );
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You are not a member of this group.'
      });
    }

    return res.status(200).json({
      success: true,
      group
    });
  } catch (error) {
    next(error);
  }
};

export const addGroupMember = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;
    const currentUserId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    // Only group admin can add members
    if (String(group.admin) !== String(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Only the group admin can add members.'
      });
    }

    const userToAdd = await User.findById(userId);
    if (!userToAdd) {
      return res.status(404).json({ success: false, message: 'User to add not found.' });
    }

    if (group.members.some((m) => String(m) === String(userId))) {
      return res.status(400).json({ success: false, message: 'User is already a member.' });
    }

    group.members.push(userId);
    await group.save();

    const updated = await Group.findById(groupId)
      .populate('admin', '_id name email profileMediaId')
      .populate('members', '_id name email profileMediaId statusMessage lastSeen');

    emitToRoom(`group_${groupId}`, 'group_member_added', {
      groupId,
      user: userToAdd.toSafeObject()
    });

    emitToUser(userId, 'group_joined', updated);

    return res.status(200).json({
      success: true,
      message: 'Member added successfully.',
      group: updated
    });
  } catch (error) {
    next(error);
  }
};

export const removeGroupMember = async (req, res, next) => {
  try {
    const { groupId, userId } = req.params;
    const currentUserId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    const isAdmin = String(group.admin) === String(currentUserId);
    const isSelfLeaving = String(userId) === String(currentUserId);

    // Only admin or the user themselves can remove a member
    if (!isAdmin && !isSelfLeaving) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Only the group admin can remove members.'
      });
    }

    // If admin is leaving and there are other members, reassign admin
    group.members = group.members.filter((m) => String(m) !== String(userId));
    if (String(group.admin) === String(userId) && group.members.length > 0) {
      group.admin = group.members[0];
    }

    await group.save();

    emitToRoom(`group_${groupId}`, 'group_member_removed', {
      groupId,
      userId
    });

    emitToUser(userId, 'group_left', { groupId });

    return res.status(200).json({
      success: true,
      message: isSelfLeaving ? 'Left group successfully.' : 'Member removed successfully.'
    });
  } catch (error) {
    next(error);
  }
};

export const renameGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { name, description } = req.body;
    const currentUserId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    if (String(group.admin) !== String(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Only group admin can rename the group.'
      });
    }

    if (name) group.name = name.trim();
    if (description !== undefined) group.description = description.trim();
    await group.save();

    emitToRoom(`group_${groupId}`, 'group_updated', {
      groupId,
      name: group.name,
      description: group.description
    });

    return res.status(200).json({
      success: true,
      group
    });
  } catch (error) {
    next(error);
  }
};
