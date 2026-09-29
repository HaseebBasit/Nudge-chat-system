import { Router } from 'express';
import {
  createGroup,
  getGroups,
  getGroupDetails,
  addGroupMember,
  removeGroupMember,
  renameGroup
} from '../controllers/groupController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect);

router.post('/', createGroup);
router.get('/', getGroups);
router.get('/:groupId', getGroupDetails);
router.patch('/:groupId', renameGroup);
router.post('/:groupId/members', addGroupMember);
router.delete('/:groupId/members/:userId', removeGroupMember);

export default router;
