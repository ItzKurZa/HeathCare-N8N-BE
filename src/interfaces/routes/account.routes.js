import express from 'express';
import { signup, signin, getProfile, signOut, refreshToken } from '../controllers/account.controller.js';
import { requireAuth } from '../../infrastructure/middlewares/auth.middleware.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/signin', signin);
router.get('/profile', requireAuth, getProfile);
router.post('/signout', requireAuth, signOut);
router.post('/refresh', refreshToken);

export default router;