import { Router } from 'express';
import { register, login } from '../controllers/authController.js';

const router = Router();

/** POST /signup */
router.post('/signup', register);

/** POST /login */
router.post('/login', login);

export default router;
