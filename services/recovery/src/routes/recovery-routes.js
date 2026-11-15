import { Router } from 'express';
import { getRecovery } from '../controllers/recovery-controller.js';

const router = Router();

router.get('/', getRecovery);

export default router;