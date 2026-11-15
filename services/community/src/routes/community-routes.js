import { Router } from 'express';
import { getCommunity } from '../controllers/community-controller.js';

const router = Router();

router.get('/', getCommunity);

export default router;