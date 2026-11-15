import { Router } from 'express';
import { getFacilities } from '../controllers/facilities-controller.js';
const router = Router();
router.get('/', getFacilities);
export default router;