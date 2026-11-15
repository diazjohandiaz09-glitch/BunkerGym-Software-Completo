import { Router } from 'express';
import { getFaq } from '../controllers/faq-controller.js';
const router = Router();
router.get('/', getFaq);
export default router;