import express from 'express';
import { signup, signin, getProfile, signOut } from '../controllers/account.controller.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/signin', signin);
router.get('/profile/:uid', getProfile);
router.post('/signout', signOut);

export default router;