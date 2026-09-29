import { Router } from 'express';
import { uploadMedia, streamMedia } from '../controllers/mediaController.js';
import { protect } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = Router();

// Upload media file directly to MongoDB GridFS
router.post('/upload', protect, upload.single('file'), uploadMedia);

// Stream binary media directly from GridFS with proper MIME type
router.get('/:fileId', protect, streamMedia);

export default router;
