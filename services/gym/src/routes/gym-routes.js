import { Router } from 'express';
import { getGym } from '../controllers/gym-controller.js';

const router = Router();

router.get('/', getGym);

export default router;