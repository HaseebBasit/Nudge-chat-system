import { User } from '../models/User.js';
import { isUserOnline } from '../sockets/socketHandler.js';

export const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    const currentUserId = req.user._id;

    if (!q || q.trim() === '') {
      return res.status(200).json({
        success: true,
        users: []
      });
    }

    const searchQuery = q.trim();
    const regex = new RegExp(searchQuery, 'i');

    const users = await User.find({
      _id: { $ne: currentUserId },
      isEmailVerified: true,
      $or: [{ name: regex }, { email: regex }]
    })
      .select('_id name email profileMediaId statusMessage lastSeen')
      .limit(20)
      .lean();

    const formattedUsers = users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      profileMediaId: u.profileMediaId,
      statusMessage: u.statusMessage,
      lastSeen: u.lastSeen,
      isOnline: isUserOnline(u._id)
    }));

    return res.status(200).json({
      success: true,
      users: formattedUsers
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, statusMessage, profileMediaId } = req.body;
    const updates = {};

    if (name && name.trim().length >= 2) {
      updates.name = name.trim();
    }
    if (statusMessage !== undefined) {
      updates.statusMessage = statusMessage.trim();
    }
    if (profileMediaId !== undefined) {
      updates.profileMediaId = profileMediaId;
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, { new: true });

    return res.status(200).json({
      success: true,
      user: updatedUser.toSafeObject()
    });
  } catch (error) {
    next(error);
  }
};
