import mongoose from 'mongoose';
import { uploadBufferToGridFS, findGridFSFile, openGridFSDownloadStream } from '../config/gridfs.js';
import { Message } from '../models/Message.js';
import { Conversation } from '../models/Conversation.js';
import { Group } from '../models/Group.js';

export const uploadMedia = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided for upload.'
      });
    }

    const { originalname, mimetype, buffer, size } = req.file;

    // Upload directly to MongoDB GridFS
    const gridFSFile = await uploadBufferToGridFS({
      buffer,
      filename: originalname || `media-${Date.now()}`,
      contentType: mimetype || 'application/octet-stream',
      metadata: {
        uploaderId: req.user._id,
        uploadedAt: new Date()
      }
    });

    return res.status(201).json({
      success: true,
      media: {
        fileId: gridFSFile._id,
        fileName: originalname,
        mimeType: mimetype,
        fileSize: size
      }
    });
  } catch (error) {
    next(error);
  }
};

export const streamMedia = async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid media file ID.'
      });
    }

    const file = await findGridFSFile(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'Media file not found in storage.'
      });
    }

    // Media Security Verification:
    // 1. If requester is the uploader, allow.
    let isAuthorized = false;
    if (file.metadata?.uploaderId && String(file.metadata.uploaderId) === String(currentUserId)) {
      isAuthorized = true;
    }

    // 2. If attached to a Message, verify conversation/group membership
    if (!isAuthorized) {
      const message = await Message.findOne({ mediaId: file._id });
      if (message) {
        if (message.isGroup) {
          const group = await Group.findById(message.conversationId);
          if (group && group.members.some((m) => String(m) === String(currentUserId))) {
            isAuthorized = true;
          }
        } else {
          const conv = await Conversation.findById(message.conversationId);
          if (conv && conv.participants.some((p) => String(p) === String(currentUserId))) {
            isAuthorized = true;
          }
        }
      }
    }

    // 3. If used as group avatar or profile picture, members/users can view
    if (!isAuthorized) {
      const groupAvatar = await Group.findOne({ avatarMediaId: file._id, members: currentUserId });
      if (groupAvatar) isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to access this private media file.'
      });
    }

    // Stream binary directly to client with correct Content-Type
    const contentType = file.contentType || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', file.length);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename)}"`);

    // Stream from MongoDB GridFS
    const downloadStream = openGridFSDownloadStream(file._id);

    downloadStream.on('error', (err) => {
      if (!res.headersSent) {
        return res.status(500).json({ success: false, message: 'Error streaming media binary' });
      }
      res.end();
    });

    downloadStream.pipe(res);
  } catch (error) {
    next(error);
  }
};
