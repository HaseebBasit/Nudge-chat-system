import { Router } from 'express';
import {
  getPrivateConversations,
  getOrCreatePrivateConversation,
  getConversationMessages,
  sendMessage,
  markConversationSeen
} from '../controllers/conversationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect);

router.get('/private', getPrivateConversations);
router.post('/private', getOrCreatePrivateConversation);
router.get('/:id/messages', getConversationMessages);
router.post('/:id/messages', sendMessage);
router.post('/:id/read', markConversationSeen);

export default router;
