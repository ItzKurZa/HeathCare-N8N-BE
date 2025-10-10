import express from 'express';
import { submitBooking, getProfileData } from '../controllers/booking.controller.js';
import { getDepartmentsAndDoctors } from '../controllers/booking.controller.js';

const router = express.Router();

router.post('/', submitBooking);
router.get('/departments-doctors', getDepartmentsAndDoctors);
router.get('/:userId', getProfileData);

export default router;