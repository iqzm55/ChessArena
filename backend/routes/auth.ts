import { Router } from 'express';
import { register, login, me } from '../controllers/authController.js';

const router = Router();

/** POST /api/auth/register */
router.post('/register', register);

/** POST /api/auth/login */
router.post('/login', login);

/** GET /api/auth/me - current user (requires JWT) */
router.get('/me', ...me);

export default router;
