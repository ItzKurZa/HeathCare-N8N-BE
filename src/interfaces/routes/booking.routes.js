import express from 'express';
import { submitBooking, getProfileData } from '../controllers/booking.controller.js';

const router = express.Router();

router.post('/booking', submitBooking);
router.get('/:userId', getProfileData);

export default router;