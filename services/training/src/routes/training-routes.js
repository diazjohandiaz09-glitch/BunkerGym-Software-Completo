import { Router } from 'express';
import { getTraining } from '../controllers/training-controller.js';

const router = Router();

router.get('/', getTraining);

export default router;