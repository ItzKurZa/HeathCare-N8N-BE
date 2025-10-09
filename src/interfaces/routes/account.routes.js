import express from 'express';
import { signup, signin, getProfile, signOut } from '../controllers/account.controller.js';
import { requireAuth } from '../../infrastructure/middlewares/auth.middleware.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/signin', signin);
router.get('/profile', requireAuth, getProfile);
router.post('/signout', requireAuth, signOut);

export default router;