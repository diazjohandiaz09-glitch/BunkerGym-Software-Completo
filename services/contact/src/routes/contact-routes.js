import { Router } from 'express';
import { getContact } from '../controllers/contact-controller.js';

const router = Router();

router.get('/', getContact);

export default router;