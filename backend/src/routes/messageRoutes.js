import { Router } from 'express';
import { editMessage, deleteMessage, toggleReaction } from '../controllers/messageController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect);

router.patch('/:messageId', editMessage);
router.delete('/:messageId', deleteMessage);
router.post('/:messageId/reactions', toggleReaction);

export default router;
